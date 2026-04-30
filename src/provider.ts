import { DescopeMcpProviderOptions } from "./schemas/options.js";
import DescopeClient from "@descope/node-sdk";

/**
 * Read an environment variable.
 *
 * Trims beginning and trailing whitespace.
 *
 * Will return undefined if the environment variable doesn't exist or cannot be accessed.
 */
export const readEnv = (env: string): string | undefined => {
  if (typeof process !== "undefined") {
    return process.env?.[env]?.trim() ?? undefined;
  }
  return undefined;
};

/**
 * Helper class for URL construction and validation
 */
class UrlBuilder {
  /**
   * Safely constructs a URL by joining base URL with path segments
   * and handling any potential URL encoding issues
   */
  static construct(base: string, ...paths: string[]): URL {
    try {
      // Remove any leading/trailing slashes from paths and join them
      const cleanPaths = paths.map((p) => p.replace(/^\/+|\/+$/g, ""));
      const fullPath = cleanPaths.join("/");

      // Ensure base URL ends with a single slash
      const cleanBase = base.replace(/\/+$/, "") + "/";

      return new URL(fullPath, cleanBase);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to construct URL with base ${base} and paths ${paths.join(", ")}: ${errorMessage}`,
      );
    }
  }

  /**
   * Validates that a URL is properly formed and uses HTTPS
   * Allows localhost and 127.0.0.1 for development purposes
   */
  static validate(url: URL): void {
    const hostname = url.hostname.toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    if (!isLocalhost && !url.protocol.startsWith("https")) {
      throw new Error(
        `URL ${url.toString()} must use HTTPS protocol (except for localhost)`,
      );
    }
  }
}

/**
 * Configuration for Descope MCP endpoints
 */
interface DescopeEndpoints {
  issuer: URL;
  authorization: URL;
  token: URL;
  revocation: URL;
}

/**
 * Default attribute scopes for Dynamic Client Registration (RFC 7591)
 */
const DEFAULT_ATTRIBUTE_SCOPES = [
  {
    name: "profile",
    description: "Access to basic profile information",
    required: true,
    attributes: ["login id", "display name", "picture"],
  },
];

/**
 * Default Descope API base URL
 */
const DEFAULT_BASE_URL = "https://api.descope.com";

/**
 * Descope OAuth API endpoint paths
 *
 * Note: Descope doesn't have a Dynamic Client Registration endpoint,
 * so we instead implement a `/register` endpoint to handle it
 *
 * Generally, the paths are simply appended to the base URL.
 * The issuer also includes the Descope project ID at the end.
 *
 */
const API_PATHS = {
  ISSUER: "/v1/apps/",
  TOKEN: "/oauth2/v1/apps/token",
  REVOCATION: "/oauth2/v1/apps/revoke",
  AUTHORIZATION: "/oauth2/v1/apps/authorize",
} as const;

const OPENID_CONFIGURATION_SUFFIX = "/.well-known/openid-configuration";

/**
 * Extract Descope project ID from an MCP Server or Inbound App issuer path.
 *
 * Supports:
 * - `/v1/apps/agentic/<projectId>/...` (MCP Server)
 * - `/v1/apps/<projectId>` (legacy Inbound App issuer)
 */
export function parseDescopeProjectIdFromIssuerPath(
  pathname: string,
): string | undefined {
  const segments = pathname.split("/").filter(Boolean);

  if (
    segments[0] === "v1" &&
    segments[1] === "apps" &&
    segments[2] === "agentic" &&
    segments[3]
  ) {
    return segments[3];
  }

  if (
    segments[0] === "v1" &&
    segments[1] === "apps" &&
    segments[2] &&
    segments[2] !== "agentic"
  ) {
    return segments[2];
  }

  return undefined;
}

function assertOpenIdConfigurationUrl(wellKnownUrl: URL): void {
  if (!wellKnownUrl.pathname.endsWith(OPENID_CONFIGURATION_SUFFIX)) {
    throw new Error(
      `DESCOPE_MCP_SERVER_WELL_KNOWN_URL must end with '${OPENID_CONFIGURATION_SUFFIX}'.`,
    );
  }
}

function issuerPathnameFromWellKnownUrl(wellKnownUrl: URL): string {
  assertOpenIdConfigurationUrl(wellKnownUrl);
  return wellKnownUrl.pathname.slice(0, -OPENID_CONFIGURATION_SUFFIX.length);
}

export class DescopeMcpProvider {
  readonly descope: ReturnType<typeof DescopeClient>;
  readonly projectId: string;
  readonly managementKey?: string;
  readonly baseUrl: string;
  readonly serverUrl: string;
  readonly descopeMcpServerIssuer?: string;
  readonly descopeMcpServerWellKnownUrl?: string;
  readonly descopeOAuthEndpoints: DescopeEndpoints;
  private readonly _options: DescopeMcpProviderOptions;

  constructor({
    projectId = readEnv("DESCOPE_PROJECT_ID"),
    managementKey = readEnv("DESCOPE_MANAGEMENT_KEY"),
    baseUrl = readEnv("DESCOPE_BASE_URL"),
    serverUrl = readEnv("SERVER_URL"),
    descopeMcpServerIssuer = readEnv("DESCOPE_MCP_SERVER_ISSUER"),
    descopeMcpServerWellKnownUrl = readEnv("DESCOPE_MCP_SERVER_WELL_KNOWN_URL"),
    ...opts
  }: DescopeMcpProviderOptions = {}) {
    if (!serverUrl) {
      throw new Error("SERVER_URL is not set.");
    }

    let derivedProjectId: string | undefined;
    let derivedBaseUrl: string | undefined;

    if (descopeMcpServerWellKnownUrl) {
      const wellKnown = new URL(descopeMcpServerWellKnownUrl);
      derivedBaseUrl = wellKnown.origin;
      const issuerPath = issuerPathnameFromWellKnownUrl(wellKnown);
      derivedProjectId = parseDescopeProjectIdFromIssuerPath(issuerPath);
    }

    if (!derivedProjectId && descopeMcpServerIssuer) {
      const issuer = new URL(descopeMcpServerIssuer);
      derivedBaseUrl = derivedBaseUrl ?? issuer.origin;
      derivedProjectId = parseDescopeProjectIdFromIssuerPath(issuer.pathname);
    }

    const resolvedProjectId = projectId ?? derivedProjectId;
    if (!resolvedProjectId) {
      throw new Error(
        "Set DESCOPE_PROJECT_ID, or provide DESCOPE_MCP_SERVER_WELL_KNOWN_URL / DESCOPE_MCP_SERVER_ISSUER with a supported path (for example /v1/apps/agentic/<projectId>/...) so the project ID can be derived.",
      );
    }

    // Management key is only required when Authorization Server features are enabled
    const isAuthServerDisabled =
      opts.authorizationServerOptions?.isDisabled ?? true;
    if (!isAuthServerDisabled && !managementKey) {
      throw new Error(
        "DESCOPE_MANAGEMENT_KEY is required when Authorization Server features are enabled.",
      );
    }

    // Initialize basic properties
    this.baseUrl = baseUrl || derivedBaseUrl || DEFAULT_BASE_URL;
    this.serverUrl = serverUrl;
    this.projectId = resolvedProjectId;
    this.managementKey = managementKey;
    this.descopeMcpServerIssuer = descopeMcpServerIssuer;
    this.descopeMcpServerWellKnownUrl = descopeMcpServerWellKnownUrl;

    // Initialize options with defaults
    this._options = this.initializeOptions(opts);

    // Initialize Descope client
    this.descope = DescopeClient({
      projectId: this.projectId,
      baseUrl: this.baseUrl,
      ...(this.managementKey && { managementKey: this.managementKey }),
    });

    // Initialize endpoints
    this.descopeOAuthEndpoints = this.initializeOAuthEndpoints();
  }

  private initializeOptions(
    opts: Omit<
      DescopeMcpProviderOptions,
      "projectId" | "managementKey" | "baseUrl" | "serverUrl"
    >,
  ): DescopeMcpProviderOptions {
    const dynamicClientRegistrationOptions = {
      attributeScopes:
        opts.dynamicClientRegistrationOptions?.attributeScopes ||
        DEFAULT_ATTRIBUTE_SCOPES,
      ...opts.dynamicClientRegistrationOptions,
    };

    return {
      projectId: this.projectId,
      managementKey: this.managementKey,
      serverUrl: this.serverUrl,
      baseUrl: this.baseUrl,
      descopeMcpServerIssuer: this.descopeMcpServerIssuer,
      descopeMcpServerWellKnownUrl: this.descopeMcpServerWellKnownUrl,
      dynamicClientRegistrationOptions,
      ...opts,
    };
  }

  private getIssuerFromWellKnown(): URL | undefined {
    if (!this.descopeMcpServerWellKnownUrl) {
      return undefined;
    }

    const wellKnownUrl = new URL(this.descopeMcpServerWellKnownUrl);
    const issuerPath = issuerPathnameFromWellKnownUrl(wellKnownUrl);
    return new URL(issuerPath || "/", wellKnownUrl.origin);
  }

  private initializeOAuthEndpoints(): DescopeEndpoints {
    // Prefer explicit MCP Server OpenID configuration URL or issuer when configured.
    // Fall back to project-based issuer for backward compatibility with existing Inbound App integrations.
    const issuer =
      this.getIssuerFromWellKnown() ||
      (this.descopeMcpServerIssuer
        ? new URL(this.descopeMcpServerIssuer)
        : UrlBuilder.construct(this.baseUrl, API_PATHS.ISSUER, this.projectId));

    const endpoints = {
      issuer,
      authorization: UrlBuilder.construct(
        this.baseUrl,
        API_PATHS.AUTHORIZATION,
      ),
      token: UrlBuilder.construct(this.baseUrl, API_PATHS.TOKEN),
      revocation: UrlBuilder.construct(this.baseUrl, API_PATHS.REVOCATION),
    };

    Object.values(endpoints).forEach(UrlBuilder.validate);

    return endpoints;
  }

  get options(): DescopeMcpProviderOptions {
    return this._options;
  }
}
