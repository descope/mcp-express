import express, { RequestHandler } from "express";
import { ProtectedResourceMetadata } from "../schemas/oauth.js";
import cors from "cors";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { DescopeMcpProvider } from "../provider.js";

export function protectedResourceHandler(
  provider: DescopeMcpProvider,
): RequestHandler {
  const serverUrl = provider.serverUrl;
  // RFC-aligned issuer first; when it differs from Descope's OAuth issuer path (legacy
  // project-only used `.../v1/apps/<projectId>`), include both so clients that pinned
  // the long URL keep working.
  const advertisedIssuer = provider.oauthMetadataIssuer;
  const descopeIssuer = provider.descopeOAuthEndpoints.issuer.href;
  const authorization_servers =
    advertisedIssuer === descopeIssuer
      ? [advertisedIssuer]
      : [advertisedIssuer, descopeIssuer];

  // Build scopes from configured attribute and permission scopes
  const attributeScopes =
    provider.options.dynamicClientRegistrationOptions?.attributeScopes?.map(
      (scope) => scope.name,
    ) ?? [];
  const permissionScopes =
    provider.options.dynamicClientRegistrationOptions?.permissionScopes?.map(
      (scope) => scope.name,
    ) ?? [];
  const scopes_supported = ["openid", ...attributeScopes, ...permissionScopes];

  const metadata: ProtectedResourceMetadata = {
    resource: serverUrl,
    authorization_servers,
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
