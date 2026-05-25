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
    "tools/call list_agencies (no args)",
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "list_agencies", arguments: { limit: 3 } },
    },
  ],
  [
    "tools/call list_agencies name_contains=highway",
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "list_agencies",
        arguments: { name_contains: "highway", limit: 5 },
      },
    },
  ],
  [
    "tools/call list_agencies county=Boone",
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "list_agencies",
        arguments: { county: "Boone County", limit: 10 },
      },
    },
  ],
  [
    "tools/call agency_summary missouri-state-hwy-patrol",
    {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "agency_summary",
        arguments: { agency_id: "missouri-state-highway-patrol", year_range: [2023, 2024] },
      },
    },
  ],
  [
    "tools/call agency_summary unknown-agency",
    {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "agency_summary",
        arguments: { agency_id: "not-a-real-slug" },
      },
    },
  ],
  [
    "tools/call list_metrics contains=resident",
    {
      jsonrpc: "2.0",
      id: 40,
      method: "tools/call",
      params: {
        name: "list_metrics",
        arguments: { contains: "resident" },
      },
    },
  ],
  [
    "tools/call query_metric resident-stops top 5",
    {
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: {
        name: "query_metric",
        arguments: {
          canonical_key: "resident-stops",
          year_range: [2022, 2024],
          top_n: 5,
        },
      },
    },
  ],
  [
    "tools/call query_metric unknown key",
    {
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      params: {
        name: "query_metric",
        arguments: { canonical_key: "not-a-real-canonical-key" },
      },
    },
  ],
  [
    "tools/call top_n_by resident_stop_share ascending (default floor)",
    {
      jsonrpc: "2.0",
      id: 43,
      method: "tools/call",
      params: {
        name: "top_n_by",
        arguments: {
          metric: "resident_stop_share",
          ascending: true,
          year_range: [2022, 2024],
          n: 5,
        },
      },
    },
  ],
  [
    "tools/call top_n_by resident_stop_share min_total_stops=5000",
    {
      jsonrpc: "2.0",
      id: 44,
      method: "tools/call",
      params: {
        name: "top_n_by",
        arguments: {
          metric: "resident_stop_share",
          ascending: true,
          year_range: [2022, 2024],
          n: 5,
          min_total_stops: 5000,
        },
      },
    },
  ],
  [
    "tools/call agency_demographics st-louis-city-police-dept",
    {
      jsonrpc: "2.0",
      id: 45,
      method: "tools/call",
      params: {
        name: "agency_demographics",
        arguments: { agency_slug: "st-louis-city-police-dept" },
      },
    },
  ],
  [
    "tools/call agency_demographics MSHP (no jurisdiction)",
    {
      jsonrpc: "2.0",
      id: 46,
      method: "tools/call",
      params: {
        name: "agency_demographics",
        arguments: { agency_slug: "missouri-state-highway-patrol" },
      },
    },
  ],
  [
    "tools/call stop_share_vs_population_share st-louis-city",
    {
      jsonrpc: "2.0",
      id: 47,
      method: "tools/call",
      params: {
        name: "stop_share_vs_population_share",
        arguments: {
          agency_slug: "st-louis-city-police-dept",
          year_range: [2020, 2024],
        },
      },
    },
  ],
  [
    "tools/call top_n_by search_rate",
    {
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "top_n_by",
        arguments: { metric: "search_rate", n: 5 },
      },
    },
  ],
  [
    "tools/call top_n_by search_rate_minus_hit_rate",
    {
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "top_n_by",
        arguments: { metric: "search_rate_minus_hit_rate", n: 5 },
      },
    },
  ],
  [
    "tools/call top_n_by hispanic_stop_share county=Boone",
    {
      jsonrpc: "2.0",
      id: 14,
      method: "tools/call",
      params: {
        name: "top_n_by",
        arguments: { metric: "hispanic_stop_share", n: 5, ascending: false, county: "Boone County" },
      },
    },
  ],
  [
    "tools/call distribution citation_rate min 2500 stops",
    {
      jsonrpc: "2.0",
      id: 30,
      method: "tools/call",
      params: {
        name: "distribution",
        arguments: {
          metric: "citation_rate",
          min_sample_size: 2500,
          bins: 12,
          include_values: false,
        },
      },
    },
  ],
  [
    "tools/call trend hispanic_stop_share window 5 years",
    {
      jsonrpc: "2.0",
      id: 15,
      method: "tools/call",
      params: {
        name: "trend",
        arguments: {
          metric: "hispanic_stop_share",
          min_sample_size_per_year: 2000,
          min_years: 5,
          limit: 5,
        },
      },
    },
  ],
  [
    "tools/call trend search_rate window 10 years",
    {
      jsonrpc: "2.0",
      id: 16,
      method: "tools/call",
      params: {
        name: "trend",
        arguments: {
          metric: "search_rate",
          window_years: 10,
          min_sample_size_per_year: 5000,
          limit: 5,
        },
      },
    },
  ],
  [
    "tools/call disparity outcome_test statewide",
    {
      jsonrpc: "2.0",
      id: 17,
      method: "tools/call",
      params: {
        name: "disparity",
        arguments: { comparison_type: "outcome_test" },
      },
    },
  ],
  [
    "tools/call disparity hit_rate for MSHP",
    {
      jsonrpc: "2.0",
      id: 18,
      method: "tools/call",
      params: {
        name: "disparity",
        arguments: {
          comparison_type: "hit_rate",
          agency_id: "missouri-state-highway-patrol",
        },
      },
    },
  ],
  [
    "tools/call compare search_rate across 3 agencies",
    {
      jsonrpc: "2.0",
      id: 19,
      method: "tools/call",
      params: {
        name: "compare",
        arguments: {
          metric: "search_rate",
          agency_ids: [
            "missouri-state-highway-patrol",
            "columbia-police-dept",
            "kansas-city-police-dept",
          ],
        },
      },
    },
  ],
  [
    "tools/call make_map sample",
    {
      jsonrpc: "2.0",
      id: 20,
      method: "tools/call",
      params: {
        name: "make_map",
        arguments: {
          title: "Sample map: search rate, top 4 agencies (smoke test)",
          palette: "sequential",
          legend_label: "search rate (%)",
          values: {
            "missouri-state-highway-patrol": 4.8,
            "columbia-police-dept": 10.4,
            "kansas-city-police-dept": 1.3,
            "st-louis-county-police-dept": 6.5,
          },
        },
      },
    },
  ],
  [
    "tools/call unknown",
    {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "definitely_not_a_tool", arguments: {} },
    },
  ],
  ["notifications/initialized", { jsonrpc: "2.0", method: "notifications/initialized" }],
];

const TRIM = Number(process.env.TRIM ?? 200);
const trimText = (s: string, max = TRIM) =>
  s.length <= max ? s : `${s.slice(0, max)}… [${s.length} chars total]`;

import { writeFileSync } from "node:fs";

for (const [label, payload] of cases) {
  const result = await dispatch(JSON.stringify(payload));
  console.log(`\n=== ${label} → status ${result.status} ===`);
  if (!result.body) {
    console.log("(empty body)");
    continue;
  }
  const parsed = JSON.parse(result.body);
  const content = parsed.result?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item?.type === "text") item.text = trimText(item.text);
      if (item?.type === "image" && typeof item.mimeType === "string") {
        const ext = item.mimeType === "image/png" ? "png" : item.mimeType === "image/svg+xml" ? "svg" : "bin";
        const out = `/tmp/mcp-smoke-${parsed.id ?? "x"}.${ext}`;
        writeFileSync(out, Buffer.from(item.data, "base64"));
        item.data = `(${item.data.length} base64 chars; written to ${out})`;
      }
    }
  }
  if (typeof parsed.result?.instructions === "string") {
    parsed.result.instructions = trimText(parsed.result.instructions);
  }
  console.log(JSON.stringify(parsed, null, 2));
}
