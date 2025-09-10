# @descope/mcp-core

Low-level utilities for building Descope-authenticated Model Context Protocol (MCP) servers without the Express router layer. Use this package when you:

- Already manage your own transport / HTTP layer (Next.js route handlers, custom serverless function, etc.)
- Need just outbound token exchange + scope helpers
- Want a tiny surface separate from the full Express integration in `@descope/mcp-express`

## Installation

```bash
npm install @descope/mcp-core
```

## Exports

| Export                                                      | Purpose                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `AuthInfo`                                                  | Shape of authenticated user/session data you pass into tools      |
| `validateScopes`, `hasScope`, `hasAnyScope`, `hasAllScopes` | Scope validation helpers                                          |
| `getOutboundToken`                                          | Perform a user-bound token exchange for an outbound application   |
| `createTokenManager`, `DescopeTokenManager`                 | Convenience wrapper to reuse config & add future caching          |
| `DescopeConfig`                                             | Configuration for outbound exchange (project + optional base URL) |

## Quick Example (Next.js Route)

```ts
import { defineTool } from "@descope/mcp-express"; // tool ergonomics live in the express package
import { getOutboundToken, type AuthInfo, type DescopeConfig } from "@descope/mcp-core";
import { createMcpHandler } from "@vercel/mcp-adapter";

const descopeConfig: DescopeConfig = {
  projectId: process.env.DESCOPE_PROJECT_ID!,
  baseUrl: process.env.DESCOPE_BASE_URL || "https://api.descope.com",
};

async function verifyToken(token?: string): Promise<AuthInfo | undefined> {
  // Use @descope/node-sdk or your chosen validation flow
  // return { token, clientId, userId, scopes, expiresAt } when valid
}

const statusTool = defineTool({
  name: "status",
  scopes: ["openid"],
  handler: async (extra) => {
    const outbound = extra.authInfo ? await getOutboundToken("example-app", extra.authInfo, descopeConfig, ["read"]) : null;
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, outboundPresent: !!outbound }) }],
    };
  },
});

export const handler = createMcpHandler((server) => statusTool(server));
```

## Outbound Token Exchange

```ts
import { getOutboundToken } from "@descope/mcp-core";

const token = await getOutboundToken(
  "downstream-app-id", // audience/outbound application ID
  authInfo,
  { projectId: process.env.DESCOPE_PROJECT_ID! },
  ["read", "write"],
);
```

Returns the exchanged access token string or `null` if exchange fails.

### Using the Token Manager

```ts
import { createTokenManager } from "@descope/mcp-core";

const manager = createTokenManager({ projectId: process.env.DESCOPE_PROJECT_ID! });
const token = await manager.getOutboundToken(authInfo, "downstream-app-id", ["read"]);
```

Why use it?

- Central place to add caching later
- Reuse configuration without re-passing it
- Consistent null-on-miss behavior

## Scope Helpers

```ts
import { validateScopes, hasAnyScope } from "@descope/mcp-core";

const result = validateScopes(authInfo, ["openid", "profile"]);
if (!result.isValid) throw new Error(result.error);

if (hasAnyScope(authInfo, ["admin", "editor"])) {
  // privileged path
}
```

## Error Handling & Null Semantics

- `getOutboundToken` and the token manager return `null` on any failure (missing auth, config mismatch, API failure)
- Your tools decide whether to treat `null` as recoverable or fatal

## When to Use @descope/mcp-express Instead

Choose `@descope/mcp-express` if you want:

- Automatic Express router with `/mcp` + metadata endpoints
- Built-in auth middleware & request context injection
- `defineTool` & `registerAuthenticatedTool` convenience APIs

Use `@descope/mcp-core` when you only need foundational primitives and will wire transport + auth yourself.

## License

MIT
