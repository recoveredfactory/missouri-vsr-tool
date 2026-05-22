import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { dispatch } from "./dispatch.js";
import { SERVER_NAME, SERVER_VERSION } from "./server-info.js";

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers":
          "content-type, mcp-session-id, mcp-protocol-version",
      },
      body: "",
    };
  }

  if (method === "GET") {
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "streamable-http",
        notes:
          "Send MCP JSON-RPC requests as POST to this URL. Streaming responses are not yet implemented; every response is a single JSON body.",
      }),
    };
  }

  if (method !== "POST") {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const rawBody = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body
    : "";

  const result = await dispatch(rawBody);

  if (result.status === 204) {
    return {
      statusCode: 204,
      headers: { "access-control-allow-origin": "*" },
      body: "",
    };
  }

  return {
    statusCode: result.status,
    headers: JSON_HEADERS,
    body: result.body,
  };
};
