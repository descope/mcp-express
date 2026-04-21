import { DescopeMcpProvider } from "./provider.js";
import { readEnv } from "./provider.js";

describe("DescopeMcpProvider", () => {
  describe("constructor", () => {
    it("should initialize with required parameters", () => {
      const provider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "https://test.example.com",
      });

      expect(provider.projectId).toBe("test-project");
      expect(provider.managementKey).toBe("test-key");
      expect(provider.serverUrl).toBe("https://test.example.com");
      expect(provider.baseUrl).toBe("https://api.descope.com"); // default value
    });

    it("should throw error when projectId is missing", () => {
      expect(
        () =>
          new DescopeMcpProvider({
            managementKey: "test-key",
            serverUrl: "https://test.example.com",
          }),
      ).toThrow(
        "DESCOPE_PROJECT_ID (or DESCOPE_MCP_SERVER_ISSUER) is not set.",
      );
    });

    it("should not require managementKey by default", () => {
      expect(
        () =>
          new DescopeMcpProvider({
            projectId: "test-project",
            serverUrl: "https://test.example.com",
          }),
      ).not.toThrow();
    });

    it("should require managementKey when Authorization Server is enabled", () => {
      expect(
        () =>
          new DescopeMcpProvider({
            projectId: "test-project",
            serverUrl: "https://test.example.com",
            authorizationServerOptions: {
              isDisabled: false,
            },
          }),
      ).toThrow(
        "DESCOPE_MANAGEMENT_KEY is required when Authorization Server features are enabled.",
      );
    });

    it("should throw error when serverUrl is missing", () => {
      expect(
        () =>
          new DescopeMcpProvider({
            projectId: "test-project",
            managementKey: "test-key",
          }),
      ).toThrow("SERVER_URL is not set.");
    });

    it("should use custom baseUrl when provided", () => {
      const provider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "https://test.example.com",
        baseUrl: "https://custom.descope.com",
      });

      expect(provider.baseUrl).toBe("https://custom.descope.com");
    });

    it("should derive projectId and baseUrl from a classic issuer URL", () => {
      const provider = new DescopeMcpProvider({
        issuer: "https://api.descope.com/v1/apps/P2v9EBlmO4XTrOwMRfsY1jeUONxU",
        serverUrl: "https://test.example.com",
      });

      expect(provider.projectId).toBe("P2v9EBlmO4XTrOwMRfsY1jeUONxU");
      expect(provider.baseUrl).toBe("https://api.descope.com");
      expect(provider.issuer).toBe(
        "https://api.descope.com/v1/apps/P2v9EBlmO4XTrOwMRfsY1jeUONxU",
      );
      expect(provider.mcpServerId).toBeUndefined();
    });

    it("should derive projectId and mcpServerId from an agentic issuer URL", () => {
      const provider = new DescopeMcpProvider({
        issuer:
          "https://api.descope.com/v1/apps/agentic/P2v9EBlmO4XTrOwMRfsY1jeUONxU/MS37N1EnKXeJzg1OGrkvLgkcBZkqp",
        serverUrl: "https://test.example.com",
      });

      expect(provider.projectId).toBe("P2v9EBlmO4XTrOwMRfsY1jeUONxU");
      expect(provider.mcpServerId).toBe("MS37N1EnKXeJzg1OGrkvLgkcBZkqp");
      expect(provider.baseUrl).toBe("https://api.descope.com");
    });

    it("should prefer explicit projectId over issuer-derived one", () => {
      const provider = new DescopeMcpProvider({
        issuer: "https://api.descope.com/v1/apps/P2fromIssuer",
        projectId: "P2explicit",
        serverUrl: "https://test.example.com",
      });

      expect(provider.projectId).toBe("P2explicit");
    });

    it("should throw a clear error when issuer is malformed", () => {
      expect(
        () =>
          new DescopeMcpProvider({
            issuer: "not a url",
            serverUrl: "https://test.example.com",
          }),
      ).toThrow(/Invalid issuer URL/);
    });

    it("should fall back to projectId-derived issuer when issuer is not supplied", () => {
      const provider = new DescopeMcpProvider({
        projectId: "test-project",
        serverUrl: "https://test.example.com",
      });

      expect(provider.issuer).toBe(
        "https://api.descope.com/v1/apps/test-project",
      );
    });
  });

  describe("OAuth endpoints", () => {
    let provider: DescopeMcpProvider;

    beforeEach(() => {
      provider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "https://test.example.com",
      });
    });

    it("should initialize all required endpoints", () => {
      const endpoints = provider.descopeOAuthEndpoints;

      expect(endpoints.issuer.toString()).toBe(
        "https://api.descope.com/v1/apps/test-project",
      );
      expect(endpoints.authorization.toString()).toBe(
        "https://api.descope.com/oauth2/v1/apps/authorize",
      );
      expect(endpoints.token.toString()).toBe(
        "https://api.descope.com/oauth2/v1/apps/token",
      );
      expect(endpoints.revocation.toString()).toBe(
        "https://api.descope.com/oauth2/v1/apps/revoke",
      );
    });

    it("should allow localhost URLs", () => {
      const localProvider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "http://localhost:3000",
      });

      // Should not throw an error
      expect(() => localProvider.descopeOAuthEndpoints).not.toThrow();
    });
  });

  describe("resourceUrl", () => {
    it("should default to ${serverUrl}/mcp", () => {
      const provider = new DescopeMcpProvider({
        projectId: "test-project",
        serverUrl: "https://test.example.com",
      });

      expect(provider.resourceUrl).toBe("https://test.example.com/mcp");
    });

    it("should respect an explicit resource override", () => {
      const provider = new DescopeMcpProvider({
        projectId: "test-project",
        serverUrl: "https://test.example.com",
        resource: "https://test.example.com/custom/mcp",
      });

      expect(provider.resourceUrl).toBe("https://test.example.com/custom/mcp");
    });
  });

  describe("dynamic client registration options", () => {
    it("should use default attribute scopes when not provided", () => {
      const provider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "https://test.example.com",
      });

      const options = provider.options;
      expect(options.dynamicClientRegistrationOptions?.attributeScopes).toEqual(
        [
          {
            name: "profile",
            description: "Access to basic profile information",
            required: true,
            attributes: ["login id", "display name", "picture"],
          },
        ],
      );
    });

    it("should use custom attribute scopes when provided", () => {
      const customScopes = [
        {
          name: "custom",
          description: "Custom scope",
          required: false,
          attributes: ["custom1", "custom2"],
        },
      ];

      const provider = new DescopeMcpProvider({
        projectId: "test-project",
        managementKey: "test-key",
        serverUrl: "https://test.example.com",
        dynamicClientRegistrationOptions: {
          attributeScopes: customScopes,
        },
      });

      const options = provider.options;
      expect(options.dynamicClientRegistrationOptions?.attributeScopes).toEqual(
        customScopes,
      );
    });
  });

  describe("readEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should read environment variables", () => {
      process.env.TEST_VAR = "test-value";
      expect(readEnv("TEST_VAR")).toBe("test-value");
    });

    it("should return undefined for non-existent variables", () => {
      expect(readEnv("NON_EXISTENT")).toBeUndefined();
    });

    it("should trim whitespace from values", () => {
      process.env.TEST_VAR = "  test-value  ";
      expect(readEnv("TEST_VAR")).toBe("test-value");
    });
  });
});
