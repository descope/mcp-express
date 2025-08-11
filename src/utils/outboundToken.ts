import DescopeClient from "@descope/node-sdk";
import { AuthInfo } from "../schemas/auth.js";
import { DescopeMcpProviderOptions } from "../schemas/options.js";

/**
 * Creates an authenticated Descope client that includes the user's token in requests
 */
export function createAuthenticatedDescopeClient(
  config: DescopeMcpProviderOptions,
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
 * Extracts user ID from the auth info token
 */
export function extractUserIdFromAuthInfo(authInfo: AuthInfo): string {
  try {
    // Decode JWT token to extract user ID
    const tokenPayload = JSON.parse(
      Buffer.from(authInfo.token.split(".")[1], "base64").toString(),
    );

    // Try common user ID fields in order of preference
    return (
      tokenPayload.sub ||
      tokenPayload.userId ||
      tokenPayload.user_id ||
      tokenPayload.clientId
    );
  } catch {
    // Fallback to clientId if token parsing fails
    return authInfo.clientId;
  }
}

/**
 * Gets an outbound token for external API access using the authenticated user's context
 *
 * @param appId - The outbound application ID configured in Descope
 * @param authInfo - Authentication info from the authenticated tool
 * @param config - Descope configuration
 * @param scopes - Optional scopes to request for the outbound token
 * @returns The outbound token or null if exchange fails
 *
 * @example
 * ```typescript
 * const token = await getOutboundToken(
 *   'external-api-app',
 *   authInfo,
 *   { projectId: 'my-project' },
 *   ['read', 'write']
 * );
 * if (token) {
 *   // Use token to call external API
 *   const response = await fetch('https://api.example.com/data', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 * }
 * ```
 */
export async function getOutboundToken(
  appId: string,
  authInfo: AuthInfo,
  config: DescopeMcpProviderOptions,
  scopes?: string[],
): Promise<string | null> {
  const userId = extractUserIdFromAuthInfo(authInfo);
  const userToken = authInfo.token;

  try {
    // Create authenticated Descope client
    const descopeClient = createAuthenticatedDescopeClient(config, userToken);

    // Use the new outbound token exchange API from the next version
    let result;
    if (scopes && scopes.length > 0) {
      result =
        await descopeClient.management.outboundApplication.fetchTokenByScopes(
          appId,
          userId,
          scopes || [],
        );
    } else {
      result = await descopeClient.management.outboundApplication.fetchToken(
        appId,
        userId,
      );
    }

    if (!result.ok) {
      console.error(
        `Failed to exchange token for app ${appId} for user ${userId}:`,
        result.error,
      );
      return null;
    }
    return result.data?.accessToken || null;
  } catch (error) {
    console.error(
      "Outbound token exchange error:",
      error instanceof Error ? error.message : "Token exchange failed",
    );
    return null;
  }
}

/**
 * Factory function to create a getOutboundToken function bound to a specific configuration
 */
export function createOutboundTokenFactory(config: DescopeMcpProviderOptions) {
  return (appId: string, authInfo: AuthInfo, scopes?: string[]) =>
    getOutboundToken(appId, authInfo, config, scopes);
}
