import { RequestHandler } from "express";
import express from "express";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { DescopeMcpProvider } from "../provider.js";

export function authorizationHandler(provider: DescopeMcpProvider): RequestHandler {
  const router = express.Router();
  router.use(allowedMethods(["GET", "POST"]));
  router.use(express.urlencoded({ extended: false }));

  router.all("/", (req, res) => {
    const params = req.method === 'POST' ? req.body : req.query;

    // If no scope is provided, add the default openid scope
    // Otherwise, the authorization server will throw an error
    if (!params.scope) {
      params.scope = "openid";
    }

    // Redirect to the Descope authorization URL with all parameters
    const targetUrl = provider.descopeOAuthEndpoints.authorization;
    targetUrl.search = new URLSearchParams(params).toString();
    res.redirect(targetUrl.toString());
  });

  return router;
}

