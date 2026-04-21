import { z } from "zod";

/**
 * Base scope definition with common properties.
 */
export const ScopeSchema = z.object({
  /** Name of the scope */
  name: z.string(),

  /** Optional description of the scope */
  description: z.string().optional(),

  /** Whether this scope is required */
  required: z.boolean().optional(),
});

/**
 * Scope definition for attribute access.
 */
export const AttributeScopeSchema = ScopeSchema.extend({
  /** List of attributes that can be accessed */
  attributes: z.array(z.string()),
});

/**
 * Scope definition for permission access.
 */
export const PermissionScopeSchema = ScopeSchema.extend({
  /** List of roles that can be accessed */
  roles: z.array(z.string()).optional(),
});

/**
 * Options for verifying access tokens.
 */
export const VerifyTokenOptionsSchema = z.object({
  /** Scopes to verify against the token */
  requiredScopes: z.array(z.string()).optional(),

  /** Audience(s) to verify against the token */
  audience: z.array(z.string()).optional(),

  /** Key to use for token verification */
  key: z.union([z.any(), z.string()]).optional(),

  /** Resource indicator to validate according to RFC 8707 */
  resourceIndicator: z.string().optional(),
});

/**
 * Configuration for dynamic client registration functionality.
 */
export const DynamicClientRegistrationOptionsSchema = z.object({
  /** Whether dynamic client registration is enabled */
  isDisabled: z.boolean().optional(),

  /** URL for the authentication flow */
  authPageUrl: z.string().optional(),

  /** Scopes for attribute access */
  attributeScopes: z.array(AttributeScopeSchema).optional(),

  /** Scopes for permission access */
  permissionScopes: z.array(PermissionScopeSchema).optional(),

  /** Logo for the client */
  logo: z.string().optional(),

  /** Whether the client is confidential */
  nonConfidentialClient: z.boolean().optional(),
});

/**
 * Configuration for OAuth 2.0 Authorization Server functionality.
 */
export const AuthorizationServerOptionsSchema = z.object({
  /** Whether the Authorization Server endpoints are disabled (default: true) */
  isDisabled: z.boolean().optional().default(true),

  /** Whether to enable the /authorize endpoint */
  enableAuthorizeEndpoint: z.boolean().optional(),

  /** Whether to enable dynamic client registration */
  enableDynamicClientRegistration: z.boolean().optional(),
});

/**
 * Configuration options for the Descope MCP SDK.
 */
export const DescopeMcpProviderOptionsSchema = z.object({
  /**
   * Full OAuth issuer URL of the authorization server used to protect this
   * MCP server (e.g. a Descope Inbound App issuer like
   * `https://api.descope.com/v1/apps/<projectId>`).
   *
   * When provided, this is used directly as the `authorization_servers` entry
   * in the Protected Resource Metadata, and `projectId` / `baseUrl` are
   * auto-derived from it for bearer token validation.
   *
   * Reads from the `DESCOPE_MCP_SERVER_ISSUER` environment variable by default.
   */
  issuer: z.string().optional(),

  /** The Descope project ID */
  projectId: z.string().optional(),

  /** The Descope management key for administrative operations */
  managementKey: z.string().optional(),

  /** Descope endpoints are usually hosted on a different subdomain or domain
   * versus the MCP Server itself. This MCP Server URL allows us to
   * handle Dynamic Client Registration on a local server path.
   *  **/
  serverUrl: z.string().optional(),

  /** The Descope base URL if a custom domain is set */
  baseUrl: z.string().optional(),

  /**
   * The full URL of the protected resource (i.e. the MCP endpoint). Used as
   * the `resource` value in Protected Resource Metadata (RFC 9728).
   *
   * Defaults to `${serverUrl}/mcp`.
   */
  resource: z.string().optional(),

  /**
   * URL of the JWKS endpoint used to verify MCP access tokens. When unset,
   * it's discovered from `${issuer}/.well-known/openid-configuration`.
   */
  jwksUri: z.string().optional(),

  /**
   * List of OAuth scopes supported by this MCP server. Surfaced in the
   * `scopes_supported` field of the Protected Resource Metadata.
   *
   * If set, this overrides scopes derived from
   * `dynamicClientRegistrationOptions`.
   */
  scopesSupported: z.array(z.string()).optional(),

  /** Options for dynamic client registration */
  dynamicClientRegistrationOptions:
    DynamicClientRegistrationOptionsSchema.optional(),

  /** Options for Authorization Server endpoints */
  authorizationServerOptions: AuthorizationServerOptionsSchema.optional(),

  /** Options for token verification */
  verifyTokenOptions: VerifyTokenOptionsSchema.optional(),

  /** Human readable documentation */
  serviceDocumentationUrl: z.string().optional(),
});

export type Scope = z.infer<typeof ScopeSchema>;
export type AttributeScope = z.infer<typeof AttributeScopeSchema>;
export type PermissionScope = z.infer<typeof PermissionScopeSchema>;
export type VerifyTokenOptions = z.infer<typeof VerifyTokenOptionsSchema>;
export type DynamicClientRegistrationOptions = z.infer<
  typeof DynamicClientRegistrationOptionsSchema
>;
export type AuthorizationServerOptions = z.infer<
  typeof AuthorizationServerOptionsSchema
>;
export type DescopeMcpProviderOptions = z.infer<
  typeof DescopeMcpProviderOptionsSchema
>;
