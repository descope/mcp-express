import { Request, Response, RequestHandler } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AuthInfo } from "../schemas/auth.js";
import { OutboundTokenConfig } from "../schemas/options.js";

/**
 * MCP server configuration options
 */
export interface McpServerConfig {
  name?: string;
  version?: string;
  capabilities?: Record<string, unknown>;
}

/**
 * Creates a factory function that returns MCP server instances.
 * This approach allows for proper auth context injection per request.
 *
 * @example
 * ```typescript
 * const provider = new DescopeMcpProvider();
 * const createServer = createMcpServerFactory({
 *   name: "my-mcp-server",
 *   version: "1.0.0"
 * });
 *
 * // Register tools with a server instance
 * const server = createServer();
 * const getUserTool = registerAuthenticatedTool({...});
 * getUserTool(server);
 *
 * // Use in Express app with custom handler
 * app.post("/mcp", descopeMcpBearerAuth(), (req, res) => {
 *   // Handle MCP protocol manually with auth context
 * });
 * ```
 */
export function createMcpServerFactory(serverConfig?: McpServerConfig) {
  const config = {
    name: serverConfig?.name || "descope-mcp-server",
    version: serverConfig?.version || "1.0.0",
    capabilities: serverConfig?.capabilities || { logging: {} },
  };

  return () => {
    return new McpServer(config, { capabilities: config.capabilities });
  };
}

/**
 * Creates a pre-configured MCP server instance that can be used
 * to register tools before setting up the HTTP transport.
 *
 * @example
 * ```typescript
 * const provider = new DescopeMcpProvider();
 * const server = createMcpServer({
 *   name: "my-mcp-server",
 *   version: "1.0.0"
 * });
 *
 * // Register tools
 * const getUserTool = registerAuthenticatedTool({...});
 * getUserTool(server);
 *
 * // Server instance can be used with various transports
 * export { server };
 * ```
 */
export function createMcpServer(serverConfig?: McpServerConfig): McpServer {
  const config = {
    name: serverConfig?.name || "descope-mcp-server",
    version: serverConfig?.version || "1.0.0",
    capabilities: serverConfig?.capabilities || { logging: {} },
  };

  return new McpServer(config, { capabilities: config.capabilities });
}

/**
 * Creates an Express request handler that implements the MCP protocol
 * with Descope authentication integration.
 *
 * @param serverConfig - Configuration for the MCP server
 * @param toolRegistration - Function to register tools with the server
 * @param outboundTokenConfig - Configuration for outbound token exchange
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
  outboundTokenConfig?: OutboundTokenConfig,
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

    // Register tools if provided
    if (toolRegistration) {
      toolRegistration(server);
    }

    // Store outbound token configuration in the server context for tools to access
    if (outboundTokenConfig) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).outboundTokenConfig = outboundTokenConfig;
    }

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);

      // Store auth info in the server context for tools to access
      if (authInfo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (server as any).authInfo = authInfo;
      }

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

/**
 * Type guard to check if a handler has an MCP server attached
 */
export function hasMcpServer(
  handler: unknown,
): handler is RequestHandler & { mcpServer: McpServer } {
  return (
    typeof handler === "function" &&
    typeof (handler as RequestHandler & { mcpServer: McpServer }).mcpServer ===
      "object"
  );
}

/**
 * Extract the MCP server instance from a handler created by createMcpServerHandler
 */
export function getMcpServer(handler: RequestHandler): McpServer | null {
  if (hasMcpServer(handler)) {
    return handler.mcpServer;
  }
  return null;
}
