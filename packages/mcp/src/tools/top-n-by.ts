import { z } from "zod";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import {
  DEFAULT_MIN_TOTAL_STOPS,
  MIN_TOTAL_STOPS_DESCRIPTION,
  RANKING_CAVEAT,
  RESEARCH_PROMPT,
  buildLowVolumeSummary,
  flagsFor,
} from "./caveats.js";
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
    description: "Search rate as a percentage 0–100: 100 * SUM(searches) / SUM(stops) across the window.",
    sampleField: "denominator",
    defaultMinSample: 500,
    method:
      "Aggregate search count divided by aggregate stop count across the window, per agency, multiplied by 100. Equivalent to a stop-weighted mean of the annual search rate, on the same 0–100 scale as the AG's source rates.",
    cte: buildStandard("searches", "stops", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  contraband_hit_rate: {
    description: "Contraband hit rate as a percentage 0–100: 100 * SUM(contraband-total) / SUM(searches) across the window.",
    sampleField: "denominator",
    defaultMinSample: 50,
    method:
      "Aggregate contraband-recovered count divided by aggregate search count across the window, multiplied by 100. Counts a search as a hit if any contraband category was recovered.",
    cte: buildStandard("contraband-total", "searches", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  citation_rate: {
    description:
      "Citation rate as a percentage 0–100: 100 * SUM(citations) / SUM(stops) across the window.",
    sampleField: "denominator",
    defaultMinSample: 500,
    method:
      "Aggregate citation count divided by aggregate stop count across the window, multiplied by 100. Equivalent to a stop-weighted mean of the annual citation rate.",
    cte: buildStandard("citations", "stops", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  arrest_rate: {
    description:
      "Arrest rate as a percentage 0–100: 100 * SUM(arrests) / SUM(stops) across the window.",
    sampleField: "denominator",
    defaultMinSample: 500,
    method:
      "Aggregate arrest count divided by aggregate stop count across the window, multiplied by 100. Equivalent to a stop-weighted mean of the annual arrest rate.",
    cte: buildStandard("arrests", "stops", "total", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
  },
  search_rate_minus_hit_rate: {
    description:
      "Search rate minus contraband hit rate, both on 0–100 scale (so this is a difference in percentage points). A single-number proxy for the outcome test: higher values mean searches are surfacing contraband less often relative to how often they happen.",
    sampleField: "stops_n",
    defaultMinSample: 500,
    method:
      "100 * ((SUM(searches) / SUM(stops)) - (SUM(contraband-total) / SUM(searches))) across the window, per agency. Both terms are on the 0–100 percentage scale, so the difference is in percentage points. Requires at least defaultMinSample stops AND at least 50 searches.",
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
    description: "Share of stops where the recorded race was Hispanic, reported as a percentage 0–100: 100 * SUM(stops.Hispanic) / SUM(stops.Total).",
    sampleField: "denominator",
    defaultMinSample: 500,
    method: "Aggregate Hispanic stop count divided by aggregate total stop count across the window, multiplied by 100. Reported on the same 0–100 scale as the pipeline's other rate metrics.",
    cte: buildStandard("stops", "stops", "hispanic", "total"),
    valueExpr: "100 * numerator / NULLIF(denominator, 0)",
    secondarySample: "numerator",
    raceColumn: "hispanic",
  },
  black_stop_share: {
    description: "Share of stops where the recorded race was Black, reported as a percentage 0–100: 100 * SUM(stops.Black) / SUM(stops.Total).",
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
      "Share of stops that were of jurisdiction residents (vs. non-residents), reported as a percentage 0–100: 100 * SUM(resident-stops) / SUM(stops). A LOW share means an agency is stopping mostly non-residents — typical of highway / through-traffic enforcement; flag for revenue-from-outsiders patterns. Only post-2020 reporting forms include the resident/non-resident split.",
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
    .describe("Inclusive [start, end] year window. Defaults to the five most recent years on file (2020–2024)."),
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
  min_total_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(MIN_TOTAL_STOPS_DESCRIPTION),
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
  const minTotalStops = args.min_total_stops ?? DEFAULT_MIN_TOTAL_STOPS;
  const n = args.n ?? 20;
  const [start, end] = args.year_range ?? [2020, 2024];
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
  // per-row guardrail column.
  const windowStopsCte = `window_stops AS (
  SELECT s.agency_slug, SUM(s.total)::BIGINT AS total_stops_in_window
  FROM stops s
  WHERE s.metric = 'stops' AND s.year BETWEEN $start AND $end
  GROUP BY s.agency_slug
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
    const rest: Record<string, unknown> = { ...row };
    delete rest.n_in_eligible_pool;
    rest.low_volume_warning = low_volume_warning;
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
    sample_size_field: spec.sampleField,
    min_sample_size: minSample,
    min_total_stops: minTotalStops,
    method: spec.method,
    filters: {
      county: args.county ?? null,
      agency_type: args.agency_type ?? null,
    },
    defaulted_filters: {
      min_sample_size: args.min_sample_size === undefined,
      min_total_stops: args.min_total_stops === undefined,
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
