import request from "supertest";
import express from "express";
import { protectedResourceHandler } from "./protectedResource.js";
import { DescopeMcpProvider } from "../provider.js";

// Mock the DescopeMcpProvider
const mockProvider = {
  serverUrl: "https://mcp-server.example.com",
  resourceUrl: "https://mcp-server.example.com/mcp",
  issuer: "https://api.descope.com/v1/apps/test-project",
  descopeOAuthEndpoints: {
    issuer: new URL("https://api.descope.com/v1/apps/test-project"),
  },
  options: {
    serviceDocumentationUrl: "https://docs.example.com",
    dynamicClientRegistrationOptions: {
      attributeScopes: [
        { name: "profile", description: "Profile access" },
        { name: "email", description: "Email access" },
      ],
      permissionScopes: [{ name: "admin", description: "Admin permissions" }],
    },
  },
} as DescopeMcpProvider;

describe("protectedResourceHandler", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(
      "/.well-known/oauth-protected-resource",
      protectedResourceHandler(mockProvider),
    );
  });

  it("should return protected resource metadata", async () => {
    const response = await request(app)
      .get("/.well-known/oauth-protected-resource")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body).toEqual({
      resource: "https://mcp-server.example.com/mcp",
      authorization_servers: ["https://api.descope.com/v1/apps/test-project"],
      scopes_supported: ["openid", "profile", "email", "admin"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://docs.example.com",
    });
  });

  it("should set CORS headers", async () => {
    const response = await request(app)
      .get("/.well-known/oauth-protected-resource")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("should only allow GET method", async () => {
    await request(app)
      .post("/.well-known/oauth-protected-resource")
      .expect(405);

    await request(app).put("/.well-known/oauth-protected-resource").expect(405);

    await request(app)
      .delete("/.well-known/oauth-protected-resource")
      .expect(405);
  });

  it("should work without optional configuration", async () => {
    const minimalProvider = {
      serverUrl: "https://mcp-server.example.com",
      resourceUrl: "https://mcp-server.example.com/mcp",
      issuer: "https://api.descope.com/v1/apps/test-project",
      descopeOAuthEndpoints: {
        issuer: new URL("https://api.descope.com/v1/apps/test-project"),
      },
      options: {},
    } as DescopeMcpProvider;

    const minimalApp = express();
    minimalApp.use(
      "/.well-known/oauth-protected-resource",
      protectedResourceHandler(minimalProvider),
    );

    const response = await request(minimalApp)
      .get("/.well-known/oauth-protected-resource")
      .expect(200);

    expect(response.body).toEqual({
      resource: "https://mcp-server.example.com/mcp",
      authorization_servers: ["https://api.descope.com/v1/apps/test-project"],
      scopes_supported: ["openid"],
      bearer_methods_supported: ["header"],
    });
  });

  it("should honor explicit scopesSupported and resource overrides", async () => {
    const customProvider = {
      serverUrl: "https://mcp-server.example.com",
      resourceUrl: "https://mcp-server.example.com/mcp",
      issuer: "https://issuer.example.com/v1/apps/custom",
      descopeOAuthEndpoints: {
        issuer: new URL("https://api.descope.com/v1/apps/should-be-ignored"),
      },
      options: {
        scopesSupported: ["openid", "calendar:read", "calendar:write"],
        serviceDocumentationUrl: "https://mcp-server.example.com/docs",
      },
    } as DescopeMcpProvider;

    const customApp = express();
    customApp.use(
      "/.well-known/oauth-protected-resource",
      protectedResourceHandler(customProvider),
    );

    const response = await request(customApp)
      .get("/.well-known/oauth-protected-resource")
      .expect(200);

    expect(response.body).toEqual({
      resource: "https://mcp-server.example.com/mcp",
      authorization_servers: ["https://issuer.example.com/v1/apps/custom"],
      scopes_supported: ["openid", "calendar:read", "calendar:write"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://mcp-server.example.com/docs",
    });
  });
});
