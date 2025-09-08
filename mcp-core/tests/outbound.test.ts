import { jest } from "@jest/globals";
import { createTokenManager, getOutboundToken } from "../src/index.js";
import type { AuthInfo, DescopeConfig } from "../src/index.js";

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

const mockAuthInfo: AuthInfo = {
  token: "test-token",
  clientId: "test-client",
  userId: "test-user",
  scopes: ["openid", "profile"],
  expiresAt: Date.now() + 3600000,
};

const mockConfig: DescopeConfig = {
  projectId: "test-project",
  baseUrl: "https://api.descope.com",
};

describe("Outbound Token Utilities", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe("getOutboundToken", () => {
    it("should return token on successful exchange", async () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ access_token: "outbound-token" }),
        { status: 200, statusText: "OK" }
      ));

      const result = await getOutboundToken("app-id", mockAuthInfo, mockConfig, ["read"]);

      expect(result).toBe("outbound-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.descope.com/v1/auth/token/exchange",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-project",
          },
        })
      );
    });

    it("should return null on failed exchange", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { 
        status: 400, 
        statusText: "Bad Request" 
      }));

      const result = await getOutboundToken("app-id", mockAuthInfo, mockConfig);

      expect(result).toBe(null);
    });
  });

  describe("DescopeTokenManager", () => {
    it("should create token manager and get outbound token", async () => {
      const manager = createTokenManager(mockConfig);

      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ access_token: "manager-token" }),
        { status: 200, statusText: "OK" }
      ));

      const result = await manager.getOutboundToken(mockAuthInfo, "app-id", ["read"]);

      expect(result).toBe("manager-token");
    });

    it("should return null if no auth info", async () => {
      const manager = createTokenManager(mockConfig);

      const result = await manager.getOutboundToken(undefined, "app-id");

      expect(result).toBe(null);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});