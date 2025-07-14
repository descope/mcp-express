import "dotenv/config";
import express from "express";
import { descopeMcpAuthRouter, DescopeMcpProvider } from "@descope/mcp-express";
import { greetingTool } from "./tools/greetingTool.js";

const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON and handling CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Descope MCP Provider
const provider = new DescopeMcpProvider({
  projectId: process.env.DESCOPE_PROJECT_ID,
  serverUrl: process.env.SERVER_URL,
  baseUrl: process.env.DESCOPE_BASE_URL,
  // Optional: Enable Authorization Server endpoints for testing
  authorizationServerOptions: {
    isDisabled: process.env.ENABLE_AUTH_SERVER === "true" ? false : true,
    enableAuthorizeEndpoint: process.env.ENABLE_AUTH_SERVER === "true",
    enableDynamicClientRegistration: process.env.ENABLE_AUTH_SERVER === "true",
  },
});

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    server: "MCP Express Example Server",
  });
});

// Setup MCP router with authentication and tools
const mcpRouter = descopeMcpAuthRouter((server) => {
  // Register example tool
  greetingTool(server);

  console.log("✅ Registered MCP tools:");
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
  console.log(`🚀 MCP Express Example Server is running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🔐 MCP endpoint: http://localhost:${port}/mcp`);
  console.log(
    `📜 OAuth metadata: http://localhost:${port}/.well-known/oauth-authorization-server`,
  );
  console.log(
    `🛡️  Protected resource metadata: http://localhost:${port}/.well-known/oauth-protected-resource`,
  );

  if (process.env.ENABLE_AUTH_SERVER === "true") {
    console.log(
      `🔑 Authorization endpoint: http://localhost:${port}/authorize`,
    );
    console.log(`📝 Client registration: http://localhost:${port}/register`);
  }

  console.log("\n📖 Configuration:");
  console.log(`   Project ID: ${process.env.DESCOPE_PROJECT_ID || "NOT SET"}`);
  console.log(`   Server URL: ${process.env.SERVER_URL || "NOT SET"}`);
  console.log(`   Base URL: ${process.env.DESCOPE_BASE_URL || "DEFAULT"}`);
  console.log(
    `   Auth Server: ${process.env.ENABLE_AUTH_SERVER === "true" ? "ENABLED" : "DISABLED"}`,
  );
});

export default app;
