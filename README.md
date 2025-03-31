# Descope MCP Express SDK
![Descope Banner](https://github.com/descope/.github/assets/32936811/d904d37e-e3fa-4331-9f10-2880bb708f64)

This is a Typescript-based Express library that leverages [Descope](https://www.descope.com/) auth and user management capabilities to allow you to easily add [Model Context Protocol (MCP) Specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/) compliant-Authorization to your MCP Server. It implements the provider side of the OAuth 2.1 protocol with PKCE support, Dynamic Client Registration, and Authorization Server Metadata.

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

1. Get your credentials from the Descope Console
   - [Project ID](https://app.descope.com/settings/project)
   - [Management Key](https://app.descope.com/settings/company/managementkeys)

2. Create a `.env` file in your project root:

```bash
DESCOPE_PROJECT_ID=your_project_id
DESCOPE_MANAGEMENT_KEY=your_management_key
SERVER_URL=your_mcp_server_url
```

> The `SERVER_URL` is the URL of your MCP Server.
> eg. `http://localhost:3000` or `https://mcp.example.com`

3. Ensure that the environment variables are loaded, for example by using `dotenv`:

```bash
npm install dotenv
```

4. Then, you can use the SDK as follows:

```typescript
import 'dotenv/config';
import express from 'express';
import { descopeMcpAuthRouter, descopeMcpBearerAuth } from '@descope/mcp-express';

const app = express();

app.use(descopeMcpAuthRouter());

app.use(["/sse", "/message"], descopeMcpBearerAuth());

app.listen(3000);
```

The `descopeMcpAuthRouter()` function adds the metadata and route handlers (eg. dynamic client registration) to the server while the `descopeMcpBearerAuth()` function checks the request's headers for a Bearer token and, if found, attaches the `Auth` object to the request object under the `auth` key.

## Advanced Usage Examples

### Dynamic Client Registration

You can configure dynamic client registration options when initializing the provider:

```typescript
import express from 'express';
import { descopeMcpAuthRouter, descopeMcpBearerAuth } from '@descope/mcp-express';

const app = express();

const provider = new DescopeMcpProvider({
  // The below values are defaults and can be omitted
  // if the environment variables are set and loaded
  projectId: process.env['DESCOPE_PROJECT_ID'],
  managementKey: process.env['DESCOPE_MANAGEMENT_KEY'], 
  serverUrl: process.env['SERVER_URL'],
  
  dynamicClientRegistrationOptions: {
    authPageUrl: `https://api.descope.com/login/${DESCOPE_PROJECT_ID}?flow=consent`,
    permissionScopes: [{
      name: "get-schema",
      description: "Allow getting the SQL schema"
    }, {
      name: "run-query",
      description: "Allow executing a SQL query",
      required: false,
    }]
  }
});

// Add metadata and route handlers (eg. dynamic client registration)
app.use(descopeMcpAuthRouter(provider));

// Add bearer token validation
app.use(
    ["/sse", "/message"],
    descopeMcpBearerAuth(provider)
);

app.listen(3000);
```

### Token Verification

You can customize the token verification options by setting the `verifyTokenOptions` object:

```typescript
import { descopeMcpBearerAuth, DescopeMcpProvider } from '@descope/mcp-express';

const provider = new DescopeMcpProvider({
  verifyTokenOptions: {
    requiredScopes: ["get-schema", "run-query"],
    key: "descope-public-key"
  }
});
```

## Features

The SDK implements the [Model Context Protocol Auth Specification](https://spec.modelcontextprotocol.io/), providing:

- 🔐 Hosted Metadata
- 🔑 Authorize endpoint
- 🎫 Token endpoint
- 🔒 Token revocation endpoint
- 📝 Dynamic Client Registration

## OAuth Implementation

This SDK implements OAuth 2.0/2.1 following these RFCs:

- [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414): OAuth 2.0 Authorization Server Metadata
- [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591): OAuth 2.0 Dynamic Client Registration
- [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009): OAuth 2.0 Token Revocation

All OAuth schemas are implemented using Zod for runtime type validation.

## Attribution

This SDK includes code adapted from the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), which is licensed under the MIT License.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
