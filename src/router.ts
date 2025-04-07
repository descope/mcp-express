import express, { RequestHandler } from "express";
import { authorizationHandler } from "./handlers/authorize.js";
import { metadataHandler } from "./handlers/metadata.js";
import { registrationHandler } from "./handlers/register.js";
import { DescopeMcpProvider } from "./provider.js";

/**
 * Advertises standard Authorization Server metadata (RFC 8414).
 *
 * Also adds Dynamic Client Registration (RFC 7591) unless disabled.
 *
 * This router MUST be installed at the application root, like so:
 *
 *  const app = express();
 *  app.use(descopeMcpAuthRouter(...));
 */
export function descopeMcpAuthRouter(
  provider?: DescopeMcpProvider,
): RequestHandler {
  const authProvider = provider || new DescopeMcpProvider();

  const router = express.Router();

  // As stated in OAuth 2.1, section 1.4.1:
  //
  // "If the client omits the scope parameter when requesting
  // authorization, the authorization server MUST either process the
  // request using a pre-defined default value or fail the request
  // indicating an invalid scope.  The authorization server SHOULD
  // document its scope requirements and default value (if defined)."
  //
  // By default, Descope fails the request when the scope is undefined.
  // This is a workaround to instead use a default scope.
  router.use("/authorize", authorizationHandler(authProvider));

  router.use(
    "/.well-known/oauth-authorization-server",
    metadataHandler(authProvider),
  );

  if (!authProvider.options.dynamicClientRegistrationOptions?.isDisabled) {
    router.use("/register", registrationHandler(authProvider));
  }

  return router;
}
