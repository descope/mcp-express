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

An example Next.js MCP route is provided under `examples/nextjs/app/mcp/route.ts` (note: no `api/` segment). It uses low-level registration (`server.registerTool`) mirroring how you would integrate with `@descope/mcp-core` primitives.

### Features

- Single route exposing MCP tools over HTTP
- `withMcpAuth` wrapper for bearer token validation
- Direct `server.registerTool` usage (not `defineTool`) for the `status` tool
- Outbound token exchange attempt via a token manager (`example-app` audience)
- Separate protected resource metadata route at `examples/nextjs/app/.well-known/oauth-protected-resource/route.ts`

### Environment Variables

Add these to your Next.js `.env.local`:

```
DESCOPE_PROJECT_ID=your_project_id
DESCOPE_BASE_URL=https://api.descope.com
```

### Status Tool

The `status` tool (in the Next.js example) validates the caller has the `openid` scope, then attempts an outbound token exchange for audience `example-app` with scope `app:read`. Its raw return payload is the serialized outbound token result (or `null`) – intentionally minimal so you can shape your own response.

Example successful (truncated) response body content:

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "app:read"
}
```

If the user lacks required scopes or the exchange fails, the tool returns `null`.

### Calling the Status Tool

```bash
curl -X POST http://localhost:3000/mcp \
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

Replace `example-app` with an outbound application ID configured in your Descope project. Adjust scopes (`["app:read"]`) as required. A `null` result means exchange failed or user/session invalid; decide whether to treat that as soft or hard failure.

### Protected Resource Metadata Route

The Next.js example also includes a protected resource metadata route at:

`examples/nextjs/app/.well-known/oauth-protected-resource/route.ts`

It publishes OAuth 2.0 Protected Resource Metadata (RFC 8705) required by compliant MCP agents.

