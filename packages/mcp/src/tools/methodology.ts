import { ABOUT_THE_DATA_MD } from "../content/about-the-data.gen.js";
import { registerTool, textResult } from "./registry.js";

const MCP_SEMANTICS = `
---

## MCP semantics — how the curated tools interpret this data

The narrative above describes the dataset as published. The notes below describe how this MCP server's curated tools compute and report rates, what statistical machinery they apply, and where they refuse to answer.

### Race categories (as the tools report them)

Race in this dataset is **officer-perceived**, not driver-self-reported. The categories are: White, Black, Hispanic, Asian, Native American, Other. "Hispanic" is recorded as a race-line on the reporting form (not a separate ethnicity field), which is a known deviation from the Census schema. When this server reports a "Hispanic stop share," it means the share of stops where the officer recorded the driver's race as Hispanic.

### Key metric definitions (tool-reporting units)

- **Stop rate**: stops per 1,000 driving-age residents of the matching race in the agency's jurisdiction. Population denominators come from the most recent ACS or decennial census available for the year being reported.
- **Search rate**: \`searches / stops\` for the agency × year × race, reported as a **percentage (0–100 scale, not a 0–1 decimal)**. Includes consent, probable-cause, and inventory searches. Does not distinguish search type for the top-line search-rate metric; per-type breakdowns are available via the \`probable-cause--\` metric family.
- **Contraband hit rate**: \`contraband_found / searches\` for the agency × year × race, reported as a **percentage (0–100 scale)**. Counts a search as a "hit" if any contraband (drugs, weapons, currency, stolen property, alcohol, other) was recovered.
- **Search rate minus hit rate**: a single-number proxy for the outcome test (see below). When two agencies have the same search rate, the one with the lower hit rate is searching more aggressively at the margin.
- **Disparity index**: \`stop_rate_minority / stop_rate_white_non_hispanic\`. A value of 1.0 means parity with white drivers; values above 1.0 mean the minority race is stopped at a higher rate per resident. The denominator is white non-Hispanic by convention. Multiple variants exist for different population baselines (decennial vs. ACS; all-stops vs. resident-stops); call \`read_schema()\` for the full list.
- **Resident vs. non-resident stops**: agencies distinguish stops of jurisdiction residents from non-residents. The "resident-stops" disparity variants use only resident stops in the numerator, which controls for through-traffic patterns at the cost of smaller sample sizes.

### The outcome test (Knowles, Persico & Todd 2001)

The \`disparity\` tool implements the classic outcome test for racial bias in search decisions. The intuition: if officers applied the same threshold of suspicion to all drivers, the contraband hit rate would be equalized across groups at the margin. A pattern where one race is searched at a higher rate **and** contraband is found at a lower rate is consistent with a lower threshold of suspicion being applied to that race. The outcome test does **not** directly prove discrimination — selection effects (different distributions of suspicious behavior, different stop contexts) can produce similar patterns — but it is the standard quantitative test in the policing literature.

The tool returns search rate and hit rate by race and the ratio (minority / white non-Hispanic) for each. It does **not** editorialize on what the pattern means in the result body; that interpretation is on you.

### Trend methodology

The \`trend\` tool fits a simple ordinary-least-squares linear regression of the annual metric value on the year, per group. It returns slope (units per year), 95% confidence interval, two-sided p-value (Student's t on n-2 degrees of freedom), \`n_years\` in the window, and the mean annual sample size. Groups whose annual sample sizes fall below the per-metric minimum are excluded. Treat the slope as directional: it is not predictive, it does not handle non-linear trends, and it is sensitive to outlier years in short windows.

### Sample-size minimums

- **Search rate**: requires ≥500 stops in the window (per group, per year for trends)
- **Contraband hit rate**: requires ≥50 searches in the window
- **Disparity index / stop rate**: requires ≥100 stops in the window per race
- **Trend slope**: requires ≥5 years of data per group, each above the underlying metric's minimum

Tool calls that fall below these thresholds return "insufficient data" for the affected group rather than computing an unreliable rate. This is intentional. Do not work around it by lowering thresholds in tool arguments.

### Limitations to flag in your answers

- Race is officer-perceived, not self-reported, and may not match the driver's identification.
- The "Hispanic" category is a known deviation from the Census schema (recorded as a race line, not a separate ethnicity field).
- Pre-2020 filings use a different reporting form than post-2020 filings. Schema normalization in this dataset is best-effort but some metrics are era-specific.
- Years 2001–2003 have partial coverage — many agencies' filings are missing or incomplete.
- The data records what was filed, not what happened. Agencies that under-report are under-represented; agencies that over-report (e.g. by counting non-traffic encounters) are over-represented.

---

## What this dataset CANNOT answer

The row model is **one metric, per agency, per year, broken down by race only**. Anything that requires a different cross-tab, finer time granularity, or unit-of-analysis below the agency-year does not exist in this data — do not invent it.

**No cross-tabs beyond race.** Each metric row has at most one breakdown axis: race columns (White / Black / Hispanic / Asian / Native American / Other / Total). Gender, age, stop reason, stop outcome, location, officer assignment, probable-cause type, contraband type, search duration — each is its own metric family with race columns only. So:

- ❌ "Searches of Black drivers who were also male" — gender and race are separate metrics, not crossed.
- ❌ "Hit rate on 18–29 year-old Hispanic drivers" — age and race are separate metrics.
- ❌ "Consent searches that turned up drugs vs weapons by race" — probable-cause type and contraband type are not crossed with each other.

**No sub-annual time resolution.** The unit is the calendar year. There is no month, day, time-of-day, or day-of-week.

**No individual-level records.** Everything is aggregate counts the agency filed. There are no driver IDs, no stop IDs, no event-level rows. You cannot identify repeat stops of the same driver, link a stop to a downstream prosecution, or compute medians/quantiles over individual encounters.

**No officer-level breakdown.** Filings are at the agency level. There is no officer identifier, badge number, or per-officer counts.

**No within-jurisdiction geography.** Stops have an agency and a stop-location *category* (city street / county road / interstate / etc.), but no lat/lon, no street, no neighborhood, no beat.

**No driver disposition past the stop.** Arrests and citations are counted, but the dataset does not track charges filed, plea outcomes, sentences, or whether contraband led to a conviction.

**No cross-agency event linkage.** Multi-agency stops (e.g., MSHP plus a county sheriff at the same scene) are not deduplicated or linked.

If a user asks a question that requires any of the above, **say so plainly** rather than approximating with adjacent metrics. The right answer is often "the Missouri VSR doesn't collect that; you'd need [other dataset]."
`;

const METHODOLOGY = ABOUT_THE_DATA_MD + MCP_SEMANTICS;

registerTool({
  name: "read_methodology",
  description:
    "Returns the long-form methodology document for the Missouri Vehicle Stops Report dataset as markdown. Call this BEFORE answering substantive questions — it covers (1) what the dataset is and where it came from, (2) the row/key/name normalization that makes era-spanning analysis possible, (3) precise definitions of 'stop', 'search rate', 'hit rate', 'disparity index' as this server reports them, (4) sample-size minimums baked into the tools, and (5) **what this dataset CANNOT answer** — including which cross-tabs (race × gender, race × age, etc.) do not exist. Skipping this leads to invented metrics and false cross-tabs.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  handler: () => textResult(METHODOLOGY),
});
