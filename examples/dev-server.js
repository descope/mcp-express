#!/usr/bin/env node

// Set default environment variables for development
process.env.DESCOPE_PROJECT_ID =
  process.env.DESCOPE_PROJECT_ID || "P30dDCoPXqfaAwNkt0BpvFWXTnM2";
process.env.SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
process.env.DESCOPE_BASE_URL =
  process.env.DESCOPE_BASE_URL || "https://api.descope.com";
process.env.ENABLE_AUTH_SERVER = process.env.ENABLE_AUTH_SERVER || "false";
process.env.PORT = process.env.PORT || "3000";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

// Import and run the server
import("./server.ts");
