# Descope MCP Express SDK

![Descope Banner](https://github.com/descope/.github/assets/32936811/d904d37e-e3fa-4331-9f10-2880bb708f64)

Drop‑in Express middleware and helpers to add secure auth to your Model Context Protocol (MCP) server with Descope. Ship an authenticated /mcp endpoint and register tools in minutes.

## Table of Contents

- Prerequisites
- Installation
- Quick Start
- Creating Authenticated Tools
- Which API should I use?
- Features
- OAuth Implementation
- Advanced Usage
  - Legacy Authorization Server Mode (not recommended)
  - Verify Token Options
- Migrating from an existing MCP server
- Migration from v0.0.x
- Attribution
- License

## Prerequisites

- A Descope project
- An Express app
- Node.js 18+

## Installation

```bash
npm install @descope/mcp-express
```

## Quick Start

1. Create `.env`

```bash
DESCOPE_PROJECT_ID=your_project_id
SERVER_URL=http://localhost:3000
```

2. Minimal server

```typescript
import "dotenv/config";
import express from "express";
import { descopeMcpAuthRouter, defineTool, DescopeMcpProvider } from "@descope/mcp-express";
import { z } from "zod";

const app = express();
// Required: so /mcp can read JSON bodies
app.use(express.json());

// Optional: explicit provider config (env work out of the box)
const provider = new DescopeMcpProvider({
  projectId: process.env.DESCOPE_PROJECT_ID,
  serverUrl: process.env.SERVER_URL,
  baseUrl: process.env.DESCOPE_BASE_URL, // optional
});

// Define an authenticated tool (requires 'openid')
const hello = defineTool({
  name: "hello",
  description: "Say hello to the authenticated user",
  input: {
    name: z.string().describe("Name to greet").optional(),
  },
  scopes: ["openid"],
  handler: async (args, extra) => {
    const result = {
      message: `Hello ${args.name || "there"}!`,
      authenticatedUser: extra.authInfo.clientId,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

// Wire the MCP router and register your tools
app.use(
  descopeMcpAuthRouter((server) => {
    hello(server);
  }, provider),
);

app.listen(3000, () => {
  console.log("MCP endpoint: POST http://localhost:3000/mcp");
});
```

Pro tips

- Send `Content-Type: application/json` to `/mcp`.
- `/mcp` requires a valid Bearer token.
- Metadata endpoints are always on. The `/mcp` handler is wired only when you pass a `toolRegistration` function.

## Creating Authenticated Tools

Pick your flavor: the ergonomic `defineTool` or the flexible `registerAuthenticatedTool`.

- `defineTool` (with input)

```typescript
import { defineTool } from "@descope/mcp-express";
import { z } from "zod";

const getUser = defineTool({
  name: "get_user",
  description: "Get user information",
  input: { userId: z.string().describe("The user ID to fetch") },
  scopes: ["profile", "email"],
  handler: async (args, extra) => {
    return {
      content: [{ type: "text", text: JSON.stringify({ userId: args.userId, scopes: extra.authInfo.scopes }, null, 2) }],
    };
  },
});
```

- `registerAuthenticatedTool`
  - With input

```typescript
import { registerAuthenticatedTool } from "@descope/mcp-express";
import { z } from "zod";

const getUser = registerAuthenticatedTool(
  "get_user",
  {
    description: "Get user information",
    inputSchema: { userId: z.string().describe("The user ID to fetch") },
  },
  async (args, extra) => {
    return { content: [{ type: "text", text: JSON.stringify({ userId: args.userId }, null, 2) }] };
  },
  ["profile", "email"],
);
```

- Without input

```typescript
const whoami = registerAuthenticatedTool(
  "whoami",
  { description: "Return authenticated identity info" },
  async (extra) => {
    const result = {
      clientId: extra.authInfo.clientId,
      scopes: extra.authInfo.scopes || [],
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
  ["openid"],
);
```

## Which API should I use?

Short answer: choose `defineTool` for brevity and great type inference; choose `registerAuthenticatedTool` if you prefer explicit overloads and a closer-to-the-metal API.

- Same capabilities
  - `defineTool` is a thin wrapper over `registerAuthenticatedTool`.
  - Both support input (Zod shape), optional output schema, annotations, and scopes.
- Why `defineTool`
  - Concise, single-object config.
  - Cleaner TypeScript inference for `(args, extra)` when you provide `input`.
- Why `registerAuthenticatedTool`
  - Lower-level, mirrors the underlying MCP `registerTool` shape.
  - Two overloads (with/without input) if you like explicit control.

There isn’t anything you can do with one that you can’t do with the other. Pick the style you prefer.

## Features

MCP 2025‑06‑18 compliant Resource Server.

- Protected Resource Metadata (RFC 8705)
- Authorization Server Metadata (RFC 8414)
- `/mcp` endpoint with bearer token authentication
- Resource Indicator support (RFC 8707)

Optional (Authorization Server)

- `/authorize` endpoint (disabled by default)
- Dynamic Client Registration (disabled by default)
- Token and revocation are provided by Descope

## OAuth Implementation

Resource Server (always enabled)

- RFC 8705: OAuth 2.0 Protected Resource Metadata
- RFC 8414: OAuth 2.0 Authorization Server Metadata
- RFC 8707: Resource Indicators for OAuth 2.0

Authorization Server (optional)

- RFC 7591: OAuth 2.0 Dynamic Client Registration
- RFC 7009: OAuth 2.0 Token Revocation (served by Descope)

All OAuth schemas use Zod for runtime validation.

## Advanced Usage

### Legacy Authorization Server Mode (not recommended)

By default, this SDK runs as a Resource Server only. That’s the recommended path and aligns with the MCP 2025‑06‑18 spec. The features below are for legacy compatibility and testing. Enabling them exposes additional endpoints (/authorize, /register). Consider the added surface area before turning them on.

Requirements

- DESCOPE_PROJECT_ID and SERVER_URL
- DESCOPE_MANAGEMENT_KEY (required only when enabling Authorization Server features)

Example .env

```bash
DESCOPE_PROJECT_ID=your_project_id
SERVER_URL=http://localhost:3000
DESCOPE_MANAGEMENT_KEY=your_management_key
```

Configuration example

```typescript
import { DescopeMcpProvider } from "@descope/mcp-express";

const provider = new DescopeMcpProvider({
  projectId: process.env.DESCOPE_PROJECT_ID,
  serverUrl: process.env.SERVER_URL,
  authorizationServerOptions: {
    isDisabled: false, // enable Authorization Server mode
    enableAuthorizeEndpoint: true, // expose /authorize
    enableDynamicClientRegistration: true, // optionally expose /register
  },
  // Only needed if you enable dynamic client registration
  dynamicClientRegistrationOptions: {
    authPageUrl: `https://api.descope.com/login/${process.env.DESCOPE_PROJECT_ID}?flow=consent`,
    permissionScopes: [
      { name: "get-schema", description: "Allow getting the SQL schema" },
      { name: "run-query", description: "Allow executing a SQL query", required: false },
    ],
    nonConfidentialClient: true,
  },
});
```

Notes

- Dynamic Client Registration is a sub-feature of Legacy Authorization Server mode and is disabled by default. Only set `enableDynamicClientRegistration: true` and provide `dynamicClientRegistrationOptions` if you want to expose `/register`.

### Verify Token Options

```typescript
import { DescopeMcpProvider } from "@descope/mcp-express";

