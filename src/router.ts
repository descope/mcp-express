import express, { RequestHandler } from "express";
import { authorizationHandler } from "./handlers/authorize.js";
import { metadataHandler } from "./handlers/metadata.js";
import { registrationHandler } from "./handlers/register.js";
import { protectedResourceHandler } from "./handlers/protectedResource.js";
import { createMcpServerHandler } from "./handlers/mcpServer.js";
import { DescopeMcpProvider } from "./provider.js";
import { descopeMcpBearerAuth } from "./middleware/bearerAuth.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Creates an MCP-compliant router with OAuth 2.0 Resource Server capabilities.
 *
 * By default, this router provides:
 * - Protected Resource Metadata (RFC 8705) - ALWAYS enabled
 * - Authorization Server Metadata (RFC 8414) - ALWAYS enabled
 * - MCP server endpoint (/mcp) - ALWAYS enabled with authentication
 * - Authorization Server endpoints (/authorize, /register) - DISABLED by default
 *
 * Most MCP servers should operate as Resource Servers, not Authorization Servers.
 * To enable Authorization Server functionality, set authorizationServerOptions.isDisabled = false.
 *
 * This router MUST be installed at the application root, like so:
 *
 *  const app = express();
 *  app.use(descopeMcpAuthRouter(...));
 */
export function descopeMcpAuthRouter(
  toolRegistration?: (server: McpServer) => void,
  provider?: DescopeMcpProvider,
): RequestHandler {
  const authProvider = provider || new DescopeMcpProvider();

  const router = express.Router();

  // Always provide metadata endpoints (required for MCP 2025-06-18 compliance)
  router.use(
    "/.well-known/oauth-authorization-server",
    metadataHandler(authProvider),
  );

  router.use(
    "/.well-known/oauth-protected-resource",
    protectedResourceHandler(authProvider),
  );

  // MCP server endpoint - always enabled with authentication
  router.post(
    "/mcp",
    descopeMcpBearerAuth(authProvider),
    createMcpServerHandler(
      {
        name: "descope-mcp-server",
        version: "1.0.0",
      },
      toolRegistration,
      authProvider.options.outboundTokenConfig,
    ),
  );

  // Authorization Server endpoints are disabled by default
  // Enable them only if explicitly configured
  const authServerOptions = authProvider.options.authorizationServerOptions;
  const isAuthServerDisabled = authServerOptions?.isDisabled ?? true;

  if (!isAuthServerDisabled) {
    // Enable /authorize endpoint if Authorization Server is enabled
    if (authServerOptions?.enableAuthorizeEndpoint !== false) {
      // As stated in OAuth 2.1, section 1.4.1:
      //
      // "If the client omits the scope parameter when requesting
      // authorization, the authorization server MUST either process the
      // request using a pre-defined default value or fail the request
      // indicating an invalid scope.  The authorization server SHOULD
      // document its scope requirements and default value (if defined)."
      //
      // By default, Descope fails the request when the scope is undefined.
      // This is a workaround to instead use a default scope.
      router.use("/authorize", authorizationHandler(authProvider));
    }

    // Enable dynamic client registration if configured
    if (
      authServerOptions?.enableDynamicClientRegistration !== false &&
      !authProvider.options.dynamicClientRegistrationOptions?.isDisabled
    ) {
      router.use("/register", registrationHandler(authProvider));
    }
  }

  return router;
}
