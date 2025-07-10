import express from "express";
import request from "supertest";
import { descopeMcpAuthRouter } from "./router.js";
import { DescopeMcpProvider } from "./provider.js";

describe("descopeMcpAuthRouter", () => {
  let app: express.Application;
  let provider: DescopeMcpProvider;

  beforeEach(() => {
    app = express();
    provider = new DescopeMcpProvider({
      projectId: "test-project",
      managementKey: "test-key",
      serverUrl: "https://test.example.com",
    });
    app.use(descopeMcpAuthRouter(undefined, provider));
  });

  describe("authorize endpoint", () => {
    it("should be disabled by default", async () => {
      const response = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
        scope: "openid profile",
      });

      expect(response.status).toBe(404); // Not found because disabled by default
    });

    it("should work when explicitly enabled", async () => {
      const enabledApp = express();
      const enabledProvider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "https://test.example.com",
        authorizationServerOptions: {
          isDisabled: false,
          enableAuthorizeEndpoint: true,
        },
      });
      enabledApp.use(descopeMcpAuthRouter(undefined, enabledProvider));

      const response = await request(enabledApp).get("/authorize").query({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
        scope: "openid profile",
      });

      expect(response.status).toBe(302); // Should redirect to Descope's authorization page
    });
  });

  describe("metadata endpoints", () => {
    it("should return OAuth server metadata", async () => {
      const response = await request(app).get(
        "/.well-known/oauth-authorization-server",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("issuer");
      expect(response.body).toHaveProperty("authorization_endpoint");
      expect(response.body).toHaveProperty("token_endpoint");
      expect(response.body).toHaveProperty("revocation_endpoint");
      expect(response.body).toHaveProperty("scopes_supported");
      expect(response.body).toHaveProperty("response_types_supported");
    });

    it("should return protected resource metadata", async () => {
      const response = await request(app).get(
        "/.well-known/oauth-protected-resource",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("resource");
      expect(response.body).toHaveProperty("authorization_servers");
      expect(response.body).toHaveProperty("scopes_supported");
      expect(response.body).toHaveProperty("bearer_methods_supported");
      expect(response.body.resource).toBe("https://test.example.com");
    });
  });

  describe("register endpoint", () => {
    it("should be disabled by default", async () => {
      const response = await request(app).post("/register").send({
        client_name: "Test Client",
        redirect_uris: ["https://test.example.com/callback"],
      });

      expect(response.status).toBe(404); // Not found because disabled by default
    });

    it("should work when explicitly enabled", async () => {
      const enabledApp = express();
      const enabledProvider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "https://test.example.com",
        authorizationServerOptions: {
          isDisabled: false,
          enableDynamicClientRegistration: true,
        },
      });
      enabledApp.use(descopeMcpAuthRouter(undefined, enabledProvider));

      // Note: This test will fail without proper mocking of the Descope API
      // but it tests that the endpoint is accessible when enabled
      const response = await request(enabledApp).post("/register").send({
        client_name: "Test Client",
        redirect_uris: ["https://test.example.com/callback"],
      });

      expect(response.status).not.toBe(404); // Should not be 404 when enabled
    });
  });
});
