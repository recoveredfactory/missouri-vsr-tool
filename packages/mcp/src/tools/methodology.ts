import { registerTool, textResult } from "./registry.js";

const METHODOLOGY = `# Missouri Vehicle Stops Report — Methodology

## Source

The Missouri Attorney General's Office is required by RSMo 590.650 to collect vehicle-stop reports from every law enforcement agency that conducts traffic stops in the state. Agencies report aggregate counts annually, broken down by perceived driver race, stop reason, stop outcome, and search/contraband disposition. This dataset normalizes those filings from 2001 through the most recent published year.

## What "stops" means

A "stop" is a single vehicle-stop record as filed by the reporting agency. The unit is the stop, not the driver and not the encounter — a single driver who was stopped twice in a year contributes two stops. Stops where no race was recorded are excluded from race-broken metrics but counted in totals.

## Race categories

Race in this dataset is **officer-perceived**, not driver-self-reported. The categories are: White, Black, Hispanic, Asian, Native American, Other. "Hispanic" is recorded as a race-line on the reporting form (not a separate ethnicity field), which is a deviation from the Census schema and a known data limitation. When this server reports a "Hispanic stop share," it means the share of stops where the officer recorded the driver's race as Hispanic.

## Key metric definitions

- **Stop rate**: stops per 1,000 driving-age residents of the matching race in the agency's jurisdiction. Population denominators come from the most recent ACS or decennial census available for the year being reported. For pre-2020 years the dataset includes the historical "disparity index" denominators the AG's office used at the time.

- **Search rate**: \`searches / stops\` for the agency × year × race. Includes consent searches, probable-cause searches, and inventory searches. Does not distinguish search type for the top-line search-rate metric; per-type breakdowns are available via the \`probable-cause--\` metric family.

- **Contraband hit rate**: \`contraband_found / searches\` for the agency × year × race. Counts a search as a "hit" if any contraband (drugs, weapons, currency, stolen property, alcohol, other) was recovered. Searches with no contraband recorded are counted as misses.

- **Search rate minus hit rate**: a single-number proxy for the outcome test (see below). When two agencies have the same search rate, the one with the lower hit rate is searching more aggressively at the margin.

- **Disparity index**: \`stop_rate_minority / stop_rate_white_non_hispanic\`. A value of 1.0 means parity with white drivers; values above 1.0 mean the minority race is stopped at a higher rate per resident. The denominator is white non-Hispanic by convention. Multiple variants exist for different population baselines (decennial vs. ACS; all-stops vs. resident-stops); the \`read_schema()\` tool lists every variant present in the data.

- **Resident vs. non-resident stops**: agencies distinguish stops of jurisdiction residents from non-residents. The "resident-stops" disparity variants use only resident stops in the numerator, which controls for through-traffic patterns at the cost of smaller sample sizes.

## The outcome test (Knowles, Persico & Todd 2001)

The \`disparity\` tool implements the classic outcome test for racial bias in search decisions. The intuition: if officers applied the same threshold of suspicion to all drivers, the contraband hit rate would be equalized across groups at the margin. A pattern where one race is searched at a higher rate **and** contraband is found at a lower rate is consistent with a lower threshold of suspicion being applied to that race. The outcome test does not directly prove discrimination — selection effects (different distributions of suspicious behavior, different stop contexts) can produce similar patterns — but it is the standard quantitative test in the policing literature.

The tool returns search rate and hit rate by race and the ratio (minority / white non-Hispanic) for each. It does **not** editorialize on what the pattern means in the result body; that interpretation is on you.

## Trend methodology

The \`trend\` tool fits a simple ordinary-least-squares linear regression of the annual metric value on the year, per group. It returns slope (units per year), 95% confidence interval, two-sided p-value (Student's t on n-2 degrees of freedom), \`n_years\` in the window, and the mean annual sample size. Groups whose annual sample sizes fall below the per-metric minimum are excluded. Treat the slope as directional: it is not predictive, it does not handle non-linear trends, and it is sensitive to outlier years in short windows.

## Sample-size minimums

- **Search rate**: requires ≥500 stops in the window (per group, per year for trends)
- **Contraband hit rate**: requires ≥50 searches in the window
- **Disparity index / stop rate**: requires ≥100 stops in the window per race
- **Trend slope**: requires ≥5 years of data per group, each above the underlying metric's minimum

Tool calls that fall below these thresholds return "insufficient data" for the affected group rather than computing an unreliable rate. This is intentional. Do not work around it by lowering thresholds in tool arguments.

## Limitations to flag in your answers

- Race is officer-perceived, not self-reported, and may not match the driver's identification.
- The "Hispanic" category is a known deviation from the Census schema (recorded as a race line, not a separate ethnicity field).
- Pre-2020 filings use a different reporting form than post-2020 filings. Schema normalization in this dataset is best-effort but some metrics are era-specific.
- Years 2001–2003 have partial coverage — many agencies' filings are missing or incomplete. The \`read_schema()\` tool flags this.
- The data records what was filed, not what happened. Agencies that under-report are under-represented; agencies that over-report (e.g. by counting non-traffic encounters) are over-represented.
`;

registerTool({
  name: "read_methodology",
  description:
    "Returns the long-form methodology document for the Missouri Vehicle Stops Report dataset as markdown. Call this BEFORE answering substantive questions — it defines what 'stop', 'search rate', 'hit rate', 'disparity index', and other metric names mean in this specific dataset, and what the outcome test does and does not prove.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  handler: () => textResult(METHODOLOGY),
});
