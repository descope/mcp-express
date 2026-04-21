#!/usr/bin/env node

// Set default environment variables for development.
// Use a placeholder Descope MCP server issuer URL; override by exporting
// DESCOPE_MCP_SERVER_ISSUER in your shell or via a `.env` file.
process.env.DESCOPE_MCP_SERVER_ISSUER =
  process.env.DESCOPE_MCP_SERVER_ISSUER ||
  "https://api.descope.com/v1/apps/agentic/P2v9EBlmO4XTrOwMRfsY1jeUONxU/MS37N1EnKXeJzg1OGrkvLgkcBZkqp";
process.env.SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
process.env.PORT = process.env.PORT || "3000";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

import("./server.ts");
