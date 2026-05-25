# Missouri Vehicle Stops Report — MCP Server

A public [Model Context Protocol](https://modelcontextprotocol.io) server that lets a journalist or researcher in [Claude Desktop](https://claude.ai/download) (or any MCP client) ask methodologically defensible questions against [Missouri's mandatory vehicle-stops dataset](https://ago.mo.gov/home/vehicle-stops-report) — search rates, contraband hit rates, racial disparity ratios, year-over-year trends — and get answers with citations back to the curated tool that produced them. No SQL access, no model-invented metrics: every numeric path goes through a curated tool with a documented methodology and sample-size minimums baked in.

## How to connect

The server speaks Streamable HTTP MCP over a single endpoint:

```
https://d1w5qatcgl0dry.cloudfront.net/
```

(Staging — this is what's live as of the latest deploy. A production endpoint at `mcp.vsr.recoveredfactory.net` is planned; for now use the CloudFront URL.)

### Claude Desktop (Mac/Windows)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or `%APPDATA%\Claude\claude_desktop_config.json` on Windows:

```json
{
  "mcpServers": {
    "missouri-vsr": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://d1w5qatcgl0dry.cloudfront.net/"
      ]
    }
  }
}
```

Restart Claude Desktop. You should see a tool icon appear in the chat box. Tell it "use the Missouri VSR tool and call read_methodology" to confirm.

### Other clients

Any MCP client that supports Streamable HTTP transport can connect to the same URL directly via POST. Each request is a JSON-RPC 2.0 message:

```bash
curl -X POST https://d1w5qatcgl0dry.cloudfront.net/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## What's available

| Tool | What it does |
|---|---|
| `read_methodology` | Long-form methodology doc — definitions of stop, search rate, hit rate, disparity index, outcome test, and what each does and doesn't prove. **Call this first.** |
| `read_schema` | DuckDB schema for the three tables backing the server. |
| `list_agencies` | Resolves loose agency names → stable slugs. Filters: name substring, county, min lifetime stops. |
| `list_metrics` | Empirically scanned index of every canonical_key in the loaded data — years present, race columns populated, agency-year row count, type heuristic (count / rate / ratio / population). Call this when you're not sure a metric exists. |
| `query_metric` | Raw per-agency × per-year values for any canonical_key. No cross-year aggregation, no derivations — exactly what the agency filed. Optional ranking by latest-year value. Pair with `list_metrics` to discover keys. |
| `agency_summary` | Multi-year curated slice (stops / searches / contraband / arrests / citations + rates + disparity index) for one agency, broken down by race. |
| `agency_demographics` | ACS jurisdiction census data for one agency — race composition (mapped to stops-data labels), age, sex, median household income, per-capita income. Honest null for state-level agencies with no jurisdiction. |
| `stop_share_vs_population_share` | Paired comparison: agency's stop-share-by-race (summed across a year window) against jurisdiction's ACS population-share-by-race. Composite data tool; Claude charts from the JSON. |
| `top_n_by` | Ranks agencies by one of ten curated **derived** metrics (search rate, contraband hit rate, citation rate, arrest rate, search-rate-minus-hit-rate, Hispanic/Black stop share, resident stop share, disparity index, total stops). Per-metric sample-size minimums baked in. For raw values of any canonical_key, use `query_metric`. |
| `trend` | Linear OLS regression of an annual metric against year, per agency, with 95% CI and two-sided p-value. Filters thin years. |
| `disparity` | Knowles/Persico/Todd (2001) outcome test — search rate by race + hit rate conditional on search + ratios vs. white non-Hispanic. Scopes to a single agency, a county, or statewide. |
| `compare` | Side-by-side metric values for 1–20 named agencies + an implicit statewide-median row. |
| `make_map` | Renders the project's `mo_locator.svg` with CSS fill rules injected for each passed-in agency slug, rasterized to PNG (most chat clients can't render SVG image content). |

The split between `query_metric` (raw reads) and `top_n_by` (curated derivations) is intentional: derivations need sample-size guards and methodology notes; raw reads just need to surface what the agency filed. Every ranking response includes a `ranking_caveat` field — read it before quoting an order.

**Sample-size guardrails:** `top_n_by`, `query_metric`, and `distribution` all default to `min_total_stops=500` (≈1 stop every 4 days in a 5-year window) — micros are excluded by default. Every per-agency row carries `total_stops_in_window` and a `low_volume_warning` flag (set when below 2,500 stops in window). When any returned agencies are low-volume, the response includes a LOUD `low_volume_warning_summary` field naming them so the LLM can flag them in its answer. The server instructions ask the LLM to *pause and confirm the floor with the user* before running rankings unless the user has already specified one in conversation.

## Three example transcripts

Each example shows the question, the tool calls the model issued, and the kind of answer to expect. (Real screenshots will land here once the server clears its first week of use.)

### 1. "Which Missouri agencies have rising Hispanic stop share over the last five years?"

The model calls `read_methodology` to learn that "Hispanic" is an officer-recorded race line (not a separate ethnicity field), then `trend(metric: "hispanic_stop_share", window_years: 5, min_sample_size_per_year: 2000, min_years: 5)`. The tool fits OLS per agency and returns slopes with 95% CIs and p-values. Sample answer:

> Three agencies show a statistically significant rise in Hispanic stop share over 2020–2024 (p < 0.05): **St Joseph PD** (+0.94 percentage points/year, p=0.04, R²=0.79), **Independence PD** (+0.92pp/year, p=0.01, R²=0.90), and **Marshall PD** (+0.87pp/year, p=0.008, R²=0.93). Sample sizes are healthy (mean 2,000–15,000 stops per year per agency). Note that "Hispanic" here is officer-perceived — see `read_methodology` for the caveat.

### 2. "Show me agencies with high contraband hit rates and low search rates."

The model recognizes this is the outcome-test framing and calls `top_n_by(metric: "search_rate_minus_hit_rate", ascending: true, n: 10)`. Low values = aggressive searching with low yield (an outcome-test signal). Sample answer:

> Agencies with the most aggressive search-to-yield ratio (lowest search_rate_minus_hit_rate) over 2020–2024 — meaning many searches relative to how often contraband was actually found:
>
> | Agency | Search rate | Hit rate | Gap |
> | --- | --- | --- | --- |
> | Carter County Sheriff's Dept | 9.4% | 9.4% (73 finds in 774 searches) | -0.015 |
> | Senath PD | 0.46% | 50.0% | 0.028 |
> | ... |
>
> Interpretation belongs to the reader; the outcome test surfaces patterns consistent with a lower suspicion threshold being applied to whatever the agencies are searching, but selection effects can produce similar patterns (see `read_methodology`).

### 3. "Map the disparity index for traffic stops in 2023, focused on counties around St. Louis."

The model calls `list_agencies(county: "St. Louis County")` to get slugs, then `top_n_by(metric: "disparity_index_all_stops", year_range: [2023, 2023], county: "St. Louis County", n: 20)`, then passes the {slug: value} dict into `make_map(palette: "diverging", title: "Disparity index, St. Louis area, 2023")`. The result is a PNG of Missouri with the affected agencies colored by their disparity index, white non-Hispanic baseline at 1.0. The model embeds the image and notes that the diverging palette centers at zero, so red = above parity and blue = below.

## Methodology

Identical to what `read_methodology` returns at runtime. Reproduced here for offline reading.

> The Missouri Attorney General's Office is required by [RSMo 590.650](https://revisor.mo.gov/main/OneSection.aspx?section=590.650) to collect vehicle-stop reports from every law enforcement agency in the state. Agencies file annual aggregate counts broken down by perceived driver race, stop reason, stop outcome, and search/contraband disposition. This server normalizes those filings from 2001–2024.
>
> A "stop" is a single vehicle-stop record as filed by the reporting agency. The unit is the stop, not the driver and not the encounter.
>
> Race is **officer-perceived**, not driver-self-reported. The categories are White, Black, Hispanic, Asian, Native American, Other. "Hispanic" is recorded as a race line on the reporting form (not a separate ethnicity field) — a deviation from the Census schema.
>
> - **Search rate** = `searches / stops`, reported as a percentage (0–100). Includes consent, probable-cause, and inventory searches.
> - **Contraband hit rate** = `contraband_found / searches`, reported as a percentage (0–100). Drugs / weapons / currency / stolen property / alcohol / other.
> - **Disparity index** = `stop_rate_minority / stop_rate_white_non_hispanic` (1.0 = parity).
> - **Outcome test** (Knowles, Persico, Todd 2001): if officers applied the same threshold of suspicion across groups, the hit rate would equalize at the margin. A pattern where a group is searched more **and** finds contraband less is *consistent with* a lower threshold applied to that group — not direct proof of discrimination.
>
> Sample-size minimums: 500 stops for search-rate-style metrics; 50 searches for hit-rate-style metrics; 5 years of qualifying data for trend slopes. Tool calls below these thresholds return "insufficient data" for the affected group rather than computing an unreliable rate. This is intentional.

## Limitations

- Race is officer-perceived, not self-reported.
- "Hispanic" is a race line, not a separate ethnicity field — a known deviation from Census conventions.
- The reporting form was substantially revised in 2020. Pre-2020 metrics are normalized to canonical keys best-effort; some categories have no clean post-2020 equivalent.
- 2001–2003 have partial coverage; many agencies' filings are missing.
- OLS trend slopes are **directional, not predictive**. They assume linearity over the window and are sensitive to outlier years in short series.
- The outcome test does **not** directly prove discrimination — selection effects can produce identical patterns. See the original [Knowles/Persico/Todd 2001](https://www.jstor.org/stable/2696570) paper.
- The data records what was filed, not what happened. Agencies that under-report are under-represented; agencies that over-report (e.g. count non-traffic encounters) are over-represented.

## Rate limits

Public endpoint, no auth. AWS WAF rate-based rule: **~3,000 requests per 5-minute window per IP** (≈10/s sustained). Excess requests get a 403. If you have a legitimate use case that needs higher limits, [open an issue](https://github.com/recoveredfactory/missouri-vsr-tool/issues/new) — we can issue a higher tier or share a snapshot for offline use.

## Architecture (text diagram)

```
                  ┌──────────────────────────────────────┐
                  │  Pipeline (separate repo)            │
                  │  - emits Parquet, JSON, mo_locator   │
                  │    to S3 / CloudFront                │
                  └────────────────┬─────────────────────┘
                                   │ HTTPS (HTTP/1.1)
                                   │ fetched at cold start
                                   ▼
   ┌────────┐    ┌─────────┐    ┌─────────────────────────────┐
   │ Client │──▶│CloudFront│──▶│  Lambda (Node 22, 1GB)      │
   │ (MCP)  │   │ + WAF    │   │  - JSON-RPC dispatch        │
   │        │◀──│ rate-    │◀──│  - DuckDB in-memory         │
   └────────┘   │ limit    │   │  - 9 curated tools          │
                └─────────┘    └─────────────────────────────┘
```

CloudFront caches nothing (POST bodies must pass through); WAF gates traffic by IP; the Lambda's cold start pre-fetches the ~76MB of source data over HTTP/1.1 (working around an HTTP/2 streaming bug in DuckDB's httpfs), materializes a slim `stops` table, and stays warm for subsequent invocations.

## Local development

```bash
pnpm install
pnpm -F @missouri-vsr-tool/mcp build
node packages/mcp/dist/smoke.js
```

The smoke runner exercises every tool end-to-end and writes any generated images to `/tmp/mcp-smoke-*.{png,svg}` for eyeballing.

## License

MIT. See [LICENSE](../../LICENSE) in the repo root.

## Contributing

The MCP server lives in `packages/mcp/` of the [missouri-vsr-tool](https://github.com/recoveredfactory/missouri-vsr-tool) monorepo. Issues and PRs welcome — see [issue #156](https://github.com/recoveredfactory/missouri-vsr-tool/issues/156) for the original spec and design notes.
