import { registerTool, textResult } from "./registry.js";

const SCHEMA = `# DuckDB schema for the Missouri Vehicle Stops Report MCP server

The analytical tools query an in-memory DuckDB instance loaded at cold start from the public data CDN. Three tables are available.

## \`agencies\`

One row per reporting law-enforcement agency.

| Column | Type | Description |
|---|---|---|
| \`agency_slug\` | TEXT | Stable slug identifier used throughout the dataset (e.g. \`missouri-state-hwy-patrol\`). Use this as the primary key when joining or filtering. |
| \`canonical_name\` | TEXT | Canonical display name for the agency. |
| \`county\` | TEXT | Missouri county the agency operates in. Statewide and multi-county agencies have NULL. |
| \`agency_type\` | TEXT | Category: \`municipal\`, \`county\`, \`state\`, \`college\`, \`other\`. |
| \`years_present\` | INTEGER[] | Sorted list of years the agency filed at least one stop. |
| \`latest_year_with_data\` | INTEGER | The most recent year with non-zero stops on file. |
| \`program_287g_active\` | BOOLEAN | True if the agency was on ICE's most-recent published 287(g) Participating Agencies snapshot. This is point-in-time — the field reflects ACTIVE status on the snapshot_date only; agencies that terminated between snapshots are not visible. Call \`list_287g_participants\` for the snapshot date, agreement details (Task Force Model / Jail Enforcement / Warrant Service Officer, signed_date, MOA URL), and full caveats. \`agency_summary\` attaches the same participation block per-agency when present. |

## \`stops\`

One row per agency × year × metric. This is a wide-format table — race breakdowns live in columns, not rows.

| Column | Type | Description |
|---|---|---|
| \`agency_slug\` | TEXT | Foreign key to \`agencies.agency_slug\`. |
| \`year\` | INTEGER | Calendar year of the filing. |
| \`metric\` | TEXT | Canonical metric key. Call \`list_metrics()\` for the full empirically scanned set (years covered, race columns populated). Examples: \`stops\`, \`searches\`, \`search-rate\`, \`contraband-hit-rate\`, \`disparity-index--all-stops\`, \`stop-outcome--warning\`, \`resident-stops\`. |
| \`Total\` | DOUBLE | Total value for the metric in that agency × year, across all races. For count metrics this is a raw count; for rate metrics it is the all-race rate. |
| \`White\` | DOUBLE | Value for white drivers. |
| \`Black\` | DOUBLE | Value for Black drivers. |
| \`Hispanic\` | DOUBLE | Value for Hispanic drivers (officer-recorded race line). |
| \`Asian\` | DOUBLE | Value for Asian drivers. |
| \`Native American\` | DOUBLE | Value for Native American drivers. |
| \`Other\` | DOUBLE | Value for drivers in the "Other" category. |

A NULL race column means the agency did not file a value for that race × metric × year combination (often because the underlying count was below the agency's reporting threshold or because the metric is undefined for that group).

## \`comments\`

Free-text notes that some agencies submit with their annual filings. Sparsely populated; most agency × year combinations have no comment.

| Column | Type | Description |
|---|---|---|
| \`agency_slug\` | TEXT | Foreign key. |
| \`year\` | INTEGER | Filing year. |
| \`comment\` | TEXT | Agency-submitted free text. |

## Coverage notes

- Years **2001–2003** have partial coverage. Many agencies' filings are missing or incomplete from this period; numbers are not directly comparable to later years.
- The schema was **substantially revised in 2020**. Pre-2020 metrics are normalized to a unified canonical key where possible, but some categories have no clean post-2020 equivalent and vice versa.
- The dataset includes 600+ reporting agencies across 24+ years. Cold-start DuckDB load is approximately one second.

## How to query without raw SQL

There is no raw \`query()\` tool. The analytical surface splits along one axis:

- **Raw reads** via \`query_metric(canonical_key, ...)\`: per-agency × per-year values of any canonical_key, exactly as filed. No aggregation across years, no derivations. Use \`list_metrics()\` first to find the right key and confirm what years and race columns it covers.
- **Curated derivations** via \`top_n_by\`, \`trend\`, \`disparity\`, \`compare\`, \`agency_summary\`: rates, ratios, statistical fits, and other computed metrics with sample-size guards baked in.

If a question requires a derivation neither tool computes, surface that to the user — do not approximate by combining unrelated tool outputs.
`;

registerTool({
  name: "read_schema",
  description:
    "Returns the DuckDB schema for the three tables backing this server (\`agencies\`, \`stops\`, \`comments\`) with column descriptions, coverage notes, and an explicit reminder that no raw SQL access is available. Useful for understanding what data is queryable before calling an analytical tool.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  handler: () => textResult(SCHEMA),
});
