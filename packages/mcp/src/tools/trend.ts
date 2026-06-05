import { z } from "zod";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import { linreg } from "../stats.js";
import { defaultWindow, yearRangeWarnings } from "../year-range.js";
import { RESEARCH_PROMPT } from "./caveats.js";
import { errorResult, inputSchemaFromZod, registerTool, textResult } from "./registry.js";

// Each trend metric defines the per-year value to regress and the per-year
// sample-size gate. The SQL produces one row per (agency, year) and the JS
// caller groups + regresses.
interface TrendMetricSpec {
  description: string;
  sampleField: string;
  defaultMinSamplePerYear: number;
  method: string;
  /** A SELECT that yields (agency_slug, year, value, n) for every agency × year in the window. */
  yearlySql: (extra: string) => string;
}

const buildRateYearly = (metricKey: string, denomMetric: string) => (extra: string) => `
SELECT
  s.agency_slug,
  s.year,
  s.total AS value,
  d.total AS n
FROM stops s
INNER JOIN agencies a ON a.agency_slug = s.agency_slug
INNER JOIN stops d ON d.agency_slug = s.agency_slug AND d.year = s.year AND d.metric = '${denomMetric}'
WHERE s.year BETWEEN $start AND $end
  AND s.metric = '${metricKey}'
  AND s.total IS NOT NULL
  AND d.total IS NOT NULL
  ${extra}
`;

const buildShareYearly = (raceColumn: string) => (extra: string) => `
SELECT
  s.agency_slug,
  s.year,
  CASE WHEN s.total > 0 THEN 100 * s.${raceColumn} / s.total ELSE NULL END AS value,
  s.total AS n
FROM stops s
INNER JOIN agencies a ON a.agency_slug = s.agency_slug
WHERE s.year BETWEEN $start AND $end
  AND s.metric = 'stops'
  AND s.total IS NOT NULL
  AND s.${raceColumn} IS NOT NULL
  ${extra}
`;

const METRICS: Record<string, TrendMetricSpec> = {
  search_rate: {
    description: "Yearly search rate (searches / stops) regressed against year.",
    sampleField: "stops_per_year",
    defaultMinSamplePerYear: 500,
    method: "OLS of annual search-rate against year, per agency. Years where stops < min_sample_size are excluded.",
    yearlySql: buildRateYearly("search-rate", "stops"),
  },
  contraband_hit_rate: {
    description: "Yearly contraband hit rate (contraband / searches) regressed against year.",
    sampleField: "searches_per_year",
    defaultMinSamplePerYear: 50,
    method: "OLS of annual contraband-hit-rate against year, per agency. Years where searches < min_sample_size are excluded.",
    yearlySql: buildRateYearly("contraband-hit-rate", "searches"),
  },
  hispanic_stop_share: {
    description: "Yearly Hispanic stop share (percentage 0–100) regressed against year.",
    sampleField: "stops_per_year",
    defaultMinSamplePerYear: 500,
    method: "OLS of annual 100 * (stops.Hispanic / stops.Total) against year, per agency. Slope is in percentage points per year. Years where total stops < min_sample_size are excluded.",
    yearlySql: buildShareYearly("hispanic"),
  },
  black_stop_share: {
    description: "Yearly Black stop share (percentage 0–100) regressed against year.",
    sampleField: "stops_per_year",
    defaultMinSamplePerYear: 500,
    method: "OLS of annual 100 * (stops.Black / stops.Total) against year, per agency. Slope is in percentage points per year. Years where total stops < min_sample_size are excluded.",
    yearlySql: buildShareYearly("black"),
  },
  total_stops: {
    description: "Yearly stop count regressed against year.",
    sampleField: "stops_per_year",
    defaultMinSamplePerYear: 0,
    method: "OLS of annual stop count against year, per agency.",
    yearlySql: (extra) => `
SELECT
  s.agency_slug,
  s.year,
  s.total AS value,
  s.total AS n
FROM stops s
INNER JOIN agencies a ON a.agency_slug = s.agency_slug
WHERE s.year BETWEEN $start AND $end
  AND s.metric = 'stops'
  AND s.total IS NOT NULL
  ${extra}
`,
  },
};

