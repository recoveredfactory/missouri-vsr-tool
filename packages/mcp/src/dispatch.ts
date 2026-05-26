import {
  PROTOCOL_VERSION,
  SERVER_INSTRUCTIONS,
  SERVER_NAME,
  SERVER_VERSION,
} from "./server-info.js";
import {
  ERR_INTERNAL,
  ERR_INVALID_REQUEST,
  ERR_METHOD_NOT_FOUND,
  ERR_PARSE,
  type Id,
  type RpcRequest,
  type RpcResponse,
  error,
  isNotification,
  success,
} from "./jsonrpc.js";
import { getTool, listTools } from "./tools/registry.js";

// Importing the tool modules registers them in the registry as a side effect.
import "./tools/methodology.js";
import "./tools/schema.js";
import "./tools/agencies.js";
import "./tools/agency-summary.js";
import "./tools/agency-demographics.js";
import "./tools/known-issues.js";
import "./tools/list-downloads.js";
import "./tools/list-metrics.js";
import "./tools/query-metric.js";
import "./tools/top-n-by.js";
import "./tools/distribution.js";
import "./tools/trend.js";
import "./tools/disparity.js";
import "./tools/compare.js";
import "./tools/stop-share-vs-population-share.js";
import "./tools/make-map.js";

const isRpcRequest = (value: unknown): value is RpcRequest =>
  typeof value === "object" &&
  value !== null &&
  (value as { jsonrpc?: unknown }).jsonrpc === "2.0" &&
  typeof (value as { method?: unknown }).method === "string";

const handleSingle = async (
  req: unknown,
): Promise<RpcResponse | null> => {
  if (!isRpcRequest(req)) {
    const id =
      typeof req === "object" && req !== null && "id" in req
        ? ((req as { id?: Id }).id ?? null)
        : null;
    return error(id, ERR_INVALID_REQUEST, "Invalid Request");
  }

  const id = req.id ?? null;
  const notification = isNotification(req);

  try {
    switch (req.method) {
      case "initialize":
        return success(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions: SERVER_INSTRUCTIONS,
        });

      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/progress":
        return null;

      case "ping":
        return success(id, {});

      case "tools/list":
        return success(id, { tools: listTools() });

      case "tools/call": {
        const params = (req.params ?? {}) as {
          name?: unknown;
          arguments?: unknown;
        };
        if (typeof params.name !== "string") {
          return error(id, ERR_INVALID_REQUEST, "Missing tool name");
        }
        const tool = getTool(params.name);
        if (!tool) {
          return error(
            id,
            ERR_METHOD_NOT_FOUND,
            `Tool not found: ${params.name}`,
          );
        }
        const result = await tool.handler(params.arguments ?? {});
        return success(id, result);
      }

      default:
        if (notification) return null;
        return error(id, ERR_METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
  } catch (err) {
    if (notification) return null;
    return error(
      id,
      ERR_INTERNAL,
      err instanceof Error ? err.message : "Internal error",
    );
  }
};

export interface DispatchResult {
  status: number;
  body: string;
}

export const dispatch = async (rawBody: string): Promise<DispatchResult> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return {
      status: 200,
      body: JSON.stringify(error(null, ERR_PARSE, "Parse error")),
    };
  }

  if (Array.isArray(parsed)) {
    const results = await Promise.all(parsed.map(handleSingle));
    const filtered = results.filter((r): r is RpcResponse => r !== null);
    if (filtered.length === 0) return { status: 204, body: "" };
    return { status: 200, body: JSON.stringify(filtered) };
  }

  const single = await handleSingle(parsed);
  if (single === null) return { status: 204, body: "" };
  return { status: 200, body: JSON.stringify(single) };
};
