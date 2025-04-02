import express from "express";
import request from "supertest";
import { authorizationHandler } from "./authorize.js";
import { DescopeMcpProvider } from "../provider.js";

describe("authorizationHandler", () => {
  let app: express.Application;
  let provider: DescopeMcpProvider;

  beforeEach(() => {
    app = express();
    provider = new DescopeMcpProvider({
      projectId: "test-project",
      managementKey: "test-key",
      serverUrl: "https://test.example.com",
    });
    app.use(authorizationHandler(provider));
  });

  describe("GET requests", () => {
    it("should redirect to Descope authorization URL with query parameters", async () => {
      const response = await request(app).get("/").query({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
        scope: "openid profile",
      });

      expect(response.status).toBe(302);
      const redirectUrl = new URL(response.header.location);
      expect(redirectUrl.origin).toBe("https://api.descope.com");
      expect(redirectUrl.pathname).toBe("/oauth2/v1/apps/authorize");
      expect(redirectUrl.searchParams.get("response_type")).toBe("code");
      expect(redirectUrl.searchParams.get("client_id")).toBe("test-client");
      expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
        "https://test.example.com/callback",
      );
      expect(redirectUrl.searchParams.get("scope")).toBe("openid profile");
    });

    it("should add default openid scope when no scope is provided", async () => {
      const response = await request(app).get("/").query({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
      });

      expect(response.status).toBe(302);
      const redirectUrl = new URL(response.header.location);
      expect(redirectUrl.searchParams.get("scope")).toBe("openid");
    });
  });

  describe("POST requests", () => {
    it("should handle POST requests with form data", async () => {
      const response = await request(app).post("/").type("form").send({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
        scope: "openid profile",
      });

      expect(response.status).toBe(302);
      const redirectUrl = new URL(response.header.location);
      expect(redirectUrl.origin).toBe("https://api.descope.com");
      expect(redirectUrl.pathname).toBe("/oauth2/v1/apps/authorize");
      expect(redirectUrl.searchParams.get("response_type")).toBe("code");
      expect(redirectUrl.searchParams.get("client_id")).toBe("test-client");
      expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
        "https://test.example.com/callback",
      );
      expect(redirectUrl.searchParams.get("scope")).toBe("openid profile");
    });

    it("should add default openid scope for POST requests when no scope is provided", async () => {
      const response = await request(app).post("/").type("form").send({
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "https://test.example.com/callback",
      });

      expect(response.status).toBe(302);
      const redirectUrl = new URL(response.header.location);
      expect(redirectUrl.searchParams.get("scope")).toBe("openid");
    });
  });

  describe("method restrictions", () => {
    it("should only allow GET and POST methods", async () => {
      await request(app).put("/").expect(405);

      await request(app).delete("/").expect(405);

      await request(app).patch("/").expect(405);
    });
  });

  describe("URL encoding", () => {
    it("should properly encode URL parameters", async () => {
      const response = await request(app).get("/").query({
        response_type: "code",
        client_id: "test-client",
        redirect_uri:
          "https://test.example.com/callback?param=value&special=!@#$%^&*()",
        scope: "openid profile",
      });

      expect(response.status).toBe(302);
      const redirectUrl = new URL(response.header.location);
      expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
        "https://test.example.com/callback?param=value&special=!@#$%^&*()",
      );
    });
  });
});
