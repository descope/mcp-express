import { defineTool } from "@descope/mcp-express";

/**
 * Status tool that demonstrates a tool without input parameters
 * using the defineTool function
 */
export const statusTool = defineTool({
  name: "status",
  description:
    "Get the current server status, user information, and outbound token availability",
  scopes: ["openid"], // Basic authentication required
  handler: async (extra) => {
    // Attempt to fetch an outbound token for an example app id
    // Replace "example-app" and scopes with your configured outbound application details in Descope
    const outboundToken = await extra.getOutboundToken("example-app", ["read"]);

    const status = {
      server: "running",
      timestamp: new Date().toISOString(),
      authenticatedUser: {
        clientId: extra.authInfo.clientId,
        scopes: extra.authInfo.scopes,
      },
      outboundTokenPresent: outboundToken != null,
      outboundTokenPreview: outboundToken
        ? `${outboundToken.slice(0, 12)}…`
        : null,
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
