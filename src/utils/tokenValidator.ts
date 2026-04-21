import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";

/**
 * Result of successfully validating a JWT.
 */
export interface ValidatedToken {
  /** The raw JWT string */
  jwt: string;
  /** The parsed JWT payload */
  token: JWTPayload;
}

/**
 * Minimal OIDC discovery metadata we care about.
 */
interface OidcDiscovery {
  issuer?: string;
  jwks_uri?: string;
}

/**
 * A pluggable validator for bearer tokens. It verifies a JWT's signature
 * against JWKS published at the configured issuer's OIDC discovery document,
 * as well as validates the `iss` claim against the configured issuer.
 *
 * This path supports Descope MCP server issuers in the
 * `https://api.descope.com/v1/apps/agentic/<projectId>/<mcpServerId>` format,
 * which Descope SDK's `validateSession` does not currently handle (it expects
 * the trailing issuer segment to equal the project ID).
 */
export class IssuerTokenValidator {
  private readonly issuer: string;
  private jwksUriOverride?: string;
  private keySetPromise?: Promise<JWTVerifyGetKey>;
  private discoveryPromise?: Promise<OidcDiscovery>;

  constructor(issuer: string, jwksUri?: string) {
    this.issuer = issuer.replace(/\/$/, "");
    this.jwksUriOverride = jwksUri;
  }

  /**
   * Verifies a JWT and returns the decoded payload. Throws if signature or
   * `iss` claim validation fails.
   */
  async validate(token: string): Promise<ValidatedToken> {
    const getKey = await this.getKeySet();
    const { payload } = await jwtVerify(token, getKey, {
      issuer: this.issuer,
      clockTolerance: 5,
    });
    return { jwt: token, token: payload };
  }

  private async getKeySet(): Promise<JWTVerifyGetKey> {
    if (!this.keySetPromise) {
      this.keySetPromise = this.resolveJwksUri().then((jwksUri) =>
        createRemoteJWKSet(new URL(jwksUri)),
      );
    }
    return this.keySetPromise;
  }

  private async resolveJwksUri(): Promise<string> {
    if (this.jwksUriOverride) return this.jwksUriOverride;
    const discovery = await this.getDiscovery();
    if (!discovery.jwks_uri) {
      throw new Error(
        `OIDC discovery document at ${this.issuer}/.well-known/openid-configuration is missing 'jwks_uri'`,
      );
    }
    return discovery.jwks_uri;
  }

  private async getDiscovery(): Promise<OidcDiscovery> {
    if (!this.discoveryPromise) {
      this.discoveryPromise = this.fetchDiscovery();
    }
    return this.discoveryPromise;
  }

  private async fetchDiscovery(): Promise<OidcDiscovery> {
    const url = `${this.issuer}/.well-known/openid-configuration`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch OIDC discovery from ${url}: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as OidcDiscovery;
  }
}
