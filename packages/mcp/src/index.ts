import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;

  if (method === "GET") {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "missouri-vsr-mcp",
        status: "scaffold",
        message: "MCP server stub. JSON-RPC handler not wired yet.",
      }),
    };
  }

  return {
    statusCode: 501,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "MCP server stub — JSON-RPC handler not implemented yet",
      },
      id: null,
    }),
  };
};
