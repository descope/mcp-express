#!/usr/bin/env node

// Test script to verify MCP server functionality
// This simulates what MCP Inspector would do

const testMcpConnection = async () => {
  const baseUrl = "http://localhost:3000";

  console.log("🔍 Testing MCP Server Connection...\n");

  // Test 1: Check if server is running
  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log("✅ Health Check:", healthData);
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    return;
  }

  // Test 2: Check OAuth metadata
  try {
    const oauthResponse = await fetch(
      `${baseUrl}/.well-known/oauth-authorization-server`
    );
    const oauthData = await oauthResponse.json();
    console.log("✅ OAuth Metadata:", {
      issuer: oauthData.issuer,
      authorization_endpoint: oauthData.authorization_endpoint,
      scopes_supported: oauthData.scopes_supported,
    });
  } catch (error) {
    console.error("❌ OAuth metadata failed:", error.message);
  }

  // Test 3: Check protected resource metadata
  try {
    const resourceResponse = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource`
    );
    const resourceData = await resourceResponse.json();
    console.log("✅ Protected Resource Metadata:", {
      resource: resourceData.resource,
      authorization_servers: resourceData.authorization_servers,
      scopes_supported: resourceData.scopes_supported,
    });
  } catch (error) {
    console.error("❌ Protected resource metadata failed:", error.message);
  }

  console.log("\n📋 MCP Inspector Configuration:");
  console.log("URL: http://localhost:3000/mcp");
  console.log("Auth Type: Bearer Token");
  console.log(
    "Authorization Server: https://api.descope.com/v1/apps/P2OkfVnJi5Ht7mpCqHjx17nV5epH"
  );
  console.log("Required Scopes: openid, profile");
  console.log("\n💡 To connect with MCP Inspector:");
  console.log("1. Get an access token from your Descope project");
  console.log("2. Use the token in Authorization header: Bearer <token>");
  console.log("3. Configure MCP Inspector with the above settings");
};

testMcpConnection().catch(console.error);
