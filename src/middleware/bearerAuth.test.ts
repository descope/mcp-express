import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import { descopeMcpBearerAuth } from "./bearerAuth.js";
import { DescopeMcpProvider } from "../provider.js";

// Mock the DescopeMcpProvider
const mockProvider = {
  serverUrl: "https://mcp-server.example.com",
  descope: {
    validateSession: jest.fn(),
  },
  options: {
    verifyTokenOptions: {
      audience: "test-audience",
      requiredScopes: ["openid"],
    },
  },
} as unknown as DescopeMcpProvider;

describe("descopeMcpBearerAuth", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(descopeMcpBearerAuth(mockProvider));
    app.get("/protected", (req, res) => {
      res.json({ message: "success" });
    });
    jest.clearAllMocks();
  });

  it("should include resource_metadata in WWW-Authenticate header on 401", async () => {
    const response = await request(app).get("/protected").expect(401);

    const wwwAuth = response.headers["www-authenticate"];
    expect(wwwAuth).toContain('error="invalid_token"');
    expect(wwwAuth).toContain(
      'error_description="Missing Authorization header"',
    );
    expect(wwwAuth).toContain(
      'resource_metadata="https://mcp-server.example.com/.well-known/oauth-protected-resource"',
    );
  });

  it("should include resource_metadata in WWW-Authenticate header on invalid token format", async () => {
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "InvalidFormat")
      .expect(401);

    const wwwAuth = response.headers["www-authenticate"];
    expect(wwwAuth).toContain('error="invalid_token"');
    expect(wwwAuth).toContain(
      'resource_metadata="https://mcp-server.example.com/.well-known/oauth-protected-resource"',
    );
  });

  it("should include resource_metadata in WWW-Authenticate header on insufficient scope", async () => {
    // Mock successful token validation but insufficient scopes
    (mockProvider.descope.validateSession as jest.Mock).mockResolvedValue({
      jwt: "valid-token",
      token: {
        aud: "test-audience",
        scope: "openid", // Missing required scope
        azp: "client-id",
        exp: Date.now() + 3600000,
      },
    });

    const modifiedProvider = {
      ...mockProvider,
      options: {
        verifyTokenOptions: {
          audience: "test-audience",
          requiredScopes: ["openid", "admin"], // Require admin scope
        },
      },
    } as unknown as DescopeMcpProvider;

    const testApp = express();
    testApp.use(descopeMcpBearerAuth(modifiedProvider));
    testApp.get("/protected", (req, res) => {
      res.json({ message: "success" });
    });

    const response = await request(testApp)
      .get("/protected")
      .set("Authorization", "Bearer valid-token")
      .expect(403);

    const wwwAuth = response.headers["www-authenticate"];
    expect(wwwAuth).toContain('error="insufficient_scope"');
    expect(wwwAuth).toContain(
      'resource_metadata="https://mcp-server.example.com/.well-known/oauth-protected-resource"',
    );
  });

  it("should succeed with valid token and sufficient scopes", async () => {
    // Mock successful token validation
    (mockProvider.descope.validateSession as jest.Mock).mockResolvedValue({
      jwt: "valid-token",
      token: {
        aud: "test-audience",
        scope: "openid profile",
        azp: "client-id",
        exp: Date.now() + 3600000,
      },
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-token")
      .expect(200);

    expect(response.body).toEqual({ message: "success" });
  });

  it("should validate resource indicator when configured", async () => {
    // Mock successful token validation with resource claim
    (mockProvider.descope.validateSession as jest.Mock).mockResolvedValue({
      jwt: "valid-token",
      token: {
        aud: "test-audience",
        scope: "openid",
        azp: "client-id",
        exp: Date.now() + 3600000,
        resource: "https://different-server.com", // Wrong resource
      },
    });

    const modifiedProvider = {
      ...mockProvider,
      options: {
        verifyTokenOptions: {
          audience: "test-audience",
          requiredScopes: ["openid"],
          resourceIndicator: "https://mcp-server.example.com",
        },
      },
    } as unknown as DescopeMcpProvider;

    const testApp = express();
    testApp.use(descopeMcpBearerAuth(modifiedProvider));
    testApp.get("/protected", (req, res) => {
      res.json({ message: "success" });
    });

    const response = await request(testApp)
      .get("/protected")
      .set("Authorization", "Bearer valid-token")
      .expect(401);

    const wwwAuth = response.headers["www-authenticate"];
    expect(wwwAuth).toContain('error="invalid_token"');
    expect(wwwAuth).toContain("Invalid token resource");
  });
});
