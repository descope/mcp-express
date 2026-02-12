import {
  McpServer,
  RegisteredTool
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  CallToolResult,
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodRawShape } from "zod";
import { AuthInfo } from "./schemas/auth.js";
import { getOutboundToken } from "./utils/outboundToken.js";
import {
  getRequestContext,
  ServerWithContext,
} from "./utils/requestContext.js";

/* -----------------------------------------------------------------------
 * Public types
 * -------------------------------------------------------------------- */

/**
 * Enhanced request handler extra that includes auth info and outbound token function
 */
export interface AuthenticatedExtra
  extends RequestHandlerExtra<ServerRequest, ServerNotification> {
  authInfo: AuthInfo;
  getOutboundToken: (
    appId: string,
    scopes?: string[],
  ) => Promise<string | null>;
}

/**
 * Type helper for inferring Zod schema output
 */
export type Inferred<S> = S extends ZodRawShape
  ? z.infer<z.ZodObject<S>>
  : void;

/**
 * Function signature for getting outbound tokens within a tool
 */
export type GetOutboundTokenFunction = (
  appId: string,
  scopes?: string[],
) => Promise<string | null>;

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
    const userScopes = authInfo.scopes || [];
    return {
      isValid: false,
      error: `Missing required scopes: ${missingScopes.join(", ")}. User has scopes: ${userScopes.length > 0 ? userScopes.join(", ") : "none"}`,
    };
  }

  return { isValid: true };
}

/* -----------------------------------------------------------------------
 * Scope validation helpers
 * -------------------------------------------------------------------- */

/**
 * Checks if the user has a specific scope
 */
export function hasScope(authInfo: AuthInfo, scope: string): boolean {
  return authInfo.scopes?.includes(scope) || false;
}

/**
 * Checks if the user has any of the provided scopes
 */
export function hasAnyScope(authInfo: AuthInfo, scopes: string[]): boolean {
  return scopes.some((scope) => hasScope(authInfo, scope));
}

/**
 * Checks if the user has all of the provided scopes
 */
export function hasAllScopes(authInfo: AuthInfo, scopes: string[]): boolean {
  return scopes.every((scope) => hasScope(authInfo, scope));
}

/* -----------------------------------------------------------------------
 * Overload #1 – tool WITH input schema
 * -------------------------------------------------------------------- */
export function registerAuthenticatedTool<
  I extends ZodRawShape,
  O extends ZodRawShape | undefined = undefined,
>(
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema: I;
    outputSchema?: O;
    annotations?: ToolAnnotations;
  },
  cb: (
    args: z.infer<z.ZodObject<I>>,
    extra: AuthenticatedExtra,
  ) => CallToolResult | Promise<CallToolResult>,
  requiredScopes?: string[],
): (server: McpServer) => RegisteredTool;

/* -----------------------------------------------------------------------
 * Overload #2 – tool WITHOUT input schema
 * -------------------------------------------------------------------- */
export function registerAuthenticatedTool<
  O extends ZodRawShape | undefined = undefined,
>(
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: undefined;
    outputSchema?: O;
    annotations?: ToolAnnotations;
  },
  cb: (extra: AuthenticatedExtra) => CallToolResult | Promise<CallToolResult>,
  requiredScopes?: string[],
): (server: McpServer) => RegisteredTool;

/* -----------------------------------------------------------------------
 * Implementation (shared)
 * -------------------------------------------------------------------- */
