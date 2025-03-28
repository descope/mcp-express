import express, { RequestHandler } from "express";
import cors from "cors";
import { OAuthClientInformationFullSchema, OAuthClientMetadata, OAuthClientMetadataSchema } from "../schemas/oauth.js";
import {
  InvalidClientMetadataError,
  ServerError,
  OAuthError
} from "../errors.js";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { DescopeMcpProvider } from "../provider.js";

export function registrationHandler(provider: DescopeMcpProvider): RequestHandler {
  // Nested router so we can configure middleware and restrict HTTP method
  const router = express.Router();

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors());

  router.use(allowedMethods(["POST"]));
  router.use(express.json());

  router.post("/", async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    try {
      const parseResult = OAuthClientMetadataSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new InvalidClientMetadataError(parseResult.error.message);
      }

      const clientMetadata = parseResult.data;

      let clientInfo = await registerClient(clientMetadata, provider);
      res.status(201).json(clientInfo);
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        console.error("Unexpected error registering client:", error);
        const serverError = new ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
    }
  });

  return router;
}

async function registerClient(client: OAuthClientMetadata, provider: DescopeMcpProvider) {
  const { client_name, redirect_uris, logo_uri } = client;

  const createAppResponse = await fetch(
    `${provider.baseUrl}/v1/mgmt/thirdparty/app/create`,
    {
      headers: {
        Authorization: `Bearer ${provider.projectId}:${provider.managementKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        name: client_name,
        approvedCallbackUrls: [...redirect_uris],
        logo: logo_uri,
        loginPageUrl: provider.options.dynamicClientRegistrationOptions?.authPageUrl,
        permissionsScopes: provider.options.dynamicClientRegistrationOptions?.permissionScopes?.map(({ name, description, required, roles }) => ({
          name, description, optional: required === true, values: roles
        })),
        attributesScopes: provider.options.dynamicClientRegistrationOptions?.attributeScopes?.map(({ name, description, required, attributes }) => ({
          name, description, optional: required === true, values: attributes
        })),
      }),
    }
  );

  if (!createAppResponse.ok) {
    throw new ServerError(`Failed to create app: ${createAppResponse.status}`);
  }

  const createAppResponseJson = (await createAppResponse.json()) as {
    id: string;
    cleartext: string;
  };

  const appId = createAppResponseJson.id;

  const loadAppResponse = await fetch(
    `${provider.baseUrl}/v1/mgmt/thirdparty/app/load?id=${appId}`,
    {
      headers: {
        Authorization: `Bearer ${provider.projectId}:${provider.managementKey}`,
      },
      method: "GET",
    }
  );

  if (!loadAppResponse.ok) {
    throw new ServerError(`Failed to load app: ${loadAppResponse.status}`);
  }

  const loadAppResponseJson = (await loadAppResponse.json()) as {
    clientId: string;
  };

  const client_id = loadAppResponseJson.clientId;

  return OAuthClientInformationFullSchema.parse({
    client_id,
    ...client
  });
}