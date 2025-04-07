import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { registrationHandler } from "./register.js";
import { DescopeMcpProvider } from "../provider.js";

// Mock fetch
const mockFetch = jest
  .fn()
  .mockImplementation(() => Promise.resolve(new Response()));
global.fetch = mockFetch as typeof global.fetch;

describe("registrationHandler", () => {
  let app: express.Application;
  let provider: DescopeMcpProvider;

  beforeEach(() => {
    app = express();
    provider = new DescopeMcpProvider({
      projectId: "test-project",
      managementKey: "test-key",
      serverUrl: "https://test.example.com",
    });
    app.use(registrationHandler(provider));
    mockFetch.mockReset();
  });

  describe("successful registration", () => {
    const validClientMetadata = {
      client_name: "Test Client",
      redirect_uris: ["https://test.example.com/callback"],
      logo_uri: "https://test.example.com/logo.png",
    };

    beforeEach(() => {
      // Mock successful app creation
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "test-app-id",
              cleartext: "test-secret",
            }),
        }),
      );

      // Mock successful app loading
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              clientId: "test-client-id",
            }),
        }),
      );
    });

    it("should register a client with valid metadata", async () => {
      const response = await request(app)
        .post("/")
        .send(validClientMetadata)
        .expect(201);

      const clientInfo = response.body;
      expect(clientInfo).toHaveProperty("client_id", "test-client-id");
      expect(clientInfo).toHaveProperty(
        "client_name",
        validClientMetadata.client_name,
      );
      expect(clientInfo).toHaveProperty(
        "redirect_uris",
        validClientMetadata.redirect_uris,
      );
      expect(clientInfo).toHaveProperty(
        "logo_uri",
        validClientMetadata.logo_uri,
      );

      // Verify fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://api.descope.com/v1/mgmt/thirdparty/app/create",
      );
      expect(mockFetch.mock.calls[1][0]).toBe(
        "https://api.descope.com/v1/mgmt/thirdparty/app/load?id=test-app-id",
      );
    });
  });

  describe("error handling", () => {
    it("should handle invalid request body", async () => {
      const response = await request(app)
        .post("/")
        .send("invalid json")
        .expect(400);

      expect(response.body.error).toBe("invalid_client_metadata");
    });

    it("should handle invalid client metadata", async () => {
      const response = await request(app)
        .post("/")
        .send({
          // Missing required fields
          logo_uri: "https://test.example.com/logo.png",
        })
        .expect(400);

      expect(response.body.error).toBe("invalid_client_metadata");
    });

    it("should handle server errors during app creation", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              errorDescription: "Internal server error",
              errorCode: "INTERNAL_ERROR",
            }),
        }),
      );

      const response = await request(app)
        .post("/")
        .send({
          client_name: "Test Client",
          redirect_uris: ["https://test.example.com/callback"],
        })
        .expect(500);

      expect(response.body.error).toBe("server_error");
      expect(response.body.error_description).toContain("Failed to create app");
    });

    it("should handle server errors during app loading", async () => {
      // Mock successful app creation
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "test-app-id",
              cleartext: "test-secret",
            }),
        }),
      );

      // Mock failed app loading
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              errorDescription: "Internal server error",
              errorCode: "INTERNAL_ERROR",
            }),
        }),
      );

      const response = await request(app)
        .post("/")
        .send({
          client_name: "Test Client",
          redirect_uris: ["https://test.example.com/callback"],
        })
        .expect(500);

      expect(response.body.error).toBe("server_error");
      expect(response.body.error_description).toContain("Failed to load app");
    });
  });

  describe("method restrictions", () => {
    it("should only allow POST method", async () => {
      await request(app).get("/").expect(405);

      await request(app).put("/").expect(405);

      await request(app).delete("/").expect(405);
    });
  });

  describe("CORS", () => {
    it("should allow CORS requests", async () => {
      const response = await request(app)
        .post("/")
        .set("Origin", "https://example.com")
        .send({
          client_name: "Test Client",
          redirect_uris: ["https://test.example.com/callback"],
        });

      expect(response.headers["access-control-allow-origin"]).toBe("*");
    });
  });
});
