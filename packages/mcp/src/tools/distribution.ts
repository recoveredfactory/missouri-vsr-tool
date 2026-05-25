import { z } from "zod";

import { getDb, getLatestYearWithData } from "../db.js";
import { normalize } from "../duckutil.js";
import {
  DEFAULT_MIN_TOTAL_STOPS,
  MIN_TOTAL_STOPS_DESCRIPTION,
  RESEARCH_PROMPT,
  buildLowVolumeSummary,
  flagsFor,
} from "./caveats.js";
import { findIssuesFor } from "./known-issues.js";
import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";
import { METRICS } from "./top-n-by.js";

const METRIC_KEYS = Object.keys(METRICS) as [
  keyof typeof METRICS,
  ...Array<keyof typeof METRICS>,
];

const DistributionInput = z.object({
  metric: z
    .enum(METRIC_KEYS)
    .describe(
      "Same set of metrics as top_n_by. Call read_methodology() if you're unsure what a name means here.",
    ),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe(
      "Inclusive [start, end] year window. Defaults to the MOST RECENT YEAR with data ([latest, latest]) for current-state distribution. Widen explicitly (e.g. [2020, 2024]) for a pooled multi-year shape; pass [year, year] for any other single year.",
    ),
  county: z
    .string()
    .optional()
    .describe(
      "Filter agencies to a Missouri county (e.g. 'Boone County'). Case-insensitive exact match.",
    ),
  agency_type: z
    .string()
    .optional()
    .describe("Filter to a single agency_type (e.g. 'Municipal')."),
  min_sample_size: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Override the metric's default minimum sample size. Lowering it below the default produces noisy rates — only do this when you understand the trade-off.",
    ),
  bins: z
    .number()
    .int()
    .min(5)
    .max(50)
    .optional()
    .describe("Histogram bin count. Default 20."),
  include_values: z
    .boolean()
    .optional()
    .describe(
      "Whether to include the per-agency rows alongside the binned histogram. Default true. Set to false to get only summary stats + bins, which is enough to draw a histogram and keeps the response small.",
    ),
  min_total_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(MIN_TOTAL_STOPS_DESCRIPTION),
});

type DistributionArgs = z.infer<typeof DistributionInput>;

interface RowRecord {
  agency_slug: string;
  canonical_name: string;
  county: string | null;
  agency_type: string | null;
  value: number;
  sample_size: number;
  total_stops_in_window: number;
  low_volume_warning: boolean;
}

const percentile = (sortedAsc: number[], p: number): number => {
  if (sortedAsc.length === 0) return Number.NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
};

const buildHistogram = (
  values: number[],
  bins: number,
): {
  bin_edges: number[];
  bins: Array<{ bin_start: number; bin_end: number; count: number }>;
} => {
  if (values.length === 0) {
    return { bin_edges: [], bins: [] };
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) {
    return {
      bin_edges: [lo, hi],
      bins: [{ bin_start: lo, bin_end: hi, count: values.length }],
    };
  }
  const width = (hi - lo) / bins;
  const edges: number[] = [];
  for (let i = 0; i <= bins; i += 1) edges.push(lo + i * width);
  // Force the last edge exactly to hi to avoid float drift placing the max
  // value into a non-existent (bins+1)th bin.
  edges[edges.length - 1] = hi;
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of values) {
    // Place v into bin index, clamped to [0, bins-1].
    let idx = Math.floor((v - lo) / width);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    counts[idx] += 1;
  }
  return {
    bin_edges: edges,
    bins: counts.map((count, i) => ({
      bin_start: edges[i],
      bin_end: edges[i + 1],
      count,
    })),
  };
};

