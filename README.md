# Descope MCP Express SDK

![Descope Banner](https://github.com/descope/.github/assets/32936811/d904d37e-e3fa-4331-9f10-2880bb708f64)

An Express.js middleware that adds secure authentication to your [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/) server using [Descope](https://www.descope.com/). Simply add bearer token authentication to your MCP endpoints with minimal setup.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [OAuth Implementation](#oauth-implementation)
- [Attribution](#attribution)
- [License](#license)

## Prerequisites

Before you begin, ensure you have:

- An existing [Descope](https://www.descope.com/) project
- An existing [Express](https://expressjs.com/en/starter/installing.html) application
- Node.js version `18.x` or higher

## Installation

```bash
npm install @descope/mcp-express
```

## Quick Start

1. Grab the **OAuth issuer URL** of your Descope MCP server / Inbound App from the [Descope Console](https://app.descope.com/). It looks like:

   - Agentic / MCP format: `https://api.descope.com/v1/apps/agentic/<projectId>/<mcpServerId>`
   - Classic Inbound App format: `https://api.descope.com/v1/apps/<projectId>`

2. Create a `.env` file in your project root:

```bash
DESCOPE_MCP_SERVER_ISSUER=https://api.descope.com/v1/apps/agentic/<projectId>/<mcpServerId>
SERVER_URL=your_mcp_server_url
```

> `SERVER_URL` is the public URL of your MCP server, e.g. `http://localhost:3000` or `https://mcp.example.com`. Project ID and base URL are auto-derived from the issuer URL.

3. Ensure that the environment variables are loaded, for example by using `dotenv`:

```bash
npm install dotenv
```

4. Then, you can use the SDK as follows:

```typescript
import "dotenv/config";
import express from "express";
import {
  descopeMcpAuthRouter,
  registerAuthenticatedTool,
  DescopeMcpProvider,
} from "@descope/mcp-express";
import { z } from "zod";

const app = express();

const provider = new DescopeMcpProvider({
  // Paste the OAuth issuer URL of your Descope MCP server / Inbound App.
  // Reads from DESCOPE_MCP_SERVER_ISSUER by default.
  issuer: process.env.DESCOPE_MCP_SERVER_ISSUER,
  serverUrl: process.env.SERVER_URL,
  // Scopes surfaced in /.well-known/oauth-protected-resource.
  scopesSupported: ["openid", "profile", "email"],
});

// Optional: Define MCP tools with authentication
const helloTool = registerAuthenticatedTool({
  name: "hello",
  description: "Say hello to the authenticated user",
  paramsSchema: {
    name: z.string().describe("Name to greet").optional(),
  },
  requiredScopes: ["openid"], // Basic authentication required
  execute: async ({ args, authInfo, getOutboundToken }) => {
    const name = args.name || "there";

    // Optional: Get outbound token for external API calls. No management key
    // required – the MCP access token is exchanged for the outbound token.
    // const externalToken = await getOutboundToken('external-app-id', ['read']);

    return {
      message: `Hello ${name}!`,
      authenticatedUser: authInfo.clientId,
    };
  },
});

// Setup MCP server with authentication and tools
app.use(
  descopeMcpAuthRouter((server) => {
    // Register your MCP tools here
    helloTool(server);
  }, provider),
);

app.listen(3000);
```

The `descopeMcpAuthRouter()` function:

- Adds the required MCP authentication endpoints
- Sets up the `/mcp` endpoint with bearer token validation
- Registers your MCP tools with built-in authentication

**Note:** This creates a complete MCP server with authentication and tool registration. The server validates tokens issued by Descope and provides secure access to your MCP tools.

**DescopeMcpProvider**: The provider handles all the OAuth 2.0 complexity including:

- Bearer token validation via JWKS (discovered from the issuer's OIDC metadata)
- MCP 2025-06-18 compliance (Protected Resource Metadata)
- OAuth server configuration and endpoints
- Scope validation and authentication context
- Outbound token exchange using the user's MCP access token (no management key required)

5. Add `auth` TypeScript type (optional)

If you're using TypeScript, you can add a type declaration to get proper type checking for the `auth` property that gets attached to the Express request object. Create a new file (e.g., `types/globals.d.ts`) and add:

```typescript
declare module "express-serve-static-core" {
  interface Request {
    /**
     * Information about the validated access token, if the `descopeMcpBearerAuth` middleware was used.
     * Contains user information and token details after successful authentication.
     */
    auth?: AuthInfo;
  }
}
```

This type declaration will:

- Enable TypeScript autocompletion for the `auth` property on request objects
- Provide type safety when accessing auth-related properties
- Help catch potential type-related errors during development

Example usage in your route handlers:

```typescript
app.post("/mcp", async (req, res) => {
  // TypeScript now knows about req.auth
  if (req.auth) {
    // Access auth properties with full type support
    console.log(req.auth.token);
    console.log(req.auth.scopes);
  }
});
```

## Advanced Usage

### Dynamic Client Registration

You can configure dynamic client registration options when initializing the provider:

```typescript
import express from "express";
import {
  descopeMcpAuthRouter,
  descopeMcpBearerAuth,
} from "@descope/mcp-express";

const app = express();

const provider = new DescopeMcpProvider({
  // The below values are defaults and can be omitted
  // if the environment variables are set and loaded
  projectId: process.env["DESCOPE_PROJECT_ID"],
  serverUrl: process.env["SERVER_URL"],

  dynamicClientRegistrationOptions: {
    authPageUrl: `https://api.descope.com/login/${DESCOPE_PROJECT_ID}?flow=consent`,
    permissionScopes: [
      {
        name: "get-schema",
        description: "Allow getting the SQL schema",
      },
      {
        name: "run-query",
        description: "Allow executing a SQL query",
        required: false,
      },
    ],
    nonConfidentialClient: true, // Set to true for public clients (no client secret)
  },
});

// Add metadata, route handlers, and MCP endpoint (eg. dynamic client registration)
app.use(descopeMcpAuthRouter(undefined, provider));

app.listen(3000);
```

### Token Verification

You can customize the token verification options by setting the `verifyTokenOptions` object:

```typescript
import { descopeMcpBearerAuth, DescopeMcpProvider } from "@descope/mcp-express";

const provider = new DescopeMcpProvider({
  verifyTokenOptions: {
    requiredScopes: ["get-schema", "run-query"],
    key: "descope-public-key",
  },
});
```

### Legacy Authorization Server Mode (Not Recommended)

By default, this SDK operates as a **Resource Server** only, which is the recommended and secure approach for MCP servers.

**⚠️ For Legacy/Testing Only:** If you're migrating from an older version or need to test OAuth flows directly, you can enable the legacy Authorization Server mode:

**Requirements:** You'll need to add `DESCOPE_MANAGEMENT_KEY` to your `.env` file - get this from your [Descope Management Keys](https://app.descope.com/settings/company/managementkeys).

```bash
DESCOPE_PROJECT_ID=your_project_id
DESCOPE_MANAGEMENT_KEY=your_management_key  # Required for Authorization Server features
SERVER_URL=your_mcp_server_url
```

```typescript
import { DescopeMcpProvider } from "@descope/mcp-express";

const provider = new DescopeMcpProvider({
  authorizationServerOptions: {
    isDisabled: false, // Enable Authorization Server endpoints
    enableAuthorizeEndpoint: true, // Enable /authorize endpoint
    enableDynamicClientRegistration: true, // Enable /register endpoint
  },
});
```

**⚠️ Not Recommended:** This exposes additional endpoints (`/authorize`, `/register`) that increase your attack surface. Only enable for legacy compatibility or testing purposes.

### Creating Authenticated MCP Tools

The SDK provides utilities for easily creating MCP tools with built-in authentication and scope validation:

```typescript
import {
  descopeMcpAuthRouter,
  registerAuthenticatedTool,
  DescopeMcpProvider,
} from "@descope/mcp-express";
import { z } from "zod";

const provider = new DescopeMcpProvider();

// Define a tool with specific scope requirements
const getUserTool = registerAuthenticatedTool({
  name: "get_user",
  description: "Get user information",
  paramsSchema: {
    userId: z.string().describe("The user ID to fetch"),
  },
  requiredScopes: ["profile", "email"], // Require specific scopes
  execute: async ({ args, authInfo, getOutboundToken }) => {
    // args: validated parameters from paramsSchema
    // authInfo: authenticated user information (scopes, clientId, etc.)
    // getOutboundToken: function to get external API tokens

    // Optional: Get outbound token for external API calls
    // const externalToken = await getOutboundToken('external-app-id', ['read']);

    return { userId: args.userId, scopes: authInfo.scopes };
  },
});

// Define a public tool (basic authentication required)
const publicTool = registerAuthenticatedTool({
  name: "public_info",
  description: "Get public information",
  paramsSchema: {},
  requiredScopes: ["openid"], // Basic authentication required
  execute: async ({ authInfo }) => ({ message: "Hello!" }),
});

// Define a profile tool (profile access required)
const profileTool = registerAuthenticatedTool({
  name: "get_profile",
  description: "Get user profile",
  paramsSchema: {},
  requiredScopes: ["openid", "profile"], // Profile access required
  execute: async ({ authInfo }) => ({ clientId: authInfo.clientId }),
});

// Register tools with your MCP server using the integrated approach
app.use(
  descopeMcpAuthRouter(
    (server) => {
      // Register all your MCP tools here
      getUserTool(server);
      publicTool(server);
      profileTool(server);
    },
    provider, // Use your configured provider
  ),
);
```

**Key Features:**

- ✅ **Automatic scope validation** - Tools automatically check required scopes
- ✅ **Type-safe parameters** - Zod schema validation for tool arguments
- ✅ **Auth context injection** - Access to authenticated user information
- ✅ **Clean separation of concerns** - Tools focus on business logic, not auth
- ✅ **Flexible scope configuration** - Define any required scopes for your tools

## Features

The SDK implements the [Model Context Protocol Auth Specification (MCP 2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization), providing:

### Always Enabled (Resource Server)

- 🛡️ **Protected Resource Metadata** (RFC 8705) - Required by MCP 2025-06-18
- 🔍 **Authorization Server Metadata** (RFC 8414) - For discovery
- 🔐 **MCP Server Endpoint** - `/mcp` with full MCP protocol support
- 🔒 **Bearer Token Authentication** - Validates access tokens
- 🔧 **Resource Indicator Support** (RFC 8707) - Prevents token misuse

### Optional (Authorization Server)

- 🔑 **Authorize endpoint** - Disabled by default
- 🎫 **Token endpoint** - Provided by Descope
- 🔄 **Token revocation endpoint** - Provided by Descope
- 📝 **Dynamic Client Registration** - Disabled by default

## OAuth Implementation

This SDK implements OAuth 2.0/2.1 following these RFCs:

### Resource Server (Always Enabled)

- [RFC 8705](https://datatracker.ietf.org/doc/html/rfc8705): OAuth 2.0 Protected Resource Metadata
- [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414): OAuth 2.0 Authorization Server Metadata
- [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707): Resource Indicators for OAuth 2.0

### Authorization Server (Optional)

- [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591): OAuth 2.0 Dynamic Client Registration
- [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009): OAuth 2.0 Token Revocation

All OAuth schemas are implemented using Zod for runtime type validation.

### OAuth 2.1 Compliance

This SDK follows OAuth 2.1 specification requirements. Notably, regarding scope handling (section 1.4.1):

> "If the client omits the scope parameter when requesting authorization, the authorization server MUST either process the request using a pre-defined default value or fail the request indicating an invalid scope. The authorization server SHOULD document its scope requirements and default value (if defined)."

By default, Descope handles requests with undefined scopes by returning default scopes, which is compliant with OAuth 2.1. When using the Authorization Server mode (not recommended), the SDK ensures consistency by explicitly setting the openid scope.

## Migration from v0.0.x

If upgrading from an earlier version:

1. The `/mcp` endpoint now uses the official MCP TypeScript SDK with `StreamableHTTPServerTransport`
2. MCP tools are now registered via the `descopeMcpAuthRouter` function rather than separately
3. Authorization Server endpoints (`/authorize`, `/register`) are now disabled by default for security
4. If you need the old Authorization Server behavior, see the [Legacy Authorization Server Mode](#legacy-authorization-server-mode-not-recommended) section

## Attribution

This SDK includes code adapted from the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), which is licensed under the MIT License.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
