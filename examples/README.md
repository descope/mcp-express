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

### 2. Run Example

```bash
# From the main project directory
npm run dev
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
