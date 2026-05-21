# Missouri VSR MCP Server

Public Model Context Protocol server in front of the Missouri Vehicle Stops Report dataset. Lets a journalist or researcher in Claude Desktop (or any MCP client) ask methodologically defensible questions against the data, with citations back to the underlying tools.

See [issue #156](https://github.com/recoveredfactory/missouri-vsr-tool/issues/156) for the full spec.

## Status

Scaffold. Lambda handler stub, no tools wired yet.

## Stack

- Node.js / TypeScript
- `@modelcontextprotocol/sdk` (Streamable HTTP transport)
- `@duckdb/node-api` against the existing data CDN
- Deployed via SST as a single `sst.aws.Function` with a Function URL

## Architectural choices

- **No raw SQL escape hatch.** Every analytical path is a curated tool with documented methodology.
- **Map output is styled SVG**, not PNG. `make_map` injects CSS into the existing `mo_locator.svg`.
- See `memory/project_mcp_server.md` (private) or issue #156 for the full rationale.

## Tool surface (target)

1. `read_methodology()` + `read_schema()`
2. `list_agencies(filters)` + `agency_summary(agency_id, year_range)`
3. `top_n_by(metric, n, filters)`
4. `trend(metric, group_by, window, min_sample_size)`
5. `disparity(comparison_type, agency_filter, year_range)`
6. `compare(metric, agency_ids, year_range)`
7. `make_map(values, title, palette)` → SVG
