import { createMcpHandler, withMcpAuth } from "@vercel/mcp-adapter";
import DescopeClient from "@descope/node-sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type AuthInfo,
  DescopeConfig,
  createTokenManager,
  validateScopes,
} from "@descope/mcp-core";

const descopeConfig: DescopeConfig = {
  projectId: process.env.DESCOPE_PROJECT_ID || "",
  baseUrl: process.env.DESCOPE_BASE_URL || "https://api.descope.com",
};

const tokenManager = createTokenManager(descopeConfig);

const client = DescopeClient({
  projectId: descopeConfig.projectId,
  baseUrl: descopeConfig.baseUrl,
});

const statusTool = (server: McpServer) =>
  server.registerTool(
    "status",
    {
      description:
        "Get server status, user authentication info, and outbound token availability",
    },
    async (args) => {
      const authInfo = args.authInfo;

      const scopesValidationRes = validateScopes(authInfo, ["openid"]);
      if (!scopesValidationRes.isValid) {
        console.error(
          "User does not have required scopes for outbound token:",
          scopesValidationRes.error,
        );
        return null;
      }

      const res = await tokenManager.getOutboundToken(authInfo, "example-app", [
        "app:read",
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    },
  );

async function verifyToken(
  _req: Request,
  token?: string,
): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  if (!descopeConfig.projectId) return undefined;

  const auth = await client.validateSession(token).catch(() => undefined);
  if (!auth) return undefined;

  const scope = auth.token.scope as string | undefined;
  const scopes = scope ? scope.split(" ").filter(Boolean) : [];
  const clientId = auth.token.azp as string;
  return {
    token: auth.jwt,
    clientId,
    scopes,
    userId: auth.token.sub as string,
    expiresAt: auth.token.exp as number,
  };
}

const mcpHandler = async (req: Request) =>
  createMcpHandler(
    (server: McpServer) => {
      statusTool(server);
    },
    {
      capabilities: {
        tools: {
          status: {
            description:
              "Get server status, user authentication info, and outbound token availability",
            requiresAuth: true,
          },
        },
      },
    },
    {
      basePath: "",
      verboseLogs: true,
      maxDuration: 60,
    },
  )(req);

const handler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
