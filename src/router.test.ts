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
    app.use(descopeMcpAuthRouter(provider));
  });

  describe("authorize endpoint", () => {
    it("should handle authorize requests", async () => {
      const response = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
        scope: "openid profile",
      });

      expect(response.status).toBe(302); // Should redirect to Descope's authorization page
    });

    it("should handle missing scope parameter", async () => {
      const response = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
      });

      expect(response.status).toBe(302); // Should still redirect with default scope
    });
  });

  describe("metadata endpoint", () => {
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
  });
});
