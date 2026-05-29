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

// zod-to-json-schema's "openApi3" target emits the old `items: [schema,
// schema]` tuple form. The Anthropic API rejects that ("must match draft
// 2020-12"), but in practice also rejects the draft-2020-12 replacement
// `prefixItems`. Since every tuple we emit is homogeneous (e.g.
// year_range: [int, int]), collapse it to `items: <singleSchema>` —
// valid in every draft and unambiguous.
const stableStringify = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });

const rewriteTuplesForDraft2020 = (node: unknown): void => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(rewriteTuplesForDraft2020);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.type === "array" && Array.isArray(obj.items)) {
    const tuple = obj.items as unknown[];
    const allEqual =
      tuple.length > 0 &&
      tuple.every((it) => stableStringify(it) === stableStringify(tuple[0]));
    if (allEqual) {
      obj.items = tuple[0];
    } else {
      obj.prefixItems = tuple;
      delete obj.items;
    }
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
