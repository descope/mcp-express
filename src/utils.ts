import { AuthInfo } from "./schemas/auth.js";
import { z, ZodRawShape } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolResult,
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { getOutboundToken } from "./utils/outboundToken.js";

/**
 * Extended request handler extra with auth info
 */
export interface ExtendedRequestHandlerExtra
  extends RequestHandlerExtra<ServerRequest, ServerNotification> {
  authInfo?: AuthInfo;
  [key: string]: unknown;
}

/**
 * Function signature for getting outbound tokens within a tool
 */
export type GetOutboundTokenFunction = (
  appId: string,
  scopes?: string[],
) => Promise<string | null>;

/**
 * Tool function signature for authenticated tools
 */
export type AuthenticatedToolFunction<Args extends ZodRawShape> = (params: {
  args: z.infer<z.ZodObject<Args>>;
  extra: ExtendedRequestHandlerExtra;
  authInfo: AuthInfo;
  getOutboundToken: GetOutboundTokenFunction;
}) => Promise<Record<string, unknown>>;

/**
 * Parameters for registering an authenticated tool
 */
export type RegisterAuthenticatedToolParams<Args extends ZodRawShape> = {
  name: string;
  description: string;
  paramsSchema: Args;
  requiredScopes?: string[];
  execute: AuthenticatedToolFunction<Args>;
};

/**
 * Validates scopes against the authenticated user's scopes
 */
export function validateScopes(
  authInfo: AuthInfo,
  requiredScopes: string[] = [],
): { isValid: boolean; error?: string } {
  if (requiredScopes.length === 0) {
    return { isValid: true };
  }

  const userScopes = authInfo.scopes || [];
  const missingScopes = requiredScopes.filter(
    (scope) => !userScopes.includes(scope),
  );

  if (missingScopes.length > 0) {
    return {
      isValid: false,
      error: `Missing required scopes: ${missingScopes.join(", ")}`,
    };
  }

  return { isValid: true };
}

/**
 * Registers an authenticated tool with the MCP server with authentication and scope validation
 *
 * @example
 * ```typescript
 * const getUserTool = registerAuthenticatedTool({
 *   name: "get_user",
 *   description: "Get user information",
 *   paramsSchema: { userId: z.string() },
 *   requiredScopes: ["profile", "email"],
 *   execute: async ({ args, authInfo, getOutboundToken }) => {
 *     // Access validated args and authenticated user info
 *     const externalToken = await getOutboundToken('external-app-id', ['read']);
 *     return { userId: args.userId, scopes: authInfo.scopes };
 *   }
 * });
 *
 * // Register with MCP server
 * getUserTool(server);
 * ```
 */
export function registerAuthenticatedTool<Args extends ZodRawShape>({
  name,
  description,
  paramsSchema,
  requiredScopes = [],
  execute,
}: RegisterAuthenticatedToolParams<Args>) {
  return (server: McpServer) => {
    server.registerTool(
      name,
      {
        description,
        inputSchema: paramsSchema,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async (args: any, extra: any): Promise<CallToolResult> => {
        // Extract auth info from server context (injected by MCP server handler)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const authInfo = (server as any).authInfo || extra?.authInfo;

        if (!authInfo) {
          throw new Error("Authentication required but no auth info provided");
        }

        // Validate required scopes
        const scopeValidation = validateScopes(authInfo, requiredScopes);
        if (!scopeValidation.isValid) {
          throw new Error(scopeValidation.error || "Insufficient permissions");
        }

        // Create getOutboundToken function bound to current auth context
        const getOutboundTokenFn: GetOutboundTokenFunction = async (
          appId: string,
          scopes?: string[],
        ) => {
          // Get outbound token configuration from server context (uses same project ID and base URL)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const outboundTokenConfig = (server as any).outboundTokenConfig;

          if (!outboundTokenConfig) {
            throw new Error("Outbound token configuration not provided");
          }
          return getOutboundToken(appId, authInfo, outboundTokenConfig, scopes);
        };

        // Call the tool implementation with enhanced context
        const result = await execute({
          args: args as z.infer<z.ZodObject<Args>>,
          extra: extra as ExtendedRequestHandlerExtra,
          authInfo,
          getOutboundToken: getOutboundTokenFn,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );
  };
}
