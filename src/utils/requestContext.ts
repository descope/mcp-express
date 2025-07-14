import { AuthInfo } from "../schemas/auth.js";
import { DescopeMcpProviderOptions } from "../schemas/options.js";

/**
 * Request context that holds authentication info and configuration.
 * This is attached to the MCP server instance for the duration of a request.
 */
export interface McpRequestContext {
  /** Authentication info from the current request */
  authInfo: AuthInfo;
  /** Descope provider configuration */
  descopeConfig?: DescopeMcpProviderOptions;
}

/**
 * Symbol to store request context on server instances.
 * Using a symbol prevents naming conflicts and makes it clear this is internal.
 */
export const MCP_REQUEST_CONTEXT = Symbol("mcp.requestContext");

/**
 * Server with request context attached
 */
export interface ServerWithContext {
  [MCP_REQUEST_CONTEXT]?: McpRequestContext;
}

/**
 * Attaches request context to a server instance
 */
export function attachRequestContext(
  server: ServerWithContext,
  authInfo: AuthInfo,
  descopeConfig?: DescopeMcpProviderOptions
): void {
  server[MCP_REQUEST_CONTEXT] = {
    authInfo,
    descopeConfig,
  };
}

/**
 * Gets request context from a server instance
 */
export function getRequestContext(
  server: ServerWithContext
): McpRequestContext | undefined {
  return server[MCP_REQUEST_CONTEXT];
}
