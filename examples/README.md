# MCP Express Example

A minimal example showing how to use authenticated MCP tools with Descope authentication.

## Quick Start

### 1. Environment Setup

Copy environment variables:

```bash
cp .env.example .env
```

Configure your Descope project:

```bash
# Required
DESCOPE_PROJECT_ID=your_project_id_here
SERVER_URL=http://localhost:3000
```

### Configure Descope Project

Enable Dynamic Client Registration (DCR) and configure scopes:

1. Go to [Descope Console](https://app.descope.com/apps/inbound)
2. Navigate to **Inbound App Settings**
3. Enable **Dynamic client registration**

Note: The example server uses `app.use(express.json())`. If you wire your own server, make sure to include JSON parsing so `/mcp` can read request bodies.

### 2. Run Example

```bash
npm run dev:examples
```

The server will start on `http://localhost:3000` with:

- **MCP Endpoint**: `POST /mcp` (requires authentication)
- **OAuth Metadata**: `GET /.well-known/oauth-authorization-server`
- **Protected Resource Metadata**: `GET /.well-known/oauth-protected-resource`

## Example Tool

The example includes a simple **greeting tool** that demonstrates:

- ✅ Authenticated tool registration
- ✅ Scope validation (`openid` required)
- ✅ User context access

## Usage

Call the tool via MCP protocol with a valid Descope access token:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "greeting",
      "arguments": {
        "name": "World"
      }
    }
  }'
```

This example demonstrates the core functionality of the `@descope/mcp-express` SDK.

## Next.js (Route Handler) Example

An example Next.js MCP route is provided under `examples/nextjs/app/api/mcp/route.ts`.

### Features

- Single API route exposing MCP tools over HTTP
- `withMcpAuth` wrapper for bearer token validation
- `defineTool` based tool registration (`status` tool)
- Optional outbound token exchange using the authenticated user's access token

### Environment Variables

Add these to your Next.js `.env.local`:

```
DESCOPE_PROJECT_ID=your_project_id
DESCOPE_BASE_URL=https://api.descope.com
```

### Status Tool

The `status` tool returns:

```json
{
  "server": "running",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "authenticatedUser": {
    "clientId": "...",
    "scopes": ["openid"]
  },
  "outboundTokenPresent": true,
  "outboundTokenPreview": "eyJhbGciOi..."
}
```

Anonymous calls return the same object with `authenticatedUser` null and no outbound token.

### Calling the Status Tool

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { "name": "status" }
  }'
```

### Outbound Token Exchange

The example attempts an outbound token exchange using audience `example-app`. Replace this string with an outbound application ID configured in your Descope project. Remove or modify scopes as required.

If outbound exchange fails (missing config, invalid audience, etc.), the tool continues and simply returns `outboundTokenPresent: false`.

