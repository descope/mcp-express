# MCP Express Example Server

This is a complete example implementation of an MCP (Model Context Protocol) server using the `@descope/mcp-express` SDK. It demonstrates authentication, tool registration, and outbound token functionality.

## Features

- 🔐 **OAuth 2.0 Authentication** with Descope
- 🛠️ **MCP Protocol Compliance** (2025-06-18 specification)
- 🎯 **Authenticated Tool Registration** with scope validation
- 🔗 **Outbound Token Exchange** for external API calls
- 📊 **Multiple Tool Examples** demonstrating different patterns
- 🛡️ **Resource Server Mode** (secure by default)

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- A Descope project (free at [descope.com](https://descope.com))
- Your Descope Project ID

### 2. Setup

1. **Clone and install dependencies:**
   ```bash
   # From the examples directory
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file:**
   ```bash
   # Required
   DESCOPE_PROJECT_ID=your_project_id_here
   SERVER_URL=http://localhost:3000
   
   # Optional
   PORT=3000
   NODE_ENV=development
   ```

### 3. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

### 4. Test the Server

The server will start on `http://localhost:3000` and provide:

- **Health Check**: `GET /health`
- **MCP Endpoint**: `POST /mcp` (requires authentication)
- **OAuth Metadata**: `GET /.well-known/oauth-authorization-server`
- **Protected Resource Metadata**: `GET /.well-known/oauth-protected-resource`

## Available Tools

### 1. Greeting Tool (`greeting`)
- **Description**: Simple authenticated greeting with optional personalization
- **Required Scopes**: `openid`
- **Parameters**: 
  - `name` (optional): Name to greet
  - `includeTime` (optional): Include current time in greeting

### 2. User Info Tool (`user_info`)
- **Description**: Get detailed information about the authenticated user
- **Required Scopes**: `openid`, `profile`
- **Parameters**:
  - `includeTokenInfo` (optional): Include token expiration info

### 3. External API Tool (`external_api`)
- **Description**: Demonstrate outbound token exchange for external API access
- **Required Scopes**: `openid`, `profile`
- **Parameters**:
  - `appId`: The outbound application ID configured in Descope
  - `scopes` (optional): Scopes to request for the outbound token
  - `dryRun` (optional): Only get the token without making an API call

### 4. Weather Tool (`weather`)
- **Description**: Get weather information using external weather API
- **Required Scopes**: `openid`, `profile`
- **Parameters**:
  - `location`: City name or location to get weather for
  - `weatherAppId` (optional): The outbound application ID for weather API access
  - `units` (optional): Temperature units (metric/imperial/kelvin)

## Authentication Flow

This server operates in **Resource Server mode** by default, which means:

1. **Client Authentication**: Clients must obtain access tokens from Descope
2. **Token Validation**: The server validates tokens using Descope's public keys
3. **Scope Enforcement**: Each tool can require specific scopes
4. **Outbound Tokens**: Tools can exchange user tokens for external API access

## Testing with MCP Clients

### Using curl

1. **Get an access token from Descope** (through your application's auth flow)

2. **Call the MCP endpoint:**
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
           "name": "World",
           "includeTime": true
         }
       }
     }'
   ```

### Using MCP Client Libraries

The server implements the full MCP protocol and can be used with any MCP client library. See the [MCP documentation](https://spec.modelcontextprotocol.io/) for client implementation details.

## Configuration Options

### Environment Variables

- `DESCOPE_PROJECT_ID`: Your Descope project ID (required)
- `SERVER_URL`: The URL where your server is accessible (required)
- `DESCOPE_BASE_URL`: Custom Descope base URL (optional, defaults to https://api.descope.com)
- `PORT`: Server port (optional, defaults to 3000)
- `NODE_ENV`: Environment (development/production)

### Authorization Server Mode (Advanced)

To enable Authorization Server endpoints (`/authorize`, `/register`):

```bash
# Add to .env
ENABLE_AUTH_SERVER=true
DESCOPE_MANAGEMENT_KEY=your_management_key_here
```

⚠️ **Note**: Authorization Server mode is not recommended for production MCP servers as it increases attack surface.

## Development

### Project Structure

```
examples/
├── server.ts           # Main server implementation
├── tools/              # MCP tool implementations
│   ├── greetingTool.ts
│   ├── userInfoTool.ts
│   ├── externalApiTool.ts
│   └── weatherTool.ts
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── .env.example        # Environment variables template
└── README.md          # This file
```

### Adding New Tools

1. Create a new tool file in `tools/`:
   ```typescript
   import { registerAuthenticatedTool } from "@descope/mcp-express";
   import { z } from "zod";

   export const myTool = registerAuthenticatedTool({
     name: "my_tool",
     description: "Description of what this tool does",
     paramsSchema: {
       param1: z.string().describe("Parameter description"),
     },
     requiredScopes: ["openid", "custom_scope"],
     execute: async ({ args, authInfo, getOutboundToken }) => {
       // Tool implementation
       return { result: "success" };
     },
   });
   ```

2. Register the tool in `server.ts`:
   ```typescript
   import { myTool } from "./tools/myTool.js";

   app.use(descopeMcpAuthRouter(
     (server) => {
       // ... existing tools
       myTool(server);
     },
     provider
   ));
   ```

## Troubleshooting

### Common Issues

1. **"DESCOPE_PROJECT_ID is not set"**
   - Make sure you've copied `.env.example` to `.env`
   - Add your actual Descope Project ID to the `.env` file

2. **"Authentication required but no auth info provided"**
   - Ensure you're sending a valid `Authorization: Bearer <token>` header
   - Verify the token is not expired

3. **"Missing required scopes"**
   - Check that your access token includes the required scopes for the tool
   - Review your Descope project's scope configuration

4. **"Outbound token configuration not provided"**
   - Ensure you've configured outbound applications in your Descope project
   - Check that the `appId` parameter matches your Descope configuration

### Getting Help

- Check the [Descope documentation](https://docs.descope.com)
- Review the [MCP specification](https://spec.modelcontextprotocol.io/)
- Open an issue on the [GitHub repository](https://github.com/descope/mcp-express)

## License

This example is licensed under the MIT License.