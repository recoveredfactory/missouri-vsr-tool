export type Id = string | number | null;

export interface RpcRequest {
  jsonrpc: "2.0";
  method: string;
  id?: Id;
  params?: unknown;
}

export interface RpcSuccess {
  jsonrpc: "2.0";
  id: Id;
  result: unknown;
}

export interface RpcError {
  jsonrpc: "2.0";
  id: Id;
  error: { code: number; message: string; data?: unknown };
}

export type RpcResponse = RpcSuccess | RpcError;

export const ERR_PARSE = -32700;
export const ERR_INVALID_REQUEST = -32600;
export const ERR_METHOD_NOT_FOUND = -32601;
export const ERR_INVALID_PARAMS = -32602;
export const ERR_INTERNAL = -32603;

export const success = (id: Id, result: unknown): RpcSuccess => ({
  jsonrpc: "2.0",
  id,
  result,
});

export const error = (
  id: Id,
  code: number,
  message: string,
  data?: unknown,
): RpcError => ({
  jsonrpc: "2.0",
  id,
  error: data !== undefined ? { code, message, data } : { code, message },
});

export const isNotification = (req: RpcRequest): boolean =>
  req.id === undefined;
