export const SERVER_NAME = "missouri-vsr-mcp";
export const SERVER_VERSION = "0.1.0";
export const PROTOCOL_VERSION = "2025-06-18";

export const SERVER_INSTRUCTIONS = `# Missouri Vehicle Stops Report — methodologically grounded MCP

This server exposes the Missouri Vehicle Stops Report dataset (per-agency, per-year traffic stop counts with race breakdowns, search outcomes, and contraband finds) via a curated tool surface.

## Before you answer

Before answering any substantive question, **call \`read_methodology()\` and \`read_schema()\` first.** The methodology doc covers what counts as a "stop", how race is recorded, what "disparity index" means here, and — critically — **which cross-tabs the dataset does NOT support** (race × gender, race × age, anything sub-annual, anything below the agency-year). Skipping it leads to invented metrics and false cross-tabs that look plausible but don't exist in the data.

## How to cite

Every numeric claim in your answer should reference the tool that produced it (e.g. "via \`top_n_by(metric=search_rate)\`"). Treat tool outputs as the source of truth; do not interpolate or re-derive numbers.

## What this server does not do

There is **no raw SQL access**. Every analytical path goes through a curated tool with a documented methodology. If a question cannot be answered by an existing tool, say so plainly — do not approximate by combining unrelated tool outputs, and do not invent a metric definition the dataset does not support.

## Sample sizes

Every tool returns sample sizes alongside its numeric outputs, and refuses to compute rates for groups below documented minimums (reported as "insufficient data"). Respect those signals in your responses — do not paper over them.
`;
