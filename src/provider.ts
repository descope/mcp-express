import { DescopeMcpProviderOptions } from "./schemas/options.js";
import DescopeClient from "@descope/node-sdk";
import { IssuerTokenValidator } from "./utils/tokenValidator.js";

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

/**
 * Information derived from a full OAuth issuer URL.
 */
interface DerivedIssuerInfo {
  /** Origin of the issuer, e.g. `https://api.descope.com` */
  baseUrl: string;
  /** Descope project ID, extracted from the issuer path if possible */
  projectId?: string;
  /** MCP server ID, extracted from the issuer path if present (agentic format) */
  mcpServerId?: string;
}

/**
 * Pattern that matches a Descope project ID (starts with `P` followed by a
 * digit, then 20+ base62 characters).
 */
const PROJECT_ID_PATTERN = /^P\d[A-Za-z0-9]{20,}$/;

/**
 * Pattern that matches a Descope MCP / agentic server ID (starts with `MS`
 * followed by 20+ base62 characters).
 */
const MCP_SERVER_ID_PATTERN = /^MS[A-Za-z0-9]{20,}$/;

/**
 * Derives `baseUrl` and Descope identifiers from a full issuer URL. Supports
 * both the legacy Inbound App format (`/v1/apps/<projectId>`) and the newer
 * Agentic / MCP format (`/v1/apps/agentic/<projectId>/<mcpServerId>`).
 */
function deriveFromIssuer(issuer: string): DerivedIssuerInfo {
  let parsed: URL;
  try {
    parsed = new URL(issuer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid issuer URL '${issuer}': ${message}`);
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  // Prefer segments that match the Descope project ID / MCP server ID
  // patterns, so positional differences between formats don't matter.
  const projectId = segments.find((segment) =>
    PROJECT_ID_PATTERN.test(segment),
  );
  const mcpServerId = segments.find((segment) =>
    MCP_SERVER_ID_PATTERN.test(segment),
  );

  return {
    baseUrl: `${parsed.protocol}//${parsed.host}`,
    projectId: projectId ?? (segments.length > 0 ? segments[segments.length - 1] : undefined),
    mcpServerId,
  };
}

export class DescopeMcpProvider {
  readonly descope: ReturnType<typeof DescopeClient>;
  readonly projectId: string;
  readonly managementKey?: string;
  readonly baseUrl: string;
  readonly serverUrl: string;
  readonly issuer: string;
  readonly mcpServerId?: string;
  readonly descopeOAuthEndpoints: DescopeEndpoints;
  readonly tokenValidator: IssuerTokenValidator;
  private readonly _options: DescopeMcpProviderOptions;

  constructor({
    issuer = readEnv("DESCOPE_MCP_SERVER_ISSUER"),
    projectId = readEnv("DESCOPE_PROJECT_ID"),
    managementKey = readEnv("DESCOPE_MANAGEMENT_KEY"),
    baseUrl = readEnv("DESCOPE_BASE_URL"),
    serverUrl = readEnv("SERVER_URL"),
    ...opts
  }: DescopeMcpProviderOptions = {}) {
    // When a full issuer URL is supplied, derive projectId/baseUrl from it
    // so callers only have to paste a single value.
    let derived: DerivedIssuerInfo | undefined;
    if (issuer) {
      derived = deriveFromIssuer(issuer);
      projectId = projectId || derived.projectId;
      baseUrl = baseUrl || derived.baseUrl;
    }
    this.mcpServerId = derived?.mcpServerId;

    // Validate required parameters
    if (!projectId) {
      throw new Error(
        "DESCOPE_PROJECT_ID (or DESCOPE_MCP_SERVER_ISSUER) is not set.",
      );
    }
    if (!serverUrl) {
      throw new Error("SERVER_URL is not set.");
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
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
    this.serverUrl = serverUrl;
    this.projectId = projectId;
    this.managementKey = managementKey;

    // Initialize endpoints and resolved issuer
    this.descopeOAuthEndpoints = this.initializeOAuthEndpoints();
    this.issuer = issuer || this.descopeOAuthEndpoints.issuer.href;

    // Initialize options with defaults (stores the resolved issuer too)
    this._options = this.initializeOptions(opts);

    // Initialize Descope client
    this.descope = DescopeClient({
      projectId: this.projectId,
      baseUrl: this.baseUrl,
      ...(this.managementKey && { managementKey: this.managementKey }),
    });

    // Initialize issuer-based JWT validator (uses OIDC discovery for JWKS).
    // This handles MCP-server-issued tokens correctly, including the
    // agentic `/v1/apps/agentic/<projectId>/<mcpServerId>` issuer format.
    this.tokenValidator = new IssuerTokenValidator(
      this.issuer,
      this._options.jwksUri,
    );
  }

  private initializeOptions(
    opts: Omit<
      DescopeMcpProviderOptions,
      "issuer" | "projectId" | "managementKey" | "baseUrl" | "serverUrl"
    >,
  ): DescopeMcpProviderOptions {
    const dynamicClientRegistrationOptions = {
      attributeScopes:
        opts.dynamicClientRegistrationOptions?.attributeScopes ||
        DEFAULT_ATTRIBUTE_SCOPES,
      ...opts.dynamicClientRegistrationOptions,
    };

    return {
      issuer: this.issuer,
      projectId: this.projectId,
      managementKey: this.managementKey,
      serverUrl: this.serverUrl,
      baseUrl: this.baseUrl,
      dynamicClientRegistrationOptions,
      ...opts,
    };
  }

  private initializeOAuthEndpoints(): DescopeEndpoints {
    const endpoints = {
      issuer: UrlBuilder.construct(
        this.baseUrl,
        API_PATHS.ISSUER,
        this.projectId,
      ),
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

  /**
   * The URL of the protected resource (MCP endpoint) that is surfaced in the
   * Protected Resource Metadata. Defaults to `${serverUrl}/mcp` if not
   * explicitly configured via `options.resource`.
   */
  get resourceUrl(): string {
    if (this._options.resource) {
      return this._options.resource;
    }
    return UrlBuilder.construct(this.serverUrl, "mcp").href.replace(/\/$/, "");
  }

  get options(): DescopeMcpProviderOptions {
    return this._options;
  }
}