const provider = new DescopeMcpProvider({
  verifyTokenOptions: {
    requiredScopes: ["get-schema", "run-query"],
    // resourceIndicator: "your-resource", // optional
    // audience: "your-audience", // optional (single value supported currently)
  },
});
```

## Migrating from an existing MCP server

Already have a plain MCP server using `server.registerTool`? Here’s the simplest path:

1. Put your MCP behind Express

- Add JSON parsing: `app.use(express.json())`.
- Use `descopeMcpAuthRouter((server) => { /* register tools */ }, provider)`.
- The router exposes the required metadata endpoints and wires `POST /mcp` with bearer auth when you provide a registration function.

2. Wrap each existing tool

- Before (plain MCP):

```typescript
server.registerTool("whoami", { description: "Return identity" }, async (_args, _extra) => {
  const data = { ok: true };
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
```

- After (defineTool):

```typescript
const whoami = defineTool({
  name: "whoami",
  description: "Return identity",
  scopes: ["openid"],
  handler: async (extra) => {
    const data = { ok: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

app.use(
  descopeMcpAuthRouter((server) => {
    whoami(server);
  }, provider),
);
```

- After (registerAuthenticatedTool, without input):

```typescript
const whoami = registerAuthenticatedTool(
  "whoami",
  { description: "Return identity" },
  async (extra) => {
    const data = { ok: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
  ["openid"],
);
```

3. Remove custom wiring

- You no longer need to manage `StreamableHTTPServerTransport` or your own `/.well-known/*` endpoints. The router handles them.

4. Update handler signatures and return type as needed

- With input: `(args, extra) => CallToolResult`.
- Without input: `(extra) => CallToolResult`.
- Return `CallToolResult` as `{ content: [{ type: "text", text: "..." }] }`.

5. Optional: call external APIs on behalf of the user

- Use `extra.getOutboundToken(appId, scopes?)` to fetch outbound tokens.

If you can’t use the router, the lower-level pieces exist (`descopeMcpBearerAuth` and `createMcpServerHandler` on `POST /mcp`), but the router is the simplest and safest path.

## Migration from v0.0.x

- `/mcp` now uses `StreamableHTTPServerTransport` from the official MCP SDK.
- Tools are registered via `descopeMcpAuthRouter`.
- Authorization Server endpoints are disabled by default for security.

## Attribution

This SDK adapts code from the Model Context Protocol TypeScript SDK (MIT).

## License

MIT
