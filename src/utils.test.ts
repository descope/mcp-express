/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";
import { validateScopes, registerAuthenticatedTool } from "./utils.js";
import { AuthInfo } from "./schemas/auth.js";
import { z } from "zod";
import { MCP_REQUEST_CONTEXT } from "./utils/requestContext.js";

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
      expect(result.error).toBe("Missing required scopes: admin. User has scopes: openid, profile, email");
    });
  });

  describe("registerAuthenticatedTool", () => {
    const mockServer = {
      registerTool: jest.fn(),
      [MCP_REQUEST_CONTEXT]: {
        authInfo: mockAuthInfo,
        descopeConfig: undefined
      }
    };

    const mockServerWithoutAuth = {
      registerTool: jest.fn(),
      // No request context
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create a tool with scope validation", () => {
      const executeFn = jest.fn().mockResolvedValue({ 
        content: [{ type: "text", text: "success" }] 
      });

      const toolDef = registerAuthenticatedTool(
        "test_tool",
        {
          description: "Test tool",
          inputSchema: { input: z.string() },
        },
        executeFn as any,
        ["profile"]
      );

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
      const executeFn = jest.fn().mockResolvedValue({ 
        content: [{ type: "text", text: "success" }] 
      });

      const toolDef = registerAuthenticatedTool(
        "test_tool",
        {
          description: "Test tool",
          inputSchema: { input: z.string() },
        },
        executeFn as any,
        ["profile"]
      );

      toolDef(mockServer as any);

      // Get the callback function that was registered
      const [, , callback] = (mockServer.registerTool as jest.Mock).mock
        .calls[0];

      const args = { input: "test" };
      const extra = { authInfo: mockAuthInfo };

      const result = await (callback as any)(args, extra);

      expect(executeFn).toHaveBeenCalledWith(
        args,
        expect.objectContaining({
          authInfo: mockAuthInfo,
          getOutboundToken: expect.any(Function),
        })
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "success"
          },
        ],
      });
    });

    it("should throw error when auth info is missing", async () => {
      const toolDef = registerAuthenticatedTool(
        "test_tool",
        {
          description: "Test tool",
          inputSchema: { input: z.string() },
        },
        jest.fn() as any
      );

      toolDef(mockServerWithoutAuth as any);

      const [, , callback] = (mockServerWithoutAuth.registerTool as jest.Mock).mock
        .calls[0];

      await expect((callback as any)({ input: "test" }, {})).rejects.toThrow(
        "Authentication required for tool \"test_tool\". Ensure a valid bearer token is provided.",
      );
    });

    it("should throw error when required scopes are missing", async () => {
      const authInfoWithoutProfile = {
        ...mockAuthInfo,
        scopes: ["openid"], // Missing "profile" scope
      };
      
      const mockServerWithLimitedAuth = {
        registerTool: jest.fn(),
        [MCP_REQUEST_CONTEXT]: {
          authInfo: authInfoWithoutProfile,
          descopeConfig: undefined
        }
      };

      const toolDef = registerAuthenticatedTool(
        "test_tool",
        {
          description: "Test tool",
          inputSchema: { input: z.string() },
        },
        jest.fn() as any,
        ["profile"]
      );

      toolDef(mockServerWithLimitedAuth as any);

      const [, , callback] = (mockServerWithLimitedAuth.registerTool as jest.Mock).mock
        .calls[0];

      await expect(
        (callback as any)(
          { input: "test" },
          { authInfo: authInfoWithoutProfile },
        ),
      ).rejects.toThrow("Tool \"test_tool\" requires scopes: profile. User has scopes: openid. Missing: profile. Request these scopes during authentication.");
    });
  });
});
