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

export class DescopeMcpProvider {
  readonly descope: ReturnType<typeof DescopeClient>;
  readonly projectId: string;
  readonly managementKey: string;
  readonly baseUrl: string;
  readonly serverUrl: string;
  readonly descopeOAuthEndpoints: DescopeEndpoints;
  private readonly _options: DescopeMcpProviderOptions;

  constructor({
    projectId = readEnv("DESCOPE_PROJECT_ID"),
    managementKey = readEnv("DESCOPE_MANAGEMENT_KEY"),
    baseUrl = readEnv("DESCOPE_BASE_URL"),
    serverUrl = readEnv("SERVER_URL"),
    ...opts
  }: DescopeMcpProviderOptions = {}) {
    // Validate required parameters
    if (!projectId) {
      throw new Error("DESCOPE_PROJECT_ID is not set.");
    }
    if (!managementKey) {
      throw new Error("DESCOPE_MANAGEMENT_KEY is not set.");
    }
    if (!serverUrl) {
      throw new Error("SERVER_URL is not set.");
    }

    // Initialize basic properties
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
    this.serverUrl = serverUrl;
    this.projectId = projectId;
    this.managementKey = managementKey;

    // Initialize options with defaults
    this._options = this.initializeOptions(opts);

    // Initialize Descope client
    this.descope = DescopeClient({
      projectId: this.projectId,
      baseUrl: this.baseUrl,
      managementKey: this.managementKey,
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

  get options(): DescopeMcpProviderOptions {
    return this._options;
  }
}
