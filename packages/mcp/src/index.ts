import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { getDb } from "./db.js";
import { dispatch } from "./dispatch.js";
import { SERVER_NAME, SERVER_VERSION } from "./server-info.js";

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

// The prod McpWarmer cron (sst.config.ts) invokes the function directly with
// { warmer: "true" }. It isn't an HTTP request, and a Function URL request
// can't produce this shape (the body never lands at the top level of the
// event).
const isWarmerPing = (event: unknown): boolean =>
  typeof event === "object" &&
  event !== null &&
  (event as { warmer?: unknown }).warmer === "true";

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  if (isWarmerPing(event)) {
    // Load the dataset if this container hasn't yet, so the next real tool
    // call skips the 8–15s cold load. getDb() is memoized, so on a container
    // that's already warm this resolves immediately.
    try {
      await getDb();
    } catch (err) {
      console.error("warmer: dataset load failed", err);
    }
    return { statusCode: 200, body: "warm" };
  }

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
    // Only the root answers. Previously every GET path returned this 200
    // JSON blurb — including /.well-known/oauth-protected-resource and
    // /.well-known/oauth-authorization-server. MCP clients that probe OAuth
    // discovery eagerly (Claude Desktop's custom-connector flow does; claude.ai
    // web only probes after a 401) saw a 200 with no `authorization_servers`
    // and refused to connect with "auth details missing". This server has no
    // auth: discovery URLs must 404 so clients fall through to anonymous (#219).
    const path = (event.rawPath ?? "/").replace(/\/+$/, "") || "/";
    if (path !== "/") {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          error: "Not found",
          notes:
            "This MCP server has no authentication and exposes a single endpoint at /. Send MCP JSON-RPC requests as POST to /.",
        }),
      };
    }
    // Streamable HTTP lets clients open a server→client SSE stream with
    // GET + Accept: text/event-stream. We don't implement one; the spec says
    // to answer 405 rather than return a non-SSE body.
    const accept = (event.headers?.accept ?? event.headers?.Accept ?? "").toLowerCase();
    if (accept.includes("text/event-stream")) {
      return {
        statusCode: 405,
        headers: { ...JSON_HEADERS, allow: "POST, OPTIONS" },
        body: JSON.stringify({
          error: "Method not allowed",
          notes: "Server-initiated SSE streams are not implemented. POST JSON-RPC requests to /.",
        }),
      };
    }
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "streamable-http",
        auth: "none",
        status: "provisional",
        disclaimer:
          "This MCP server is provisional and offered as-is. No warranty, no uptime guarantee, tool surfaces may change without notice. Always verify model output against the published Missouri Vehicle Stops Report data before publishing.",
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
