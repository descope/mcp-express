import { jest } from "@jest/globals";
import type { AuthInfo, DescopeConfig } from "../src/index.js";

// Mock @descope/node-sdk to control outboundApplication behavior
interface MockResultOk {
  ok: true;
  data: { accessToken?: string };
  error?: unknown;
}
interface MockResultErr {
  ok: false;
  error: unknown;
  data?: undefined;
}
type MockResult = MockResultOk | MockResultErr;

const fetchToken = jest.fn() as jest.MockedFunction<
  (...args: unknown[]) => Promise<MockResult>
>;
const fetchTokenByScopes = jest.fn() as jest.MockedFunction<
  (...args: unknown[]) => Promise<MockResult>
>;

jest.unstable_mockModule("@descope/node-sdk", () => ({
  default: () => ({
    management: {
      outboundApplication: {
        fetchToken,
        fetchTokenByScopes,
      },
    },
  }),
}));

// Re-import after mocking
const {
  getOutboundToken: realGetOutboundToken,
  createTokenManager: realCreateTokenManager,
} = await import("../src/index.js");

const mockAuthInfo: AuthInfo = {
  token: "test-token",
  clientId: "test-client",
  userId: "test-user",
  scopes: ["openid", "profile"],
  expiresAt: Date.now() + 3600000,
};

const mockConfig: DescopeConfig = { projectId: "test-project" };

describe("Outbound Token Utilities (SDK based)", () => {
  beforeEach(() => {
    fetchToken.mockReset();
    fetchTokenByScopes.mockReset();
  });

  describe("getOutboundToken", () => {
    it("should return token on successful exchange (scoped)", async () => {
      fetchTokenByScopes.mockResolvedValueOnce({
        ok: true,
        data: { accessToken: "outbound-token" },
      });

      const result = await realGetOutboundToken(
        "app-id",
        mockAuthInfo,
        mockConfig,
        ["read"],
      );

      expect(result).toBe("outbound-token");
      expect(fetchTokenByScopes).toHaveBeenCalledWith(
        "app-id",
        mockAuthInfo.userId,
        ["read"],
      );
      expect(fetchToken).not.toHaveBeenCalled();
    });

    it("should fall back to null on failed exchange", async () => {
      fetchToken.mockResolvedValueOnce({ ok: false, error: "bad" });
      const result = await realGetOutboundToken(
        "app-id",
        mockAuthInfo,
        mockConfig,
      );
      expect(result).toBeNull();
    });
  });

  describe("DescopeTokenManager", () => {
    it("should create token manager and get outbound token", async () => {
      const manager = realCreateTokenManager(mockConfig);
      fetchTokenByScopes.mockResolvedValueOnce({
        ok: true,
        data: { accessToken: "manager-token" },
      });
      const result = await manager.getOutboundToken(mockAuthInfo, "app-id", [
        "read",
      ]);
      expect(result).toBe("manager-token");
    });

    it("should return null if no auth info", async () => {
      const manager = realCreateTokenManager(mockConfig);
      const result = await manager.getOutboundToken(undefined, "app-id");
      expect(result).toBeNull();
      expect(fetchToken).not.toHaveBeenCalled();
      expect(fetchTokenByScopes).not.toHaveBeenCalled();
    });
  });
});
