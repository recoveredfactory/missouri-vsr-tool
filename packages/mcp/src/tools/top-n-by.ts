import { z } from "zod";

import { getDb, getLatestYearWithData } from "../db.js";
import { normalize } from "../duckutil.js";
import {
  DEFAULT_MIN_TOTAL_STOPS,
  MIN_TOTAL_STOPS_DESCRIPTION,
  RANKING_CAVEAT,
  RESEARCH_PROMPT,
  buildLowVolumeSummary,
  flagsFor,
} from "./caveats.js";
import { findIssuesFor } from "./known-issues.js";
import { errorResult, inputSchemaFromZod, registerTool, textResult } from "./registry.js";

type RaceColumn = "white" | "black" | "hispanic" | "asian" | "native_american" | "other";
type AnyRace = RaceColumn | "total";

const RACE_LABELS: Record<RaceColumn, string> = {
  white: "White",
  black: "Black",
  hispanic: "Hispanic",
  asian: "Asian",
  native_american: "Native American",
  other: "Other",
};

/**
 * Per-metric SQL builders. Each one returns a query that produces:
 *   agency_slug, value, primary_sample (the n that gates min_sample_size),
 *   secondary_sample (optional second n for rate-of-rate metrics), notes.
 *
 * The query is parameterised on $start (int), $end (int), and any extra
 * filters bound by the caller below.
 */
export interface MetricSpec {
  description: string;
  /** Numeric n the min_sample_size guard applies to (e.g. total stops in window). */
  sampleField: string;
  defaultMinSample: number;
  /** A human-readable method-note string returned with results. */
  method: string;
  /** Builds the agency-level CTE for the window. */
  cte: (extraJoinFilters: string) => string;
  /** Column expression on top of the CTE that yields the displayed metric value. */
  valueExpr: string;
  /** Optional secondary sample size column to show in results. */
  secondarySample?: string;
  /** Optional race filter — for share metrics where the race is fixed. */
  raceColumn?: RaceColumn;
}

const buildStandard = (
  numeratorMetric: string,
  denominatorMetric: string,
  numeratorRace: AnyRace,
  denominatorRace: AnyRace,
) => (extra: string) => `
WITH agg AS (
  SELECT s.agency_slug,
         SUM(CASE WHEN s.metric = '${numeratorMetric}' THEN s.${numeratorRace} END) AS numerator,
         SUM(CASE WHEN s.metric = '${denominatorMetric}' THEN s.${denominatorRace} END) AS denominator
  FROM stops s
  INNER JOIN agencies a ON a.agency_slug = s.agency_slug
  WHERE s.year BETWEEN $start AND $end
    ${extra}
  GROUP BY s.agency_slug
)
`;