export function registerAuthenticatedTool(
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: ZodRawShape;
    outputSchema?: ZodRawShape;
    annotations?: ToolAnnotations;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (...args: any[]) => CallToolResult | Promise<CallToolResult>,
  requiredScopes: string[] = [],
) {
  return (server: McpServer): RegisteredTool => {
    // Convert ZodRawShape to ZodObject and register with MCP server
    // We need to handle the two cases separately to maintain correct types
    if (config.inputSchema) {
      // Tool WITH input schema
      const wrapped = async (
        args: unknown,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
      ) => {
        // Get auth context from the server
        const context = getRequestContext(server as ServerWithContext);

        if (!context?.authInfo) {
          throw new Error(
            `Authentication required for tool "${name}". Ensure a valid bearer token is provided.`,
          );
        }

        const { authInfo, descopeConfig } = context;

        // Scope validation
        if (requiredScopes.length) {
          const missing = requiredScopes.filter(
            (s) => !authInfo.scopes?.includes(s),
          );
          if (missing.length) {
            const userScopes = authInfo.scopes?.join(", ") || "none";
            throw new Error(
              `Tool "${name}" requires scopes: ${requiredScopes.join(", ")}. ` +
                `User has scopes: ${userScopes}. ` +
                `Missing: ${missing.join(", ")}. ` +
                `Request these scopes during authentication.`,
            );
          }
        }

        // getOutboundToken bound to this request
        const getOutboundTokenFn = (appId: string, scopes?: string[]) =>
          descopeConfig
            ? getOutboundToken(appId, authInfo, descopeConfig, scopes)
            : Promise.resolve(null);

        const authExtra: AuthenticatedExtra = {
          ...extra,
          authInfo,
          getOutboundToken: getOutboundTokenFn,
        };

        // Call user-supplied handler with args
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (cb as any)(args, authExtra);
      };
      
      // Use explicit any to prevent deep type instantiation errors with ZodObject
      const mcpConfigWithInput: any = {
        title: config.title,
        description: config.description,
        inputSchema: z.object(config.inputSchema),
        outputSchema: config.outputSchema ? z.object(config.outputSchema) : undefined,
        annotations: config.annotations,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return server.registerTool(name, mcpConfigWithInput, wrapped as any);
    } else {
      // Tool WITHOUT input schema
      const wrapped = async (
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
      ) => {
        // Get auth context from the server
        const context = getRequestContext(server as ServerWithContext);

        if (!context?.authInfo) {
          throw new Error(
            `Authentication required for tool "${name}". Ensure a valid bearer token is provided.`,
          );
        }

        const { authInfo, descopeConfig } = context;

        // Scope validation
        if (requiredScopes.length) {
          const missing = requiredScopes.filter(
            (s) => !authInfo.scopes?.includes(s),
          );
          if (missing.length) {
            const userScopes = authInfo.scopes?.join(", ") || "none";
            throw new Error(
              `Tool "${name}" requires scopes: ${requiredScopes.join(", ")}. ` +
                `User has scopes: ${userScopes}. ` +
                `Missing: ${missing.join(", ")}. ` +
                `Request these scopes during authentication.`,
            );
          }
        }

        // getOutboundToken bound to this request
        const getOutboundTokenFn = (appId: string, scopes?: string[]) =>
          descopeConfig
            ? getOutboundToken(appId, authInfo, descopeConfig, scopes)
            : Promise.resolve(null);

        const authExtra: AuthenticatedExtra = {
          ...extra,
          authInfo,
          getOutboundToken: getOutboundTokenFn,
        };

        // Call user-supplied handler without args
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (cb as any)(authExtra);
      };

      // Use explicit any to prevent deep type instantiation errors with ZodObject
      const mcpConfigWithoutInput: any = {
        title: config.title,
        description: config.description,
        outputSchema: config.outputSchema ? z.object(config.outputSchema) : undefined,
        annotations: config.annotations,
      };
      return server.registerTool(name, mcpConfigWithoutInput, wrapped);
    }
  };
}

/* -----------------------------------------------------------------------
 * Object-based configuration API
 * -------------------------------------------------------------------- */

/**
 * Defines an authenticated tool using object-based configuration.
 * This provides a more ergonomic API compared to registerAuthenticatedTool.
 *
 * @example
 * ```typescript
 * const getUserTool = defineTool({
 *   name: "get_user",
 *   description: "Get user information",
 *   input: z.object({ userId: z.string() }),
 *   scopes: ["profile"],
 *   handler: async (args, extra) => {
 *     const externalToken = await extra.getOutboundToken('external-app-id', ['read']);
 *     return {
 *       content: [{ type: "text", text: JSON.stringify({ userId: args.userId }) }]
 *     };
 *   }
 * });
 * ```
 */

// Overload with input schema
export function defineTool<
  I extends ZodRawShape,
  O extends ZodRawShape | undefined = undefined,
>(cfg: {
  name: string;
  title?: string;
  description?: string;
  input: I;
  output?: O;
  scopes?: string[];
  annotations?: ToolAnnotations;
  handler: (
    args: z.infer<z.ZodObject<I>>,
    extra: AuthenticatedExtra,
  ) => CallToolResult | Promise<CallToolResult>;
}): (server: McpServer) => RegisteredTool;

// Overload without input schema
export function defineTool<O extends ZodRawShape | undefined = undefined>(cfg: {
  name: string;
  title?: string;
  description?: string;
  input?: undefined;
  output?: O;
  scopes?: string[];
  annotations?: ToolAnnotations;
  handler: (extra: AuthenticatedExtra) => CallToolResult | Promise<CallToolResult>;
}): (server: McpServer) => RegisteredTool;

// Implementation
export function defineTool<
  I extends ZodRawShape | undefined = undefined,
  O extends ZodRawShape | undefined = undefined,
>(cfg: {
  name: string;
  title?: string;
  description?: string;
  input?: I;
  output?: O;
  scopes?: string[];
  annotations?: ToolAnnotations;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: any;
}): (server: McpServer) => RegisteredTool {
  if (cfg.input) {
    // With input schema
    return registerAuthenticatedTool(
      cfg.name,
      {
        title: cfg.title,
        description: cfg.description,
        inputSchema: cfg.input,
        outputSchema: cfg.output,
        annotations: cfg.annotations,
      },
      // the cast is safe; types already guarantee shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cfg.handler as any,
      cfg.scopes,
    );
  } else {
    // Without input schema
    return registerAuthenticatedTool(
      cfg.name,
      {
        title: cfg.title,
        description: cfg.description,
        outputSchema: cfg.output,
        annotations: cfg.annotations,
      },
      // the cast is safe; types already guarantee shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cfg.handler as any,
      cfg.scopes,
    );
  }
}
