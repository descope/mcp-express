import { RequestHandler, Response } from "express";
import {
  InsufficientScopeError,
  InvalidTokenError,
  OAuthError,
  ServerError,
} from "../errors.js";
import { AuthInfo, AuthInfoSchema } from "../schemas/auth.js";
import { DescopeMcpProvider } from "../provider.js";

declare module "express-serve-static-core" {
  interface Request {
    /**
     * Information about the validated access token, if the `requireBearerAuth` middleware was used.
     */
    auth?: AuthInfo;
  }
}

/**
 * Middleware that requires a valid Bearer token in the Authorization header.
 *
 * This will validate the token with the auth provider and add the resulting auth info to the request object.
 * The middleware performs several validations:
 * - Presence and format of Authorization header
 * - Required scopes (if specified)
 * - Token audience (if specified)
 */
export function descopeMcpBearerAuth(
  provider?: DescopeMcpProvider,
): RequestHandler {
  const authProvider = provider || new DescopeMcpProvider();

  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new InvalidTokenError("Missing Authorization header");
      }

      const [type, token] = authHeader.split(" ");
      if (type.toLowerCase() !== "bearer" || !token) {
        throw new InvalidTokenError(
          "Invalid Authorization header format, expected 'Bearer TOKEN'",
        );
      }

      const authInfo = await verifyAccessToken(token, authProvider);

      req.auth = authInfo;
      next();
    } catch (error) {
      handleAuthError(error, res, authProvider);
    }
  };
}

async function verifyAccessToken(
  token: string,
  provider: DescopeMcpProvider,
): Promise<AuthInfo> {
  // First validate the token with Descope
  const authInfo = await provider.descope.validateSession(token).catch(() => {
    throw new InvalidTokenError("Failed to validate token");
  });

  // Validate audience if specified
  const audience = provider.options.verifyTokenOptions?.audience;
  if (audience) {
    const tokenAudience = authInfo.token.aud;
    if (!tokenAudience) {
      throw new InvalidTokenError("Token missing audience claim");
    }

    const hasValidAudience = Array.isArray(tokenAudience)
      ? tokenAudience.includes(audience)
      : tokenAudience === audience;

    if (!hasValidAudience) {
      throw new InvalidTokenError(
        `Invalid token audience. Expected: ${audience}`,
      );
    }
  }

  // Extract scopes from token
  const scope = authInfo.token.scope as string | undefined;
  const scopes = scope ? scope.split(" ").filter(Boolean) : [];

  // Validate required scopes if specified
  const requiredScopes = provider.options.verifyTokenOptions?.requiredScopes;
  if (requiredScopes?.length) {
    const missingScopes = requiredScopes.filter(
      (scope) => !scopes.includes(scope),
    );
    if (missingScopes.length > 0) {
      const userScopes = scopes.join(", ") || "none";
      throw new InsufficientScopeError(
        `Missing required scopes: ${missingScopes.join(", ")}. ` +
          `User has scopes: ${userScopes}. ` +
          `Check /.well-known/oauth-protected-resource for available scopes.`,
      );
    }
  }

  // Validate resource indicator if specified (RFC 8707)
  const resourceIndicator =
    provider.options.verifyTokenOptions?.resourceIndicator;
  if (resourceIndicator) {
    const tokenResource = authInfo.token.resource as
      | string
      | string[]
      | undefined;
    if (!tokenResource) {
      throw new InvalidTokenError("Token missing resource claim");
    }

    const hasValidResource = Array.isArray(tokenResource)
      ? tokenResource.includes(resourceIndicator)
      : tokenResource === resourceIndicator;

    if (!hasValidResource) {
      throw new InvalidTokenError(
        `Invalid token resource. Expected: ${resourceIndicator}`,
      );
    }
  }

  const clientId = authInfo.token.azp as string;

  return AuthInfoSchema.parse({
    token: authInfo.jwt,
    clientId,
    scopes,
    expiresAt: authInfo.token.exp,
  });
}

function handleAuthError(
  error: unknown,
  res: Response,
  provider: DescopeMcpProvider,
): void {
  const resourceMetadataUrl = new URL(
    "/.well-known/oauth-protected-resource",
    provider.serverUrl,
  ).href;

  if (error instanceof InvalidTokenError) {
    res.setHeader(
      "WWW-Authenticate",
      `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"`,
    );
    res.status(401).json(error.toResponseObject());
  } else if (error instanceof InsufficientScopeError) {
    res.setHeader(
      "WWW-Authenticate",
      `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"`,
    );
    res.status(403).json(error.toResponseObject());
  } else if (error instanceof ServerError) {
    res.status(500).json(error.toResponseObject());
  } else if (error instanceof OAuthError) {
    res.status(400).json(error.toResponseObject());
  } else {
    console.error("Unexpected error authenticating bearer token:", error);
    const serverError = new ServerError("Internal Server Error");
    res.status(500).json(serverError.toResponseObject());
  }
}
