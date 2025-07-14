import { AuthInfo } from "./schemas/auth.js";
import { z, ZodRawShape } from "zod";
import {
  McpServer,
  RegisteredTool,
  ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolResult,
  ServerRequest,
  ServerNotification,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { getOutboundToken } from "./utils/outboundToken.js";

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
    scopes?: string[]
  ) => Promise<string | null>;
}

/**
 * Type helper for inferring Zod schema output
 */
export type Inferred<S> = S extends ZodRawShape ? z.infer<z.ZodObject<S>> : void;

/**
 * Function signature for getting outbound tokens within a tool
 */
export type GetOutboundTokenFunction = (
  appId: string,
  scopes?: string[]
) => Promise<string | null>;

/**
 * Validates scopes against the authenticated user's scopes
 */
export function validateScopes(
  authInfo: AuthInfo,
  requiredScopes: string[] = []
): { isValid: boolean; error?: string } {
  if (requiredScopes.length === 0) {
    return { isValid: true };
  }

  const userScopes = authInfo.scopes || [];
  const missingScopes = requiredScopes.filter(
    (scope) => !userScopes.includes(scope)
  );

  if (missingScopes.length > 0) {
    return {
      isValid: false,
      error: `Missing required scopes: ${missingScopes.join(", ")}`,
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
  O extends ZodRawShape | undefined = undefined
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
    extra: AuthenticatedExtra
  ) => CallToolResult | Promise<CallToolResult>,
  requiredScopes?: string[]
): (server: McpServer) => RegisteredTool;

/* -----------------------------------------------------------------------
 * Overload #2 – tool WITHOUT input schema
 * -------------------------------------------------------------------- */
export function registerAuthenticatedTool<
  O extends ZodRawShape | undefined = undefined
>(
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: undefined;
    outputSchema?: O;
    annotations?: ToolAnnotations;
  },
  cb: (
    extra: AuthenticatedExtra
  ) => CallToolResult | Promise<CallToolResult>,
  requiredScopes?: string[]
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
  requiredScopes: string[] = []
) {
  return (server: McpServer) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped: ToolCallback<any> = async (
      args: unknown,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>
    ) => {
      // Get auth info
      const authInfo: AuthInfo =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (server as any).authInfo ?? (extra as any).authInfo;
      if (!authInfo) throw new Error("Authentication required");

      // Scope validation
      if (requiredScopes.length) {
        const missing = requiredScopes.filter(
          (s) => !authInfo.scopes?.includes(s)
        );
        if (missing.length) {
          throw new Error(`Missing required scopes: ${missing.join(", ")}`);
        }
      }

      // getOutboundToken bound to this request
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outboundCfg = (server as any).outboundTokenConfig;
      const getOutboundTokenFn = (appId: string, scopes?: string[]) =>
        getOutboundToken(appId, authInfo, outboundCfg, scopes);

      const authExtra: AuthenticatedExtra = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(extra as any),
        authInfo,
        getOutboundToken: getOutboundTokenFn,
      };

      // Call user-supplied handler
      return config.inputSchema
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (cb as any)(args, authExtra)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (cb as any)(authExtra);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return server.registerTool(name, config, wrapped as any);
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
export function defineTool<
  I extends ZodRawShape | undefined = undefined,
  O extends ZodRawShape | undefined = undefined
>(cfg: {
  name: string;
  title?: string;
  description?: string;
  input?: I;
  output?: O;
  scopes?: string[];
  annotations?: ToolAnnotations;
  handler: I extends ZodRawShape
    ? (
        args: z.infer<z.ZodObject<I>>,
        extra: AuthenticatedExtra
      ) => CallToolResult | Promise<CallToolResult>
    : (
        extra: AuthenticatedExtra
      ) => CallToolResult | Promise<CallToolResult>;
}) {
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
      cfg.scopes
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
      cfg.scopes
    );
  }
}