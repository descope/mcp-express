import express from "express";
import request from "supertest";
import { metadataHandler } from "./metadata.js";
import { DescopeMcpProvider } from "../provider.js";

describe("metadataHandler", () => {
  let app: express.Application;
  let provider: DescopeMcpProvider;

  beforeEach(() => {
    app = express();
    provider = new DescopeMcpProvider({
      projectId: "test-project",
      managementKey: "test-key",
      serverUrl: "https://test.example.com",
    });
    app.use(metadataHandler(provider));
  });

  it("should return correct metadata structure", async () => {
    const response = await request(app).get("/").expect(200);

    const metadata = response.body;

    // Check required fields
    expect(metadata).toHaveProperty(
      "issuer",
      "https://api.descope.com/test-project",
    );
    expect(metadata).toHaveProperty(
      "authorization_endpoint",
      "https://test.example.com/authorize",
    );
    expect(metadata).toHaveProperty(
      "token_endpoint",
      "https://api.descope.com/oauth2/v1/apps/token",
    );
    expect(metadata).toHaveProperty(
      "revocation_endpoint",
      "https://api.descope.com/oauth2/v1/apps/revoke",
    );
    expect(metadata).toHaveProperty(
      "registration_endpoint",
      "https://test.example.com/register",
    );
    expect(metadata).toHaveProperty("response_types_supported", ["code"]);
    expect(metadata).toHaveProperty("code_challenge_methods_supported", [
      "S256",
    ]);
    expect(metadata).toHaveProperty("token_endpoint_auth_methods_supported", [
      "client_secret_post",
    ]);
    expect(metadata).toHaveProperty("grant_types_supported", [
      "authorization_code",
      "refresh_token",
    ]);
    expect(metadata).toHaveProperty(
      "revocation_endpoint_auth_methods_supported",
      ["client_secret_post"],
    );
    expect(metadata).toHaveProperty("scopes_supported");
  });

  it("should include default scopes", async () => {
    const response = await request(app).get("/").expect(200);

    const metadata = response.body;
    expect(metadata.scopes_supported).toContain("openid");
    expect(metadata.scopes_supported).toContain("profile"); // from default attribute scopes
  });

  it("should include custom scopes when provided", async () => {
    const customProvider = new DescopeMcpProvider({
      projectId: "test-project",
      managementKey: "test-key",
      serverUrl: "https://test.example.com",
      dynamicClientRegistrationOptions: {
        attributeScopes: [
          {
            name: "custom",
            description: "Custom scope",
            required: false,
            attributes: ["attr1", "attr2"],
          },
        ],
        permissionScopes: [
          {
            name: "admin",
            description: "Admin scope",
            required: false,
          },
        ],
      },
    });

    const customApp = express();
    customApp.use(metadataHandler(customProvider));

    const response = await request(customApp).get("/").expect(200);

    const metadata = response.body;
    expect(metadata.scopes_supported).toContain("custom");
    expect(metadata.scopes_supported).toContain("admin");
  });

  it("should disable registration endpoint when configured", async () => {
    const disabledProvider = new DescopeMcpProvider({
      projectId: "test-project",
      managementKey: "test-key",
      serverUrl: "https://test.example.com",
      dynamicClientRegistrationOptions: {
        isDisabled: true,
      },
    });

    const disabledApp = express();
    disabledApp.use(metadataHandler(disabledProvider));

    const response = await request(disabledApp).get("/").expect(200);

    const metadata = response.body;
    expect(metadata).not.toHaveProperty("registration_endpoint");
  });

  it("should include service documentation URL when provided", async () => {
    const customProvider = new DescopeMcpProvider({
      projectId: "test-project",
      managementKey: "test-key",
      serverUrl: "https://test.example.com",
      serviceDocumentationUrl: "https://docs.example.com",
    });

    const customApp = express();
    customApp.use(metadataHandler(customProvider));

    const response = await request(customApp).get("/").expect(200);

    const metadata = response.body;
    expect(metadata).toHaveProperty(
      "service_documentation",
      "https://docs.example.com",
    );
  });

  it("should only allow GET method", async () => {
    await request(app).post("/").expect(405);

    await request(app).put("/").expect(405);

    await request(app).delete("/").expect(405);
  });

  it("should allow CORS requests", async () => {
    const response = await request(app)
      .get("/")
      .set("Origin", "https://example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });
});
