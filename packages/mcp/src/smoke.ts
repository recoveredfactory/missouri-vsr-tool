import { dispatch } from "./dispatch.js";

const cases: Array<[string, object]> = [
  [
    "initialize",
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke", version: "0" },
      },
    },
  ],
  ["ping", { jsonrpc: "2.0", id: 2, method: "ping" }],
  ["tools/list", { jsonrpc: "2.0", id: 3, method: "tools/list" }],
  [
    "tools/call read_methodology",
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "read_methodology", arguments: {} },
    },
  ],
  [
    "tools/call read_schema",
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "read_schema", arguments: {} },
    },
  ],
  [
    "tools/call unknown",
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "definitely_not_a_tool", arguments: {} },
    },
  ],
  ["notifications/initialized", { jsonrpc: "2.0", method: "notifications/initialized" }],
];

const trimText = (s: string, max = 200) =>
  s.length <= max ? s : `${s.slice(0, max)}… [${s.length} chars total]`;

for (const [label, payload] of cases) {
  const result = await dispatch(JSON.stringify(payload));
  console.log(`\n=== ${label} → status ${result.status} ===`);
  if (!result.body) {
    console.log("(empty body)");
    continue;
  }
  const parsed = JSON.parse(result.body);
  if (
    parsed.result?.content?.[0]?.type === "text"
  ) {
    parsed.result.content[0].text = trimText(parsed.result.content[0].text);
  }
  if (typeof parsed.result?.instructions === "string") {
    parsed.result.instructions = trimText(parsed.result.instructions);
  }
  console.log(JSON.stringify(parsed, null, 2));
}
