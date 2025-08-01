import { Request, Response, RequestHandler } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AuthInfo } from "../schemas/auth.js";
import { DescopeMcpProviderOptions } from "../schemas/options.js";
import {
  attachRequestContext,
  ServerWithContext,
} from "../utils/requestContext.js";

/**
 * MCP server configuration options
 */
export interface McpServerConfig {
  name?: string;
  version?: string;
  capabilities?: Record<string, unknown>;
}

/**
 * Creates an Express request handler that implements the MCP protocol
 * with Descope authentication integration.
 *
 * @param serverConfig - Configuration for the MCP server
 * @param toolRegistration - Function to register tools with the server
 * @param descopeConfig - Configuration for outbound token exchange
 *
 * @example
 * ```typescript
 * const mcpHandler = createMcpServerHandler(
 *   { name: "my-mcp-server", version: "1.0.0" },
 *   (server) => {
 *     const getUserTool = registerAuthenticatedTool({...});
 *     getUserTool(server);
 *   }
 * );
 *
 * app.post("/mcp", descopeMcpBearerAuth(), mcpHandler);
 * ```
 */
export function createMcpServerHandler(
  serverConfig: McpServerConfig = {},
  toolRegistration?: (server: McpServer) => void,
  descopeConfig?: DescopeMcpProviderOptions,
): RequestHandler {
  const config = {
    name: serverConfig.name || "descope-mcp-server",
    version: serverConfig.version || "1.0.0",
    capabilities: serverConfig.capabilities || { logging: {} },
  };

  return async (req: Request, res: Response) => {
    const server = new McpServer(config, { capabilities: config.capabilities });

    // Get auth info from the authenticated request
    const authInfo = (req as Request & { authInfo?: AuthInfo }).authInfo;

    // Attach request context to the server for this request lifecycle
    if (authInfo) {
      attachRequestContext(
        server as ServerWithContext,
        authInfo,
        descopeConfig,
      );
    }

    // Register tools if provided
    if (toolRegistration) {
      toolRegistration(server);
    }

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      console.error("MCP server error:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  };
}
