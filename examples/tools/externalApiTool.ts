import { registerAuthenticatedTool } from "@descope/mcp-express";
import { z } from "zod";

/**
 * Tool that demonstrates outbound token usage for external API calls
 */
export const externalApiTool = registerAuthenticatedTool({
  name: "external_api",
  description: "Demonstrate outbound token exchange for external API access",
  paramsSchema: {
    appId: z.string().describe("The outbound application ID configured in Descope"),
    scopes: z.array(z.string()).describe("Scopes to request for the outbound token").optional(),
    dryRun: z.boolean().describe("Only get the token without making an API call").optional(),
  },
  requiredScopes: ["openid", "profile"], // Requires profile access
  execute: async ({ args, authInfo, getOutboundToken }: any) => {
    try {
      // Get outbound token for external API
      const externalToken = await getOutboundToken(args.appId, args.scopes);
      
      if (!externalToken) {
        return {
          success: false,
          error: "Failed to obtain outbound token",
          appId: args.appId,
          requestedScopes: args.scopes || [],
          timestamp: new Date().toISOString(),
        };
      }
      
      // If dry run, just return the token info
      if (args.dryRun) {
        return {
          success: true,
          message: "Outbound token obtained successfully",
          appId: args.appId,
          requestedScopes: args.scopes || [],
          tokenLength: externalToken.length,
          tokenPreview: externalToken.substring(0, 20) + "...",
          timestamp: new Date().toISOString(),
        };
      }
      
      // Example: Make a request to a hypothetical external API
      // In practice, you would call your actual external API here
      const exampleApiCall = {
        method: "GET",
        url: "https://api.example.com/data",
        headers: {
          "Authorization": `Bearer ${externalToken}`,
          "Content-Type": "application/json",
        },
      };
      
      return {
        success: true,
        message: "Outbound token obtained and ready for external API calls",
        appId: args.appId,
        requestedScopes: args.scopes || [],
        tokenLength: externalToken.length,
        tokenPreview: externalToken.substring(0, 20) + "...",
        exampleApiCall,
        authenticatedUser: authInfo.clientId,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        appId: args.appId,
        requestedScopes: args.scopes || [],
        timestamp: new Date().toISOString(),
      };
    }
  },
});