const distributionHandler = async (raw: unknown) => {
  const parsed = DistributionInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: DistributionArgs = parsed.data;

  const spec = METRICS[args.metric];
  const minSample = args.min_sample_size ?? spec.defaultMinSample;
  const minTotalStops = args.min_total_stops ?? DEFAULT_MIN_TOTAL_STOPS;
  const latestYear = await getLatestYearWithData();
  const [start, end] = args.year_range ?? [latestYear, latestYear];
  const binCount = args.bins ?? 20;
  const includeValues = args.include_values ?? true;

  const extraFilters: string[] = [];
  const bindings: Array<{ kind: "varchar"; value: string }> = [];
  // Param indices: $1 = minSample, $2 = minTotalStops, $3+ = string filters.
  if (args.county) {
    extraFilters.push(`AND LOWER(a.county) = $${bindings.length + 3}`);
    bindings.push({ kind: "varchar", value: args.county.toLowerCase() });
  }
  if (args.agency_type) {
    extraFilters.push(`AND LOWER(a.agency_type) = $${bindings.length + 3}`);
    bindings.push({ kind: "varchar", value: args.agency_type.toLowerCase() });
  }
  const extra = extraFilters.join("\n    ");

  // Splice window_stops CTE before agg (same pattern as top_n_by). Reads
  // from the agency_year_stops materialized view, not the full stops table.
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
    SELECT
      w.agency_slug,
      a.canonical_name,
      a.county,
      a.agency_type,
      (${spec.valueExpr}) AS value,
      w.${spec.sampleField} AS sample_size,
      COALESCE(ws.total_stops_in_window, 0)::BIGINT AS total_stops_in_window
    FROM agg w
    INNER JOIN agencies a ON a.agency_slug = w.agency_slug
    LEFT JOIN window_stops ws ON ws.agency_slug = w.agency_slug
    WHERE w.${spec.sampleField} >= $1
      AND (${spec.valueExpr}) IS NOT NULL
      AND COALESCE(ws.total_stops_in_window, 0) >= $2
      AND a.is_statewide_rollup = FALSE
    ORDER BY value ASC NULLS LAST
  `;

  const sqlWithYears = sql
    .replace(/\$start/g, String(start))
    .replace(/\$end/g, String(end));

  const conn = await getDb();
  const stmt = await conn.prepare(sqlWithYears);
  stmt.bindInteger(1, minSample);
  stmt.bindInteger(2, minTotalStops);
  bindings.forEach((b, i) => {
    stmt.bindVarchar(i + 3, b.value);
  });

  const reader = await stmt.runAndReadAll();
  const cols = reader.columnNames();
  const rawRows = reader.getRows();
  const rows: RowRecord[] = rawRows.map((rawRow) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = normalize(rawRow[i]);
    });
    const stopsInWindow = Number(obj.total_stops_in_window ?? 0);
    const slug = String(obj.agency_slug);
    const issues: ReturnType<typeof findIssuesFor> = [];
    for (let y = start; y <= end; y += 1) {
      for (const i of findIssuesFor(slug, y, args.metric)) {
        if (!issues.includes(i)) issues.push(i);
      }
    }
    const out: RowRecord & { known_data_issues?: unknown } = {
      agency_slug: slug,
      canonical_name: String(obj.canonical_name),
      county: (obj.county as string | null) ?? null,
      agency_type: (obj.agency_type as string | null) ?? null,
      value: Number(obj.value),
      sample_size: Number(obj.sample_size),
      total_stops_in_window: stopsInWindow,
      low_volume_warning: flagsFor(stopsInWindow).low_volume_warning,
    };
    if (issues.length > 0) out.known_data_issues = issues;
    return out;
  });

  if (rows.length === 0) {
    return textResult(
      JSON.stringify(
        {
          metric: args.metric,
          year_range: [start, end],
          min_sample_size: minSample,
          n_agencies: 0,
          note: "No agencies met the sample-size threshold under the requested filters. Lower min_sample_size or widen the year window if you need a result.",
          summary: null,
          histogram: { bin_edges: [], bins: [] },
          values: [],
        },
        null,
        2,
      ),
    );
  }

  const values = rows.map((r) => r.value).filter(Number.isFinite);
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance =
    values.length > 1
      ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)
      : 0;
  const stdev = Math.sqrt(variance);

  const summary = {
    n: values.length,
    min: sorted[0],
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    mean,
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
    stdev,
  };

  const hist = buildHistogram(values, binCount);

  const lowVolumeSummary = buildLowVolumeSummary(rows);

  const payload = {
    metric: args.metric,
    year_range: [start, end],
    year_range_basis:
      args.year_range === undefined
        ? `Defaulted to most recent year with data (${latestYear}). Pass year_range to widen.`
        : "Caller-specified year_range.",
    sample_size_field: spec.sampleField,
    min_sample_size: minSample,
    min_total_stops: minTotalStops,
    filters: {
      county: args.county ?? null,
      agency_type: args.agency_type ?? null,
    },
    defaulted_filters: {
      min_sample_size: args.min_sample_size === undefined,
      min_total_stops: args.min_total_stops === undefined,
      year_range: args.year_range === undefined,
    },
    n_agencies: rows.length,
    method: spec.method,
    summary,
    histogram: hist,
    low_volume_warning_summary: lowVolumeSummary,
    values: includeValues ? rows : null,
    further_research_prompt: RESEARCH_PROMPT,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

const metricList = Object.keys(METRICS).join(", ");

registerTool({
  name: "distribution",
  description: `Returns the across-agency distribution of a single metric over a year window, with the same sample-size guards as top_n_by. Output includes summary stats (min, p25, median, mean, p75, p90, p95, max, stdev), a binned histogram (configurable bin count, default 20), and the per-agency rows sorted ascending. Use this whenever you want to describe the shape of a metric across agencies, draw a histogram, or pick out outliers — instead of paging through one-by-one calls. Available metrics: ${metricList}. Filters: year_range, county, agency_type, min_sample_size, bins.`,
  inputSchema: inputSchemaFromZod(DistributionInput),
  handler: distributionHandler,
});
