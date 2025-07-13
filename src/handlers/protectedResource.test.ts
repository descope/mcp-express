import request from "supertest";
import express from "express";
import { protectedResourceHandler } from "./protectedResource.js";
import { DescopeMcpProvider } from "../provider.js";

// Mock the DescopeMcpProvider
const mockProvider = {
  serverUrl: "https://mcp-server.example.com",
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
      permissionScopes: [
        { name: "admin", description: "Admin permissions" },
      ],
    },
  },
} as DescopeMcpProvider;

describe("protectedResourceHandler", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use("/.well-known/oauth-protected-resource", protectedResourceHandler(mockProvider));
  });

  it("should return protected resource metadata", async () => {
    const response = await request(app)
      .get("/.well-known/oauth-protected-resource")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body).toEqual({
      resource: "https://mcp-server.example.com",
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

    await request(app)
      .put("/.well-known/oauth-protected-resource")
      .expect(405);

    await request(app)
      .delete("/.well-known/oauth-protected-resource")
      .expect(405);
  });

  it("should work without optional configuration", async () => {
    const minimalProvider = {
      serverUrl: "https://mcp-server.example.com",
      descopeOAuthEndpoints: {
        issuer: new URL("https://api.descope.com/v1/apps/test-project"),
      },
      options: {},
    } as DescopeMcpProvider;

    const minimalApp = express();
    minimalApp.use("/.well-known/oauth-protected-resource", protectedResourceHandler(minimalProvider));

    const response = await request(minimalApp)
      .get("/.well-known/oauth-protected-resource")
      .expect(200);

    expect(response.body).toEqual({
      resource: "https://mcp-server.example.com",
      authorization_servers: ["https://api.descope.com/v1/apps/test-project"],
      scopes_supported: ["openid"],
      bearer_methods_supported: ["header"],
    });
  });
});