const TrendInput = z.object({
  metric: z
    .enum(Object.keys(METRICS) as [keyof typeof METRICS, ...Array<keyof typeof METRICS>])
    .describe(
      "Metric to compute the yearly slope of. Each name corresponds to a specific aggregation defined in the methodology.",
    ),
  window_years: z
    .number()
    .int()
    .min(3)
    .max(25)
    .optional()
    .describe("Window length, ending in the latest reporting year. Default 5."),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe("Explicit [start, end] window, overrides window_years."),
  min_sample_size_per_year: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Override the metric's default minimum per-year sample size."),
  max_sample_size_per_year: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Cap on per-year sample size. Pair with min_sample_size_per_year to focus trend fits on a size band (e.g. exclude MSHP's per-year stop counts from a search-rate-trend comparison of municipalities). Defaults to no cap.",
    ),
  min_years: z
    .number()
    .int()
    .min(3)
    .max(25)
    .optional()
    .describe("Drop agencies with fewer than this many qualifying years. Default 5."),
  county: z.string().optional(),
  agency_type: z.string().optional(),
  sort_by: z
    .enum(["slope", "absolute_slope", "p_value"])
    .optional()
    .describe("How to order the returned groups. Default: slope descending."),
  limit: z.number().int().min(1).max(200).optional().describe("Max rows. Default 50."),
});

type TrendArgs = z.infer<typeof TrendInput>;

