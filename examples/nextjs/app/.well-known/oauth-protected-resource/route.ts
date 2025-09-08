import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from "@vercel/mcp-adapter";

const baseUrl = process.env.DESCOPE_BASE_URL || "https://api.descope.com";

const handler = protectedResourceHandler({
  authServerUrls: [`${baseUrl}/${process.env.DESCOPE_PROJECT_ID}`],
});

const optsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, optsHandler as OPTIONS };