export const METRICS: Record<string, MetricSpec> = {
  search_rate: {
    description:
      "Searches per 100 stops: 100 * SUM(searches) / SUM(stops). Typically 0–100, but CAN exceed 100 because a single stop can produce multiple search events. NOT a percentage of stops — it's a rate per 100.",
    sampleField: "denominator",
    defaultMinSample: 500,
    method:
      "Aggregate search count divided by aggregate stop count across the window, per agency, multiplied by 100. Equivalent to a stop-weighted mean of the annual search rate. Reported as a rate per 100 stops, not a percentage — values above 100 are legitimate when an agency files multiple searches against one stop.",
    cte: buildStandard("searches", "stops", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  contraband_hit_rate: {
    description:
      "Contraband finds per 100 searches: 100 * SUM(contraband-total) / SUM(searches). Typically 0–100; can exceed 100 if a single search recovered multiple distinct contraband categories that were each counted. Not a percentage.",
    sampleField: "denominator",
    defaultMinSample: 50,
    method:
      "Aggregate contraband-recovered count divided by aggregate search count across the window, multiplied by 100. Counts a search as a hit if any contraband category was recovered; multiple categories per search push the rate above 100.",
    cte: buildStandard("contraband-total", "searches", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  citation_rate: {
    description:
      "Citations per 100 stops: 100 * SUM(citations) / SUM(stops). REGULARLY EXCEEDS 100 because a single traffic stop can produce multiple citations (speeding + no seatbelt + expired tags). NOT a percentage of stops — when you chart this, do not cap the axis at 100 and do not call it 'percent.'",
    sampleField: "denominator",
    defaultMinSample: 500,
    method:
      "Aggregate citation count divided by aggregate stop count across the window, multiplied by 100. Values above 100 are common, not errors — they mean the agency averages more than one citation per stop. Equivalent to a stop-weighted mean of the annual citation rate.",
    cte: buildStandard("citations", "stops", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  arrest_rate: {
    description:
      "Arrests per 100 stops: 100 * SUM(arrests) / SUM(stops). Typically 0–100; can exceed 100 if multiple arrests per stop are filed (e.g. driver + passenger). NOT a percentage.",
    sampleField: "denominator",
    defaultMinSample: 500,
    method:
      "Aggregate arrest count divided by aggregate stop count across the window, multiplied by 100. Reported as a rate per 100 stops; values above 100 indicate multiple arrests per stop.",
    cte: buildStandard("arrests", "stops", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  search_rate_minus_hit_rate: {
    description:
      "Search rate minus contraband hit rate, both as rate-per-100. Difference is in 'percentage point' units only loosely — the underlying rates can exceed 100. A single-number proxy for the outcome test: higher values mean searches are surfacing contraband less often relative to how often they happen.",
    sampleField: "stops_n",
    defaultMinSample: 500,
    method:
      "100 * ((SUM(searches) / SUM(stops)) - (SUM(contraband-total) / SUM(searches))) across the window, per agency. Both terms are rates per 100, not pure percentages. Requires at least defaultMinSample stops AND at least 50 searches.",
    cte: (extra) => `
WITH agg AS (
  SELECT s.agency_slug,
         SUM(CASE WHEN s.metric = 'stops' THEN s.total END) AS stops_n,
         SUM(CASE WHEN s.metric = 'searches' THEN s.total END) AS searches_n,
         SUM(CASE WHEN s.metric = 'contraband-total' THEN s.total END) AS contraband_n
  FROM stops s
  INNER JOIN agencies a ON a.agency_slug = s.agency_slug
  WHERE s.year BETWEEN $start AND $end
    ${extra}
  GROUP BY s.agency_slug
  HAVING searches_n >= 50
)`,
    valueExpr:
      "100 * ((searches_n / NULLIF(stops_n, 0)) - (contraband_n / NULLIF(searches_n, 0)))",
    secondarySample: "searches_n",
  },
  hispanic_stop_share: {
    description:
      "Share of stops where the recorded race was Hispanic, as a percentage 0–100 (truly capped at 100 — it's part of a whole, unlike citation_rate / search_rate which are rates-per-100 and can exceed 100). 100 * SUM(stops.Hispanic) / SUM(stops.Total).",
    sampleField: "denominator",
    defaultMinSample: 500,
    method: "Aggregate Hispanic stop count divided by aggregate total stop count across the window, multiplied by 100. Reported on the same 0–100 scale as the pipeline's other rate metrics.",
    cte: buildStandard("stops", "stops", "hispanic", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
    raceColumn: "hispanic",
  },
  black_stop_share: {
    description:
      "Share of stops where the recorded race was Black, as a percentage 0–100 (truly capped at 100 — part of a whole). 100 * SUM(stops.Black) / SUM(stops.Total).",
    sampleField: "denominator",
    defaultMinSample: 500,
    method: "Aggregate Black stop count divided by aggregate total stop count across the window, multiplied by 100. Reported on the same 0–100 scale as the pipeline's other rate metrics.",
    cte: buildStandard("stops", "stops", "black", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
    raceColumn: "black",
  },
  disparity_index_all_stops: {
    description:
      "Most-recent-year value of the canonical 'disparity-index--all-stops' metric (white-non-Hispanic baseline; 1.0 = parity). Uses the agency's most recent year in the window.",
    sampleField: "stops_n",
    defaultMinSample: 500,
    method:
      "Latest year's reported disparity-index--all-stops (Black) within the window, paired with that year's stop count as the sample size.",
    cte: (extra) => `
WITH latest AS (
  SELECT s.agency_slug,
         MAX(s.year) AS latest_year
  FROM stops s
  INNER JOIN agencies a ON a.agency_slug = s.agency_slug
  WHERE s.year BETWEEN $start AND $end
    AND s.metric = 'disparity-index--all-stops'
    ${extra}
  GROUP BY s.agency_slug
),
agg AS (
  SELECT s.agency_slug,
         s.year,
         MAX(CASE WHEN s.metric = 'disparity-index--all-stops' THEN s.black END) AS di_value,
         MAX(CASE WHEN s.metric = 'stops' THEN s.total END) AS stops_n
  FROM stops s
  INNER JOIN latest l ON s.agency_slug = l.agency_slug AND s.year = l.latest_year
  GROUP BY s.agency_slug, s.year
)`,
    valueExpr: "di_value",
    secondarySample: "year",
  },
  total_stops: {
    description: "Total stops summed across the window. The simplest 'who stops the most' metric.",
    sampleField: "value",
    defaultMinSample: 0,
    method: "SUM(stops.Total) across the window, per agency.",
    cte: (extra) => `
WITH agg AS (
  SELECT s.agency_slug,
         SUM(CASE WHEN s.metric = 'stops' THEN s.total END) AS value
  FROM stops s
  INNER JOIN agencies a ON a.agency_slug = s.agency_slug
  WHERE s.year BETWEEN $start AND $end
    ${extra}
  GROUP BY s.agency_slug
)`,
    valueExpr: "value",
  },
  resident_stop_share: {
    description:
      "Share of stops that were of jurisdiction residents (vs. non-residents), as a percentage 0–100 (truly capped at 100 — part of a whole). 100 * SUM(resident-stops) / SUM(stops). A LOW share means an agency is stopping mostly non-residents — typical of highway / through-traffic enforcement; flag for revenue-from-outsiders patterns. Only post-2020 reporting forms include the resident/non-resident split.",
    sampleField: "denominator",
    defaultMinSample: 2500,
    method:
      "Aggregate resident-stops count divided by aggregate stops count across the window, per agency. Multiplied by 100 to match the other share metrics' 0–100 scale. Default minimum is 2500 stops because resident-share is particularly volatile at small volumes.",
    cte: buildStandard("resident-stops", "stops", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
};

const TopNByInput = z.object({
  metric: z
    .enum(Object.keys(METRICS) as [keyof typeof METRICS, ...Array<keyof typeof METRICS>])
    .describe(
      "Named metric to rank agencies by. Each name corresponds to a specific aggregation defined in the methodology — call read_methodology() for definitions.",
    ),
  n: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe(
      "Number of agencies to return. Default 20. Bump up to 1000 when you need the full distribution for histogram/scatter analysis — Missouri has ~600 reporting agencies, so 1000 returns essentially everything qualifying.",
    ),
  ascending: z
    .boolean()
    .optional()
    .describe(
      "Sort ascending (lowest values first) instead of descending. Useful for metrics like search_rate_minus_hit_rate where low values are interesting.",
    ),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe(
      "Inclusive [start, end] year window. Defaults to the MOST RECENT YEAR with data ([latest, latest]) — the right answer for current-state questions like 'highest citation rate'. For multi-year stability or trend-flavored questions, expand the range explicitly (e.g. [2020, 2024] for a 5-year window). For a different single year, pass [2023, 2023]. Multi-year windows average / pool across years, hiding recent changes; single-year windows have smaller sample sizes (a small agency with 100 stops in one year may be filtered out by min_total_stops where 500 over 5 years would pass).",
    ),
  county: z
    .string()
    .optional()
    .describe("Filter agencies to a Missouri county (e.g. 'Boone County'). Case-insensitive exact match."),
  agency_type: z
    .string()
    .optional()
    .describe("Filter to a single agency_type from list_agencies (e.g. 'Municipal', 'State Agency')."),
  min_sample_size: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Override the metric's default minimum sample size (the denominator-specific threshold, e.g. ≥500 stops for search_rate). Lowering this below the default is discouraged — small denominators produce unstable rates.",
    ),
  max_sample_size: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Cap on the metric's denominator (e.g. exclude agencies with >100000 stops when looking at search_rate to filter out MSHP-class giants). Defaults to no cap.",
    ),
  min_total_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(MIN_TOTAL_STOPS_DESCRIPTION),
  max_total_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Cap on total stops in the window (independent of metric). Pair with min_total_stops to focus on mid-sized agencies (e.g. min=2500, max=100000 keeps small-to-medium municipalities and excludes MSHP). Defaults to no cap.",
    ),
});

type TopNByArgs = z.infer<typeof TopNByInput>;

const topNByHandler = async (raw: unknown) => {
  const parsed = TopNByInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: TopNByArgs = parsed.data;

  const metricKey = args.metric;
  const spec = METRICS[metricKey];
  const minSample = args.min_sample_size ?? spec.defaultMinSample;
  const maxSample = args.max_sample_size; // undefined → no cap
  const minTotalStops = args.min_total_stops ?? DEFAULT_MIN_TOTAL_STOPS;
  const maxTotalStops = args.max_total_stops; // undefined → no cap
  const n = args.n ?? 20;
  const latestYear = await getLatestYearWithData();
  const [start, end] = args.year_range ?? [latestYear, latestYear];
  const direction = args.ascending ? "ASC" : "DESC";

  const extraFilters: string[] = [];
  const bindings: Array<{ kind: "varchar"; value: string }> = [];
  // Param layout: $1 = minSample, $2 = n, $3 = minTotalStops, $4+ = string filters.
  if (args.county) {
    extraFilters.push(`AND LOWER(a.county) = $${bindings.length + 4}`);
    bindings.push({ kind: "varchar", value: args.county.toLowerCase() });
  }
  if (args.agency_type) {
    extraFilters.push(`AND LOWER(a.agency_type) = $${bindings.length + 4}`);
    bindings.push({ kind: "varchar", value: args.agency_type.toLowerCase() });
  }
  const extra = extraFilters.join("\n    ");

  // Splice a window_stops CTE before the metric-specific agg CTE so we can
  // join total-stops-in-window for the min_total_stops filter and the
  // per-row guardrail column. Reads from the agency_year_stops materialized
  // view (~15k rows) rather than scanning the full stops table (~3M rows).
  const windowStopsCte = `window_stops AS (
  SELECT agency_slug, SUM(total_stops)::BIGINT AS total_stops_in_window
  FROM agency_year_stops
  WHERE year BETWEEN $start AND $end
  GROUP BY agency_slug
)`;
  const cte = spec.cte(extra).replace(
    /^\s*WITH agg AS/,
    `WITH ${windowStopsCte}, agg AS`,
  );

  const sql = `
    ${cte}
    , eligible AS (
      SELECT
        w.agency_slug,
        (${spec.valueExpr}) AS value,
        w.${spec.sampleField} AS sample_size,
        ${spec.secondarySample ? `w.${spec.secondarySample} AS secondary_sample,` : ""}
        COALESCE(ws.total_stops_in_window, 0)::BIGINT AS total_stops_in_window
      FROM agg w
      INNER JOIN agencies a_inner ON a_inner.agency_slug = w.agency_slug
      LEFT JOIN window_stops ws ON ws.agency_slug = w.agency_slug
      WHERE w.${spec.sampleField} >= $1
        AND (${spec.valueExpr}) IS NOT NULL
        AND COALESCE(ws.total_stops_in_window, 0) >= $3
        AND a_inner.is_statewide_rollup = FALSE
        ${maxSample !== undefined ? `AND w.${spec.sampleField} <= ${maxSample}` : ""}
        ${maxTotalStops !== undefined ? `AND COALESCE(ws.total_stops_in_window, 0) <= ${maxTotalStops}` : ""}
    )
    SELECT
      e.agency_slug,
      a.canonical_name,
      a.county,
      a.agency_type,
      e.value,
      e.sample_size,
      ${spec.secondarySample ? `e.secondary_sample,` : ""}
      e.total_stops_in_window,
      (SELECT COUNT(*) FROM eligible) AS n_in_eligible_pool
    FROM eligible e
    INNER JOIN agencies a ON a.agency_slug = e.agency_slug
    ORDER BY e.value ${direction} NULLS LAST
    LIMIT $2
  `;

  // The year window is built into the CTE via $start / $end placeholders that
  // we substitute inline (integers from a typed tuple, no injection surface).
  // Runtime user inputs go through positional bindings.
  const sqlWithYears = sql
    .replace(/\$start/g, String(start))
    .replace(/\$end/g, String(end));

  const conn = await getDb();
  const stmt = await conn.prepare(sqlWithYears);
  stmt.bindInteger(1, minSample);
  stmt.bindInteger(2, n);
  stmt.bindInteger(3, minTotalStops);
  bindings.forEach((b, i) => {
    stmt.bindVarchar(i + 4, b.value);
  });

  const reader = await stmt.runAndReadAll();
  const cols = reader.columnNames();
  const rows = reader.getRows();
  const rawData = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = normalize(row[i]);
    });
    return obj;
  });

  const nInEligiblePool =
    rawData.length > 0 ? Number(rawData[0].n_in_eligible_pool ?? 0) : 0;

  const data = rawData.map((row) => {
    const stopsInWindow = Number(row.total_stops_in_window ?? 0);
    const { low_volume_warning } = flagsFor(stopsInWindow);
    const slug = String(row.agency_slug);
    // Check known-issues for every year in the window — if any year × this
    // metric is flagged, attach the issues so the LLM sees them inline.
    const issues: ReturnType<typeof findIssuesFor> = [];
    for (let y = start; y <= end; y += 1) {
      for (const i of findIssuesFor(slug, y, metricKey)) {
        if (!issues.includes(i)) issues.push(i);
      }
    }
    const rest: Record<string, unknown> = { ...row };
    delete rest.n_in_eligible_pool;
    rest.low_volume_warning = low_volume_warning;
    if (issues.length > 0) rest.known_data_issues = issues;
    return rest;
  });

  const lowVolumeSummary = buildLowVolumeSummary(
    data.map((d) => ({
      canonical_name: d.canonical_name,
      total_stops_in_window: Number(d.total_stops_in_window ?? 0),
    })),
  );

  const payload = {
    metric: metricKey,
    direction: args.ascending ? "ascending" : "descending",
    n_requested: n,
    n_returned: data.length,
    n_in_eligible_pool: nInEligiblePool,
    ranked_within: `${data.length} of ${nInEligiblePool} agencies that passed both the metric's denominator floor (${minSample}) and the min_total_stops floor (${minTotalStops}) in ${start}–${end}`,
    year_range: [start, end],
    year_range_basis:
      args.year_range === undefined
        ? `Defaulted to most recent year with data (${latestYear}). Pass year_range to widen — e.g. [${latestYear - 4}, ${latestYear}] for a 5-year pooled view, or [2023, 2023] for a different single year.`
        : "Caller-specified year_range.",
    sample_size_field: spec.sampleField,
    min_sample_size: minSample,
    max_sample_size: maxSample ?? null,
    min_total_stops: minTotalStops,
    max_total_stops: maxTotalStops ?? null,
    method: spec.method,
    filters: {
      county: args.county ?? null,
      agency_type: args.agency_type ?? null,
    },
    defaulted_filters: {
      min_sample_size: args.min_sample_size === undefined,
      max_sample_size: args.max_sample_size === undefined,
      min_total_stops: args.min_total_stops === undefined,
      max_total_stops: args.max_total_stops === undefined,
      year_range: args.year_range === undefined,
      n: args.n === undefined,
    },
    low_volume_warning_summary: lowVolumeSummary,
    ranking_caveat: RANKING_CAVEAT,
    further_research_prompt: RESEARCH_PROMPT,
    results: data,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

const metricList = Object.keys(METRICS).join(", ");

registerTool({
  name: "top_n_by",
  description: `Ranks agencies by a named metric over a year window, with sample-size guards baked in. Available metrics: ${metricList}. Each metric carries its own minimum-sample-size threshold (e.g. search_rate requires ≥500 stops in the window; contraband_hit_rate requires ≥50 searches) and a one-line method note in the response. Defaults to the 2020–2024 window and the top 20. Call read_methodology() first if you're not sure what a metric means in this dataset.`,
  inputSchema: inputSchemaFromZod(TopNByInput),
  handler: topNByHandler,
});
