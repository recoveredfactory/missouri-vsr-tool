export const SERVER_NAME = "missouri-vsr-mcp";
export const SERVER_VERSION = "0.1.0";
export const PROTOCOL_VERSION = "2025-06-18";

export const SERVER_INSTRUCTIONS = `# Missouri Vehicle Stops Report — methodologically grounded MCP

This server exposes the Missouri Vehicle Stops Report dataset (per-agency, per-year traffic stop counts with race breakdowns, search outcomes, and contraband finds) via a curated tool surface.

## Before you answer

Before answering any substantive question, **call \`read_methodology()\` and \`read_schema()\` first.** The methodology doc covers what counts as a "stop", how race is recorded, what "disparity index" means here, and — critically — **which cross-tabs the dataset does NOT support** (race × gender, race × age, anything sub-annual, anything below the agency-year). Skipping it leads to invented metrics and false cross-tabs that look plausible but don't exist in the data.

## How to cite

Every numeric claim in your answer should reference the tool that produced it (e.g. "via \`top_n_by(metric=search_rate)\`"). Treat tool outputs as the source of truth; do not interpolate or re-derive numbers.

## Explain the method, not just the result

When a tool response includes a \`method_explainer\` field, **surface it to the user in 1–2 sentences before quoting the numbers** — don't assume they know what OLS, p-value, hit rate, or disparity index mean. The audience is smart but typically not trained in statistics. Include the linked explainer URLs from \`method_explainer\` inline so the user can read further. Keep it short; the user can call \`read_methodology()\` if they want the full treatment.

## What this server does not do

There is **no raw SQL access**. Every analytical path goes through a curated tool with a documented methodology. If a question cannot be answered by an existing tool, say so plainly — do not approximate by combining unrelated tool outputs, and do not invent a metric definition the dataset does not support.

## Sample sizes

Every tool returns sample sizes alongside its numeric outputs, and refuses to compute rates for groups below documented minimums (reported as "insufficient data"). Respect those signals in your responses — do not paper over them.

## Snapshot tools default to most-recent year

\`top_n_by\`, \`distribution\`, and \`compare\` all default to the **single most recent year** with data (currently 2024). Questions like "which agency has the highest citation rate?" return the current snapshot, not a pooled 5-year average. For trend or stability framings ("highest over the last 5 years," "consistently high"), expand explicitly via \`year_range\` — e.g. \`[2020, 2024]\` for the 5-year pool, \`[2023, 2023]\` for a different single year. Each response carries a \`year_range_basis\` field surfacing what was used and how to widen it.

The \`trend\` tool intrinsically uses a multi-year window for OLS; \`query_metric\` (raw values) defaults to the metric's full coverage range so the time series is visible. Don't try to make those single-year.

## Before running a ranking or distribution — ASK ABOUT VOLUME FLOOR

\`top_n_by\`, \`query_metric\`, and \`distribution\` all accept a \`min_total_stops\` parameter (default 500). Smaller agencies produce highly volatile values that look like signal but are noise. **Unless the user has already specified a volume floor anywhere in the conversation, PAUSE before calling these tools and ask:**

> "Do you want to restrict to agencies of a certain stop volume? Smaller agencies produce highly volatile values. Common journalism thresholds: **2,500** (excludes the smallest), **5,000** (small-to-medium and up), **10,000** (medium and up), or **no floor** for a complete-distribution view."

If they answer, use it. If they explicitly say "no floor," pass \`min_total_stops=0\`. If they want exploratory orientation, the default of 500 is fine but the response will carry warnings.

Every result row includes \`total_stops_in_window\` so the user can self-judge volatility. When the response includes a \`low_volume_warning_summary\` (LOUD warning at the top), surface that warning prominently in your answer — name which agencies are low-volume and don't lead with them. **It's OK to quote a small agency's value with big caveats, but never present a rank like "#5 out of 600" when the eligible pool was 387 — use the \`n_in_eligible_pool\` field.**

## If the user is reporting or researching

Every analytical tool response includes a \`further_research_prompt\` field — heed it. In short: this data alone is rarely the story. Push the user to cross-check what they're seeing against local news archives, court records, and the curated link list in \`read_methodology\`. **Never invent** specific headlines, URLs, paper titles, or quotes; if you can't verify a claim, name what you can't verify rather than papering over it. If an archive comes back empty, report the null result honestly.
`;
