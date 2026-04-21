import express, { RequestHandler } from "express";
import { ProtectedResourceMetadata } from "../schemas/oauth.js";
import cors from "cors";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { DescopeMcpProvider } from "../provider.js";

export function protectedResourceHandler(
  provider: DescopeMcpProvider,
): RequestHandler {
  // The issuer is resolved by the provider: either a caller-supplied full URL
  // (e.g. via DESCOPE_MCP_SERVER_ISSUER) or one derived from projectId + baseUrl.
  const authorizationServer =
    provider.issuer ?? provider.descopeOAuthEndpoints.issuer.href;

  // Explicit scopesSupported takes precedence; otherwise derive from DCR config
  // for backwards compatibility (includes the implicit "openid" scope).
  let scopes_supported: string[];
  if (provider.options.scopesSupported) {
    scopes_supported = provider.options.scopesSupported;
  } else {
    const attributeScopes =
      provider.options.dynamicClientRegistrationOptions?.attributeScopes?.map(
        (scope) => scope.name,
      ) ?? [];
    const permissionScopes =
      provider.options.dynamicClientRegistrationOptions?.permissionScopes?.map(
        (scope) => scope.name,
      ) ?? [];
    scopes_supported = ["openid", ...attributeScopes, ...permissionScopes];
  }

  const metadata: ProtectedResourceMetadata = {
    resource: provider.resourceUrl,
    authorization_servers: [authorizationServer],
    scopes_supported,
    bearer_methods_supported: ["header"],
    resource_documentation: provider.options.serviceDocumentationUrl,
  };

  // Nested router so we can configure middleware and restrict HTTP method
  const router = express.Router();

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors());

  router.use(allowedMethods(["GET"]));
  router.get("/", (_req, res) => {
    res.status(200).json(metadata);
  });

  return router;
}
