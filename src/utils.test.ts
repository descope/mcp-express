/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";
import { validateScopes, registerAuthenticatedTool } from "./utils.js";
import { AuthInfo } from "./schemas/auth.js";
import { z } from "zod";

const mockAuthInfo: AuthInfo = {
  token: "mock-token",
  clientId: "test-client",
  scopes: ["openid", "profile", "email"],
  expiresAt: Date.now() + 3600000, // 1 hour from now
};

describe("utils", () => {
  describe("validateScopes", () => {
    it("should return valid when no scopes required", () => {
      const result = validateScopes(mockAuthInfo, []);
      expect(result.isValid).toBe(true);
      expect(result.missingScopes).toBeUndefined();
    });

    it("should return valid when user has all required scopes", () => {
      const result = validateScopes(mockAuthInfo, ["openid", "profile"]);
      expect(result.isValid).toBe(true);
      expect(result.missingScopes).toBeUndefined();
    });

    it("should return invalid when user is missing scopes", () => {
      const result = validateScopes(mockAuthInfo, ["openid", "admin"]);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Missing required scopes: admin");
    });
  });

  describe("registerAuthenticatedTool", () => {
    const mockServer = {
      registerTool: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create a tool with scope validation", () => {
      const executeFn = jest.fn().mockResolvedValue({ result: "success" });

      const toolDef = registerAuthenticatedTool({
        name: "test_tool",
        description: "Test tool",
        paramsSchema: { input: z.string() },
        requiredScopes: ["profile"],
        execute: executeFn as any,
      });

      toolDef(mockServer as any);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        "test_tool",
        expect.objectContaining({
          description: "Test tool",
          inputSchema: expect.objectContaining({ input: expect.any(Object) }),
        }),
        expect.any(Function),
      );
    });

    it("should validate scopes and call execute function", async () => {
      const executeFn = jest.fn().mockResolvedValue({ result: "success" });

      const toolDef = registerAuthenticatedTool({
        name: "test_tool",
        description: "Test tool",
        paramsSchema: { input: z.string() },
        requiredScopes: ["profile"],
        execute: executeFn as any,
      });

      toolDef(mockServer as any);

      // Get the callback function that was registered
      const [, , callback] = (mockServer.registerTool as jest.Mock).mock
        .calls[0];

      const args = { input: "test" };
      const extra = { authInfo: mockAuthInfo };

      const result = await (callback as any)(args, extra);

      expect(executeFn).toHaveBeenCalledWith({
        args,
        extra,
        authInfo: mockAuthInfo,
        getOutboundToken: expect.any(Function),
      });

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ result: "success" }, null, 2),
          },
        ],
      });
    });

    it("should throw error when auth info is missing", async () => {
      const toolDef = registerAuthenticatedTool({
        name: "test_tool",
        description: "Test tool",
        paramsSchema: { input: z.string() },
        execute: jest.fn() as any,
      });

      toolDef(mockServer as any);

      const [, , callback] = (mockServer.registerTool as jest.Mock).mock
        .calls[0];

      await expect((callback as any)({ input: "test" }, {})).rejects.toThrow(
        "Authentication required but no auth info provided",
      );
    });

    it("should throw error when required scopes are missing", async () => {
      const authInfoWithoutProfile = {
        ...mockAuthInfo,
        scopes: ["openid"], // Missing "profile" scope
      };

      const toolDef = registerAuthenticatedTool({
        name: "test_tool",
        description: "Test tool",
        paramsSchema: { input: z.string() },
        requiredScopes: ["profile"],
        execute: jest.fn() as any,
      });

      toolDef(mockServer as any);

      const [, , callback] = (mockServer.registerTool as jest.Mock).mock
        .calls[0];

      await expect(
        (callback as any)(
          { input: "test" },
          { authInfo: authInfoWithoutProfile },
        ),
      ).rejects.toThrow("Missing required scopes: profile");
    });
  });
});
