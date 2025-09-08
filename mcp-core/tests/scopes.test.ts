import { validateScopes, hasScope, hasAnyScope, hasAllScopes } from "../src/index.js";
import type { AuthInfo } from "../src/index.js";

const mockAuthInfo: AuthInfo = {
  token: "test-token",
  clientId: "test-client", 
  userId: "test-user",
  scopes: ["openid", "profile", "email"],
  expiresAt: Date.now() + 3600000,
};

describe("Scope Utilities", () => {
  describe("validateScopes", () => {
    it("should return valid for user with required scopes", () => {
      const result = validateScopes(mockAuthInfo, ["openid", "profile"]);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid for missing scopes", () => {
      const result = validateScopes(mockAuthInfo, ["admin", "write"]);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Missing required scopes: admin, write");
    });

    it("should return invalid for no auth info", () => {
      const result = validateScopes(undefined, ["openid"]);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("No authentication info provided");
    });

    it("should return valid for empty required scopes", () => {
      const result = validateScopes(mockAuthInfo, []);
      expect(result.isValid).toBe(true);
    });
  });

  describe("hasScope", () => {
    it("should return true for existing scope", () => {
      expect(hasScope(mockAuthInfo, "openid")).toBe(true);
    });

    it("should return false for missing scope", () => {
      expect(hasScope(mockAuthInfo, "admin")).toBe(false);
    });

    it("should return false for no auth info", () => {
      expect(hasScope(undefined, "openid")).toBe(false);
    });
  });

  describe("hasAnyScope", () => {
    it("should return true when user has any required scope", () => {
      expect(hasAnyScope(mockAuthInfo, ["admin", "profile"])).toBe(true);
    });

    it("should return false when user has no required scopes", () => {
      expect(hasAnyScope(mockAuthInfo, ["admin", "write"])).toBe(false);
    });

    it("should return true for empty scope array", () => {
      expect(hasAnyScope(mockAuthInfo, [])).toBe(true);
    });
  });

  describe("hasAllScopes", () => {
    it("should return true when user has all required scopes", () => {
      expect(hasAllScopes(mockAuthInfo, ["openid", "profile"])).toBe(true);
    });

    it("should return false when user missing some scopes", () => {
      expect(hasAllScopes(mockAuthInfo, ["openid", "admin"])).toBe(false);
    });

    it("should return true for empty scope array", () => {
      expect(hasAllScopes(mockAuthInfo, [])).toBe(true);
    });
  });
});