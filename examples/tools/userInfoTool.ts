import { registerAuthenticatedTool } from "@descope/mcp-express";
import { z } from "zod";

/**
 * Tool that displays authenticated user information and available scopes
 */
export const userInfoTool = registerAuthenticatedTool({
  name: "user_info",
  description: "Get detailed information about the authenticated user",
  paramsSchema: {
    includeTokenInfo: z.boolean().describe("Include token expiration info").optional(),
  },
  requiredScopes: ["openid", "profile"], // Requires profile access
  execute: async ({ args, authInfo }: any) => {
    const tokenExpiresAt = authInfo.expiresAt 
      ? new Date(authInfo.expiresAt).toISOString()
      : null;
    
    const tokenInfo = args.includeTokenInfo ? {
      expiresAt: tokenExpiresAt,
      isExpired: authInfo.expiresAt ? authInfo.expiresAt < Date.now() : false,
      timeUntilExpiry: authInfo.expiresAt 
        ? Math.max(0, authInfo.expiresAt - Date.now()) 
        : null,
    } : null;
    
    return {
      user: {
        clientId: authInfo.clientId,
        scopes: authInfo.scopes || [],
        scopeCount: authInfo.scopes?.length || 0,
      },
      tokenInfo,
      requestTimestamp: new Date().toISOString(),
    };
  },
});