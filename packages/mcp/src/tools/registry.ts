import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export type ToolContent = TextContent | ImageContent;

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (rawInput: unknown) => Promise<ToolResult> | ToolResult;
}

const registry = new Map<string, Tool>();

export const registerTool = (tool: Tool): void => {
  if (registry.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`);
  }
  registry.set(tool.name, tool);
};

export const listTools = (): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> =>
  Array.from(registry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

export const getTool = (name: string): Tool | undefined => registry.get(name);

export const textResult = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
});

export const errorResult = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

// The Anthropic API validates tool input schemas against JSON Schema
// draft 2020-12. zod-to-json-schema's "openApi3" target emits the older
// `items: [schema, schema]` form for tuples; 2020-12 requires `prefixItems`
// instead. Walk the schema and rewrite in place.
const rewriteTuplesForDraft2020 = (node: unknown): void => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(rewriteTuplesForDraft2020);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.type === "array" && Array.isArray(obj.items)) {
    obj.prefixItems = obj.items;
    delete obj.items;
  }
  for (const value of Object.values(obj)) {
    rewriteTuplesForDraft2020(value);
  }
};

export const inputSchemaFromZod = (zod: ZodTypeAny): Record<string, unknown> => {
  const schema = zodToJsonSchema(zod, { target: "openApi3" }) as Record<string, unknown>;
  rewriteTuplesForDraft2020(schema);
  return schema;
};
