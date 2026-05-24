import { ABOUT_THE_DATA_MD } from "../content/about-the-data.gen.js";
import { registerTool, textResult } from "./registry.js";

const MCP_SEMANTICS = `
---

## MCP semantics — how the curated tools interpret this data

The narrative above describes the dataset as published. The notes below describe how this MCP server's curated tools compute and report rates, what statistical machinery they apply, and where they refuse to answer.

### Two ways to query: raw reads vs. curated derivations

This server's tool surface splits along one axis. **Know which side you're on before quoting a number.**

- **Raw reads** — \`query_metric(canonical_key, ...)\` and \`list_metrics()\`. Any of the ~118 canonical_keys in the dataset is queryable. Returns per-agency × per-year values exactly as filed (or as the pipeline pre-computed at the source). **No cross-year aggregation, no derivations.** Use this when you need resident-stops, non-resident-stops, age/gender breakdowns, probable-cause variants, contraband-by-type, anything top_n_by doesn't cover. \`list_metrics()\` is the empirical index — call it first when you're not sure a metric exists.
- **Curated derivations** — \`top_n_by\`, \`trend\`, \`disparity\`, \`compare\`, \`agency_summary\`. Rates, ratios, OLS slopes, outcome tests — anything computed across metrics or across years. These have sample-size guards baked in because the denominator is itself a separate metric and small denominators produce unstable rates.

Why the split: cross-metric and cross-year derivations are where it's easy to invent something the data doesn't support (e.g. averaging pre-computed rates across years, or comparing a 0–1 decimal to a 0–100 percentage). Raw reads can't do that — the number is the number the agency filed.

### On ranking (raw or derived)

Every ranking response from this server includes a \`ranking_caveat\` field. Read it before quoting an order. Briefly: a #1 or top-5 rank can be a small-denominator artifact (one weird year at a small agency), or it can be dominated by raw size (MSHP files ~10× the count of any municipality and will always lead total_stops). Treat rankings as **orientation, not as the story**: look at a range of the top 10–20 agencies, compare to the per-year stops_total_year column for size context, and don't put much stock in relative order *within* the top tier.

### Race categories (as the tools report them)

Race in this dataset is **officer-perceived**, not driver-self-reported. The categories are: White, Black, Hispanic, Asian, Native American, Other. "Hispanic" is recorded as a race-line on the reporting form (not a separate ethnicity field), which is a known deviation from the Census schema. When this server reports a "Hispanic stop share," it means the share of stops where the officer recorded the driver's race as Hispanic.

### Key metric definitions (tool-reporting units)

- **Stop rate**: stops per 1,000 driving-age residents of the matching race in the agency's jurisdiction. Population denominators come from the most recent ACS or decennial census available for the year being reported.
- **Search rate**: \`searches / stops\` for the agency × year × race, reported as a **percentage (0–100 scale, not a 0–1 decimal)**. Includes consent, probable-cause, and inventory searches. Does not distinguish search type for the top-line search-rate metric; per-type breakdowns are available via the \`probable-cause--\` metric family.
- **Contraband hit rate**: \`contraband_found / searches\` for the agency × year × race, reported as a **percentage (0–100 scale)**. Counts a search as a "hit" if any contraband (drugs, weapons, currency, stolen property, alcohol, other) was recovered.
- **Search rate minus hit rate**: a single-number proxy for the outcome test (see below). When two agencies have the same search rate, the one with the lower hit rate is searching more aggressively at the margin.
- **Disparity index**: \`stop_rate_minority / stop_rate_white_non_hispanic\`. A value of 1.0 means parity with white drivers; values above 1.0 mean the minority race is stopped at a higher rate per resident. The denominator is white non-Hispanic by convention. Multiple variants exist for different population baselines (decennial vs. ACS; all-stops vs. resident-stops); call \`read_schema()\` for the full list. **Warning:** statewide or county-rolled disparity indexes can flip direction once you break them out by agency — see [Simpson's paradox](https://en.wikipedia.org/wiki/Simpson%27s_paradox). Always report disparity at the agency-year level alongside any aggregate.
- **Resident vs. non-resident stops**: agencies distinguish stops of jurisdiction residents from non-residents. The "resident-stops" disparity variants use only resident stops in the numerator, which controls for through-traffic patterns at the cost of smaller sample sizes.

### The outcome test (Knowles, Persico & Todd 2001)

The \`disparity\` tool implements the classic outcome test for racial bias in search decisions, originally proposed in [Knowles, Persico & Todd, *Racial Bias in Motor Vehicle Searches: Theory and Evidence* (2001)](https://www.jstor.org/stable/2696570). The intuition: if officers applied the same threshold of suspicion to all drivers, the contraband hit rate would be equalized across groups at the margin. A pattern where one race is searched at a higher rate **and** contraband is found at a lower rate is consistent with a lower threshold of suspicion being applied to that race.

The outcome test does **not** directly prove discrimination — [selection effects](https://en.wikipedia.org/wiki/Selection_bias) (different distributions of suspicious behavior, different stop contexts, different denominator populations) can produce identical patterns. It is the standard quantitative test in the policing literature, not a verdict. For a public-friendly walk-through of how outcome tests, benchmark tests, and threshold tests are used together — and where each one fails — the [Stanford Open Policing Project](https://openpolicing.stanford.edu/) is the canonical explainer.

The tool returns search rate and hit rate by race and the ratio (minority / white non-Hispanic) for each. It does **not** editorialize on what the pattern means in the result body; that interpretation is on you.

### Trend methodology

The \`trend\` tool fits an **ordinary least squares (OLS) linear regression** of the annual metric value on the year, per group. It returns slope (units per year), 95% confidence interval, two-sided p-value (Student's t on n−2 degrees of freedom), \`n_years\` in the window, and the mean annual sample size.

**Why OLS?** It's the textbook default: transparent (you can re-derive the slope on a napkin), easy to explain in print ("average change per year, assuming the trend is roughly a straight line"), and any stats reviewer can verify it. The assumptions — linearity, independent yearly observations, roughly normal residuals — are stated upfront so a reader can decide whether to trust the fit. → [OLS on Wikipedia](https://en.wikipedia.org/wiki/Ordinary_least_squares).

**What OLS doesn't do.** It assumes the trend is linear; a step change (e.g. a policy shift in 2021) gets averaged into a line through it. A single outlier year can drag the slope. The p-value tests whether the slope differs from zero — **not** whether the trend is "meaningful" or large. See the next section before treating p<0.05 as a story.

**If you want a second opinion** — not implemented here, but easy to compute by hand from the same per-year counts the tool can return:

- **[Theil–Sen estimator](https://en.wikipedia.org/wiki/Theil%E2%80%93Sen_estimator)** — robust median-of-slopes; nearly immune to a single outlier year. Reach for this when one year looks weird.
- **[Mann–Kendall trend test](https://en.wikipedia.org/wiki/Mann%E2%80%93Kendall_trend_test)** — nonparametric "is there a monotonic trend, yes/no" without committing to linearity or a slope magnitude. Useful when the metric is noisy.
- **Just look at the per-year values.** For an 8-year window, the chart usually tells the story OLS is summarizing in one number. Ask the tool for the underlying counts and eyeball them.

Groups whose annual sample sizes fall below the per-metric minimum are excluded. Treat the slope as directional, not predictive.

### How to read the p-values and confidence intervals these tools return

The trend tool returns a two-sided p-value and a 95% [confidence interval](https://en.wikipedia.org/wiki/Confidence_interval) for the slope. Two things journalists routinely get wrong:

1. **The p-value is not the probability the trend is real.** It is the probability of observing a slope at least this large *if the true slope were zero*. A small p-value means "this slope would be surprising under the null hypothesis of no trend" — not "there is a 95% chance this trend is real." → [p-value on Wikipedia](https://en.wikipedia.org/wiki/P-value).
2. **p<0.05 is a convention, not a finding.** The American Statistical Association's 2016 statement is the canonical citation for what statistical significance does and doesn't mean — required reading before any "statistically significant" claim goes to print. → [ASA Statement on Statistical Significance and P-Values (Wasserstein & Lazar, 2016)](https://amstat.tandfonline.com/doi/full/10.1080/00031305.2016.1154108).

The confidence interval is usually more journalistically useful than the p-value: it gives the *size* of the uncertainty in real units (percentage points per year, stops per year, etc.), which is the actual thing readers care about.

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

---

## For reporting: extending beyond this data

This dataset alone is rarely the story. It establishes the pattern; it doesn't establish the context. Before a journalist publishes on anything surfaced here, push them to cross-check against sources outside this server:

- **Local news archives** for the specific agency × year window. Missouri outlets: St. Louis Post-Dispatch, Kansas City Star, Springfield News-Leader, Columbia Missourian, regional weeklies. National outlets that cover policing: ProPublica, The Marshall Project.
- **Court records and government actions:** DOJ Civil Rights Division consent decrees, state AG enforcement, federal civil-rights litigation. PACER and CourtListener are searchable.
- **Academic literature:** the **Further Reading** section below is the curated, edited stable-link list. Cite from there, not from invented references.
- **Local advocacy reports:** ACLU of Missouri, NAACP MO chapters, named academic researchers.

**Important — what to do and not do:**

- This server **does not** search the web or verify URLs. If you (the model) have web-search tools, use them and report what you actually find. Include null results — small-town Missouri agencies and pre-2010 years often have very thin archive coverage. A null result is more useful than a vague hedge.
- If you do not have web search, **prompt the user** to run targeted searches (give them the specific agency_slug, canonical_name, and year range from the tool results) and feed back what they find.
- **Do not invent** specific headlines, URLs, paper titles, quotes, or incident details. A handful of verified sources beats a long list of plausible-sounding fabrications. If you cannot verify a claim, say so explicitly.

Every analytical tool response embeds this same guidance under a \`further_research_prompt\` field so you see it at use-time, not just here.

---

## Further reading (curated link list)

Every external link in this document points to a stable, mainstream explainer. The list is maintained by hand in this server's source; additions go through PR review. If you cite a method this server uses in a published piece, link to the explainer here so your readers can follow the math.

**Statistical methods**

- Ordinary least squares regression — https://en.wikipedia.org/wiki/Ordinary_least_squares
- Theil–Sen estimator (robust slope) — https://en.wikipedia.org/wiki/Theil%E2%80%93Sen_estimator
- Mann–Kendall trend test (nonparametric monotonic-trend test) — https://en.wikipedia.org/wiki/Mann%E2%80%93Kendall_trend_test
- p-value — https://en.wikipedia.org/wiki/P-value
- Confidence interval — https://en.wikipedia.org/wiki/Confidence_interval
- ASA Statement on Statistical Significance and P-Values (Wasserstein & Lazar, 2016) — https://amstat.tandfonline.com/doi/full/10.1080/00031305.2016.1154108

**Bias, confounding, and how data can mislead**

- Selection bias — https://en.wikipedia.org/wiki/Selection_bias
- Simpson's paradox — https://en.wikipedia.org/wiki/Simpson%27s_paradox

**Outcome test and policing-data methodology**

- Knowles, Persico & Todd, *Racial Bias in Motor Vehicle Searches: Theory and Evidence* (Journal of Political Economy, 2001) — https://www.jstor.org/stable/2696570
- Stanford Open Policing Project (public-friendly explainers + open data) — https://openpolicing.stanford.edu/
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
