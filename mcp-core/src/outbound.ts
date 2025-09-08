import { AuthInfo } from "./auth.js";
import DescopeClient from "@descope/node-sdk";

export interface DescopeConfig {
  projectId: string;
  baseUrl?: string;
}

export function createAuthenticatedDescopeClient(
  config: DescopeConfig,
  userToken: string,
): ReturnType<typeof DescopeClient> {
  return DescopeClient({
    projectId: config.projectId!,
    baseUrl: config.baseUrl,
    hooks: {
      beforeRequest: (requestConfig) => {
        requestConfig.headers = {
          ...requestConfig.headers,
          Authorization: `Bearer ${config.projectId}:${userToken}`,
        };
        return requestConfig;
      },
    },
  });
}

/**
 * Get an outbound token for external API calls
 */
export async function getOutboundToken(
  appId: string,
  authInfo: AuthInfo,
  config: DescopeConfig,
  scopes?: string[],
): Promise<string | null> {
  console.log("Getting outbound token for app:", appId, "with scopes:", scopes);
  if (!authInfo?.token) {
    return null;
  }

  try {
    const descopeClient = createAuthenticatedDescopeClient(
      config,
      authInfo.token,
    );
    const userId = authInfo.userId;
    const outbound = descopeClient.management.outboundApplication;

    const result = scopes?.length
      ? await outbound.fetchTokenByScopes(appId, userId, scopes)
      : await outbound.fetchToken(appId, userId);

    if (!result.ok) {
      console.error(
        `Failed to exchange token for app ${appId} for user ${userId}:`,
        result.error,
      );
      return null;
    }

    return result.data?.accessToken ?? null;
  } catch (error) {
    console.error(
      "Outbound token exchange error:",
      error instanceof Error ? error.message : "Token exchange failed",
    );
    return null;
  }
}

/**
 * Utility class for managing outbound tokens with configuration
 */
export class DescopeTokenManager {
  constructor(private config: DescopeConfig) {}

  /**
   * Get an outbound token for the configured project
   */
  async getOutboundToken(
    authInfo: AuthInfo | undefined,
    appId: string,
    scopes?: string[],
  ): Promise<string | null> {
    if (!authInfo) {
      return null;
    }

    return getOutboundToken(appId, authInfo, this.config, scopes);
  }
}

/**
 * Create a new token manager instance
 */
export function createTokenManager(config: DescopeConfig): DescopeTokenManager {
  return new DescopeTokenManager(config);
}
