import express, { RequestHandler } from "express";
import { OAuthMetadata } from "../schemas/oauth.js";
import cors from 'cors';
import { allowedMethods } from "../middleware/allowedMethods.js";
import { DescopeMcpProvider } from "../provider.js";

export function metadataHandler(provider: DescopeMcpProvider): RequestHandler {
  const baseUrl = provider.baseUrl;
  const projectId = provider.projectId;
  const issuer = new URL(projectId, baseUrl);

  const authorization_endpoint = new URL("/authorize", provider.serverUrl).href;
  const token_endpoint = provider.descopeOAuthEndpoints.token.href;
  const registration_endpoint = provider.options.dynamicClientRegistrationOptions?.isDisabled ? undefined : new URL("/register", provider.serverUrl).href;
  const revocation_endpoint = provider.descopeOAuthEndpoints.revocation.href;

  const scopes_supported_attribute = provider.options.dynamicClientRegistrationOptions?.attributeScopes?.map(scope => scope.name) ?? [];
  const scopes_support_permission = provider.options.dynamicClientRegistrationOptions?.permissionScopes?.map(scope => scope.name) ?? [];
  const scopes_supported = [...scopes_supported_attribute, ...scopes_support_permission];

  const metadata: OAuthMetadata = {
    issuer: issuer.href,
    service_documentation: provider.options.serviceDocumentationUrl,

    authorization_endpoint,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],

    token_endpoint,
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    grant_types_supported: ["authorization_code", "refresh_token"],

    revocation_endpoint,
    revocation_endpoint_auth_methods_supported: revocation_endpoint ? ["client_secret_post"] : undefined,

    registration_endpoint,

    scopes_supported: ["openid", ...scopes_supported],
  };

  // Nested router so we can configure middleware and restrict HTTP method
  const router = express.Router();

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors());

  router.use(allowedMethods(['GET']));
  router.get("/", (req, res) => {
    res.status(200).json(metadata);
  });

  return router;
}