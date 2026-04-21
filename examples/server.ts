import "dotenv/config";
import express from "express";
import { descopeMcpAuthRouter, DescopeMcpProvider } from "@descope/mcp-express";
import { greetingTool } from "./tools/greetingTool.js";

const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON and handling CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Descope MCP Provider.
//
// Minimal setup: paste the issuer URL of your Descope Inbound App and declare
// the scopes your MCP server supports. `projectId` and `baseUrl` are derived
// from the issuer URL automatically.
const provider = new DescopeMcpProvider({
  issuer: process.env.DESCOPE_MCP_SERVER_ISSUER,
  serverUrl: process.env.SERVER_URL,
  scopesSupported: ["openid", "profile", "email"],
  serviceDocumentationUrl: `${process.env.SERVER_URL}/docs`,
});

// Basic health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    server: "MCP Express Example Server",
  });
});

// Setup MCP router with authentication and tools
const mcpRouter = descopeMcpAuthRouter((server) => {
  greetingTool(server);

  console.log("Registered MCP tools:");
  console.log("  - greeting: Say hello to authenticated users");
}, provider);

app.use(mcpRouter);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start the server
app.listen(port, () => {
  console.log(`MCP Express Example Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  console.log(
    `Protected resource metadata: http://localhost:${port}/.well-known/oauth-protected-resource`,
  );

  console.log("\nConfiguration:");
  console.log(`  Issuer:        ${provider.issuer}`);
  console.log(`  Project ID:    ${provider.projectId}`);
  if (provider.mcpServerId) {
    console.log(`  MCP Server ID: ${provider.mcpServerId}`);
  }
  console.log(`  Base URL:      ${provider.baseUrl}`);
  console.log(`  Resource:      ${provider.resourceUrl}`);
});

export default app;
