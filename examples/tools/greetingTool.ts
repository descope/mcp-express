import { registerAuthenticatedTool } from "@descope/mcp-express";
import { z } from "zod";

/**
 * Simple greeting tool that demonstrates basic authentication and scope validation
 */
export const greetingTool = registerAuthenticatedTool({
  name: "greeting",
  description:
    "Say hello to the authenticated user with optional personalization",
  paramsSchema: {
    name: z.string().describe("Name to greet").optional(),
    includeTime: z
      .boolean()
      .describe("Include current time in greeting")
      .optional(),
  },
  requiredScopes: ["openid"], // Basic authentication required
  execute: async ({ args, authInfo }: any) => {
    const name = args.name || "there";
    const currentTime = args.includeTime ? new Date().toLocaleString() : null;

    const greeting = `Hello ${name}!`;
    const timeMessage = currentTime ? ` It's currently ${currentTime}.` : "";

    return {
      message: greeting + timeMessage,
      authenticatedUser: authInfo.clientId,
      userScopes: authInfo.scopes,
      timestamp: new Date().toISOString(),
    };
  },
});