const trendHandler = async (raw: unknown) => {
  const parsed = TrendInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: TrendArgs = parsed.data;

  const spec = METRICS[args.metric];
  const minSample = args.min_sample_size_per_year ?? spec.defaultMinSamplePerYear;
  // Default window is 4 years (2021–2024). Default min_years drops in lockstep
  // so the default response isn't empty after the 2020 floor; callers who
  // explicitly request a wider year_range can raise min_years to match.
  const limit = args.limit ?? 50;
  const sortBy = args.sort_by ?? "slope";

  const [start, end] = (() => {
    if (args.year_range) return args.year_range;
    const win = args.window_years ?? 4;
    return defaultWindow(2024, win);
  })();
  const minYears = args.min_years ?? Math.min(4, end - start + 1);

  // Exclude the statewide rollup pseudo-agency from the per-agency trend pool —
  // it's a pre-computed aggregate, not an agency whose trajectory to rank.
  const extraFilters: string[] = ["AND a.is_statewide_rollup = FALSE"];
  const bindings: Array<{ kind: "varchar"; value: string }> = [];
  if (args.county) {
    extraFilters.push(`AND LOWER(a.county) = $${bindings.length + 2}`);
    bindings.push({ kind: "varchar", value: args.county.toLowerCase() });
  }
  if (args.agency_type) {
    extraFilters.push(`AND LOWER(a.agency_type) = $${bindings.length + 2}`);
    bindings.push({ kind: "varchar", value: args.agency_type.toLowerCase() });
  }
  const extra = extraFilters.join("\n  ");

  const maxSample = args.max_sample_size_per_year;
  const sql = spec.yearlySql(extra)
    .replace(/\$start/g, String(start))
    .replace(/\$end/g, String(end))
    + `\n  AND $1 <= n`
    + (maxSample !== undefined ? `\n  AND n <= ${maxSample}` : "");

  const conn = await getDb();
  const stmt = await conn.prepare(sql);
  stmt.bindInteger(1, minSample);
  bindings.forEach((b, i) => stmt.bindVarchar(i + 2, b.value));
  const reader = await stmt.runAndReadAll();

  type YearlyRow = {
    agency_slug: string;
    year: number;
    value: number;
    n: number;
  };
  const cols = reader.columnNames();
  const yearly: YearlyRow[] = reader.getRows().map((row) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c, i) => (o[c] = normalize(row[i])));
    return o as unknown as YearlyRow;
  });

  // Group by agency, regress, attach metadata.
  const byAgency = new Map<string, YearlyRow[]>();
  for (const r of yearly) {
    const arr = byAgency.get(r.agency_slug);
    if (arr) arr.push(r);
    else byAgency.set(r.agency_slug, [r]);
  }

  // Pull agency metadata in one shot.
  const slugs = Array.from(byAgency.keys());
  const meta = new Map<
    string,
    { canonical_name: string; county: string | null; agency_type: string | null }
  >();
  if (slugs.length) {
    const metaSql = `SELECT agency_slug, canonical_name, county, agency_type FROM agencies WHERE agency_slug IN (${slugs.map((_, i) => `$${i + 1}`).join(",")})`;
    const metaStmt = await conn.prepare(metaSql);
    slugs.forEach((s, i) => metaStmt.bindVarchar(i + 1, s));
    const metaReader = await metaStmt.runAndReadAll();
    const metaCols = metaReader.columnNames();
    for (const row of metaReader.getRows()) {
      const o: Record<string, unknown> = {};
      metaCols.forEach((c, i) => (o[c] = normalize(row[i])));
      meta.set(o.agency_slug as string, {
        canonical_name: o.canonical_name as string,
        county: (o.county as string) ?? null,
        agency_type: (o.agency_type as string) ?? null,
      });
    }
  }

  type Result = {
    agency_slug: string;
    canonical_name: string;
    county: string | null;
    agency_type: string | null;
    n_years: number;
    years_observed: number[];
    mean_sample_per_year: number;
    slope: number;
    intercept: number;
    se_slope: number;
    t_stat: number;
    df: number;
    p_value: number;
    ci95: [number, number];
    r_squared: number;
  };

  const results: Result[] = [];
  for (const [slug, rows] of byAgency) {
    if (rows.length < minYears) continue;
    rows.sort((a, b) => a.year - b.year);
    const fit = linreg(
      rows.map((r) => r.year),
      rows.map((r) => r.value),
    );
    if (!fit) continue;
    const meanN = rows.reduce((acc, r) => acc + r.n, 0) / rows.length;
    const m = meta.get(slug);
    results.push({
      agency_slug: slug,
      canonical_name: m?.canonical_name ?? slug,
      county: m?.county ?? null,
      agency_type: m?.agency_type ?? null,
      n_years: rows.length,
      years_observed: rows.map((r) => r.year),
      mean_sample_per_year: Math.round(meanN),
      slope: fit.slope,
      intercept: fit.intercept,
      se_slope: fit.se_slope,
      t_stat: fit.t_stat,
      df: fit.df,
      p_value: fit.p_value,
      ci95: [fit.slope - fit.ci95_half, fit.slope + fit.ci95_half],
      r_squared: fit.r_squared,
    });
  }

  if (sortBy === "slope") {
    results.sort((a, b) => b.slope - a.slope);
  } else if (sortBy === "absolute_slope") {
    results.sort((a, b) => Math.abs(b.slope) - Math.abs(a.slope));
  } else if (sortBy === "p_value") {
    results.sort((a, b) => a.p_value - b.p_value);
  }

  const dataQualityWarnings = yearRangeWarnings(start, end);

  const payload = {
    metric: args.metric,
    year_range: [start, end],
    year_range_basis:
      args.year_range === undefined
        ? `Defaulted to ${start}–${end} (the four most recent years; 2020 is excluded by default — see data_quality_warnings or read_methodology for why). Pass year_range explicitly to widen.`
        : "Caller-specified year_range.",
    data_quality_warnings: dataQualityWarnings,
    min_sample_size_per_year: minSample,
    max_sample_size_per_year: maxSample ?? null,
    min_years: minYears,
    method: spec.method,
    method_explainer:
      "Plain English (surface this to the user, don't assume they know what OLS means): we fit a straight line through the agency's annual values for this metric. The 'slope' is the average change per year, the '95% CI' is how much wiggle room the line has, and the 'p-value' tells you whether the trend is distinguishable from random year-to-year noise (a small p-value, say < 0.05, means it probably isn't noise — though see caveats). The straight-line assumption is the main limitation: a real step change (policy shift) or a single outlier year can pull the slope misleadingly. The slope is directional, not predictive — don't extrapolate forward. Further reading: https://en.wikipedia.org/wiki/Ordinary_least_squares (the method itself), https://en.wikipedia.org/wiki/P-value (what p-values do and don't mean); call read_methodology() for the full statistical caveats.",
    note: "OLS regression on annual aggregates. Treat the slope as directional, not predictive. The model assumes linearity; if the true series is non-linear or noisy the slope captures only an average trend over the window. p-values are two-sided Student's t with df = n_years - 2.",
    sort_by: sortBy,
    n_groups_considered: byAgency.size,
    n_groups_returned: Math.min(results.length, limit),
    further_research_prompt: RESEARCH_PROMPT,
    results: results.slice(0, limit),
  };
  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "trend",
  description: `Fits a linear OLS regression of yearly metric values against year, per agency, over a configurable window. Returns slope (units per year), 95% CI, two-sided p-value, n_years, and mean per-year sample size for each agency. Available metrics: ${Object.keys(METRICS).join(", ")}. Years where the per-year sample falls below the metric's threshold are dropped. Agencies with fewer than min_years qualifying years are dropped. Sort by slope (default), absolute_slope, or p_value. Defaults to the last 4 years (2021–2024); 2020 is excluded by default because the AG's published 2020 data has unreconciled anomalies — pass year_range=[2020, 2024] explicitly to include it, with a warning.`,
  inputSchema: inputSchemaFromZod(TrendInput),
  handler: trendHandler,
});
