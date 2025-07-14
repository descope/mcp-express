import { defineTool } from "@descope/mcp-express";
import { z } from "zod";

/**
 * Simple greeting tool that demonstrates basic authentication and scope validation
 * using the new defineTool function for better ergonomics
 */
export const greetingTool = defineTool({
  name: "greeting",
  description: "Say hello to the authenticated user with optional personalization",
  input: {
    name: z.string().describe("Name to greet").optional(),
    includeTime: z
      .boolean()
      .describe("Include current time in greeting")
      .optional(),
  },
  scopes: ["openid"], // Basic authentication required
  handler: async (args, extra) => {
    const name = args.name || "there";
    const currentTime = args.includeTime ? new Date().toLocaleString() : null;

    const greeting = `Hello ${name}!`;
    const timeMessage = currentTime ? ` It's currently ${currentTime}.` : "";

    const result = {
      message: greeting + timeMessage,
      authenticatedUser: extra.authInfo.clientId,
      userScopes: extra.authInfo.scopes,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
});
