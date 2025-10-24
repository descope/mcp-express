import { AuthInfo } from "./auth.js";

/**
 * Validate that authInfo contains all required scopes
 */
export function validateScopes(
  authInfo: AuthInfo | undefined,
  requiredScopes: string[] = [],
): { isValid: boolean; error?: string } {
  if (!authInfo) {
    return { isValid: false, error: "No authentication info provided" };
  }

  if (requiredScopes.length === 0) return { isValid: true };

  const missing = requiredScopes.filter(
    (s) => !(authInfo.scopes || []).includes(s),
  );

  if (missing.length) {
    const userScopes = authInfo.scopes?.join(", ") || "none";
    return {
      isValid: false,
      error: `Missing required scopes: ${missing.join(", ")}. User has scopes: ${userScopes}`,
    };
  }

  return { isValid: true };
}

/**
 * Check if authInfo has a specific scope
 */
export function hasScope(
  authInfo: AuthInfo | undefined,
  scope: string,
): boolean {
  return authInfo?.scopes?.includes(scope) || false;
}

/**
 * Check if authInfo has any of the provided scopes
 */
export function hasAnyScope(
  authInfo: AuthInfo | undefined,
  scopes: string[],
): boolean {
  if (!authInfo || !scopes.length) return true;
  return scopes.some((scope) => hasScope(authInfo, scope));
}

/**
 * Check if authInfo has all of the provided scopes
 */
export function hasAllScopes(
  authInfo: AuthInfo | undefined,
  scopes: string[],
): boolean {
  if (!authInfo || !scopes.length) return true;
  return scopes.every((scope) => hasScope(authInfo, scope));
}
