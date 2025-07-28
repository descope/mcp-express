import { defineTool } from "@descope/mcp-express";

/**
 * Status tool that demonstrates a tool without input parameters
 * using the defineTool function
 */
export const statusTool = defineTool({
  name: "status",
  description: "Get the current server status and user information",
  scopes: ["openid"], // Basic authentication required
  handler: async (extra) => {
    const status = {
      server: "running",
      timestamp: new Date().toISOString(),
      authenticatedUser: {
        clientId: extra.authInfo.clientId,
        scopes: extra.authInfo.scopes,
      },
      hasOutboundToken: !!extra.getOutboundToken,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  },
});
