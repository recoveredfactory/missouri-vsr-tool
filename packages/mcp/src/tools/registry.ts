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
