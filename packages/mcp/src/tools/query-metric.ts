import { z } from "zod";

import { getDb, getMetricCoverage } from "../db.js";
import { normalize } from "../duckutil.js";
import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";
import {
  DEFAULT_MIN_TOTAL_STOPS,
  MIN_TOTAL_STOPS_DESCRIPTION,
  RANKING_CAVEAT,
  RESEARCH_PROMPT,
  buildLowVolumeSummary,
  flagsFor,
} from "./caveats.js";
import { findIssuesFor, findIssuesForAgency } from "./known-issues.js";

const findIssuesForAnyYear = findIssuesForAgency;

const RACE_LABEL_TO_COLUMN: Record<string, string> = {
  total: "total",
  white: "white",
  black: "black",
  hispanic: "hispanic",
  asian: "asian",
  "native american": "native_american",
  native_american: "native_american",
  other: "other",
};

const RACE_ENUM = [
  "Total",
  "White",
  "Black",
  "Hispanic",
  "Asian",
  "Native American",
  "Other",
] as const;

const QueryMetricInput = z.object({
  canonical_key: z
    .string()
    .min(1)
    .describe(
      "The canonical_key for the metric you want raw values of. Call list_metrics first if you're not sure what's available — passing an unknown key returns an empty result with a hint.",
    ),
  race: z
    .enum(RACE_ENUM)
    .optional()
    .describe(
      "Which race column to return. Default 'Total' (all races combined). 'Hispanic' is officer-recorded as a race line, not a separate ethnicity — see read_methodology.",
    ),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe(
      "Inclusive [start, end] year window. Defaults to the metric's full year coverage (you'll see this in the response).",
    ),
  top_n: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe(
      "When set, ranks agencies by the latest year's value in the window and returns the top N. Without top_n, returns every agency that reported the metric (subject to filters).",
    ),
  ascending: z
    .boolean()
    .optional()
    .describe(
      "Only used with top_n. Sort ascending (lowest values first) instead of descending.",
    ),
  agency_slug: z
    .string()
    .optional()
    .describe(
      "Restrict to one agency. Mutually compatible with year_range but ignores top_n / county / agency_type.",
    ),
  county: z
    .string()
    .optional()
    .describe("Filter to a Missouri county (case-insensitive exact match)."),
  agency_type: z
    .string()
    .optional()
    .describe("Filter to a single agency_type (case-insensitive exact match)."),
  min_total_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(MIN_TOTAL_STOPS_DESCRIPTION),
  max_rows: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe(
      "Hard cap on per-year rows returned. Default 500. Raise (up to 5000) when you need the full agency × year matrix; lower it when you just want a sample.",
    ),
});

type QueryMetricArgs = z.infer<typeof QueryMetricInput>;

const handler = async (raw: unknown) => {
  const parsed = QueryMetricInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: QueryMetricArgs = parsed.data;

  const coverage = await getMetricCoverage();
  const meta = coverage.find((m) => m.canonical_key === args.canonical_key);
  if (!meta) {
    return errorResult(
      `Unknown canonical_key: "${args.canonical_key}". Call list_metrics() to see what's available (or list_metrics(contains: "<substring>") to search).`,
    );
  }

  const raceLabel = args.race ?? "Total";
  const raceCol = RACE_LABEL_TO_COLUMN[raceLabel.toLowerCase()];
  if (!meta.races_populated.includes(raceLabel)) {
    return errorResult(
      `Metric "${args.canonical_key}" has no data in the ${raceLabel} column. Populated races for this metric: ${meta.races_populated.join(", ")}.`,
    );
  }

  const [yearMin, yearMax] = (() => {
    if (args.year_range) return args.year_range;
    const yrs = meta.years_present;
    if (yrs.length === 0) return [2020, 2024] as [number, number];
    return [yrs[0], yrs[yrs.length - 1]] as [number, number];
  })();

  const minTotalStops = args.min_total_stops ?? DEFAULT_MIN_TOTAL_STOPS;
  const maxRows = args.max_rows ?? 500;

  const conn = await getDb();

  const extraFilters: string[] = [];
  const stringBindings: Array<{ idx: number; value: string }> = [];
  // Param indices: $1 metric, $2 start year, $3 end year, $4+ for filters.
  let nextIdx = 4;
  if (args.agency_slug) {
    extraFilters.push(`AND s.agency_slug = $${nextIdx}`);
    stringBindings.push({ idx: nextIdx, value: args.agency_slug });
    nextIdx += 1;
  }
  if (args.county) {
    extraFilters.push(`AND LOWER(a.county) = $${nextIdx}`);
    stringBindings.push({ idx: nextIdx, value: args.county.toLowerCase() });
    nextIdx += 1;
  }
  if (args.agency_type) {
    extraFilters.push(`AND LOWER(a.agency_type) = $${nextIdx}`);
    stringBindings.push({
      idx: nextIdx,
      value: args.agency_type.toLowerCase(),
    });
    nextIdx += 1;
  }

  const sql = `
    SELECT
      a.agency_slug,
      a.canonical_name,
      a.county,
      a.agency_type,
      s.year,
      s.${raceCol} AS value,
      stops_tot.total AS stops_total_year
    FROM stops s
    INNER JOIN agencies a ON a.agency_slug = s.agency_slug
    LEFT JOIN stops stops_tot
      ON stops_tot.agency_slug = s.agency_slug
     AND stops_tot.year = s.year
     AND stops_tot.metric = 'stops'
    WHERE s.metric = $1
      AND s.year BETWEEN $2 AND $3
      AND s.${raceCol} IS NOT NULL
      ${
        // When the user asks about a single agency by slug, allow the
        // statewide-rollup through (they may have asked for it explicitly).
        // Otherwise filter it out from the default ranking/listing surface.
        args.agency_slug ? "" : "AND a.is_statewide_rollup = FALSE"
      }
      ${extraFilters.join("\n      ")}
    ORDER BY a.canonical_name, s.year DESC
  `;
  const stmt = await conn.prepare(sql);
  stmt.bindVarchar(1, args.canonical_key);
  stmt.bindInteger(2, yearMin);
  stmt.bindInteger(3, yearMax);
  for (const b of stringBindings) stmt.bindVarchar(b.idx, b.value);

  const reader = await stmt.runAndReadAll();
  const cols = reader.columnNames();
  const allRows = reader.getRows().map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      obj[c] = normalize(row[i]);
    });
    return obj;
  });

  // Group per-agency for ranking + display.
  const bySlug = new Map<string, Record<string, unknown>[]>();
  for (const r of allRows) {
    const slug = String(r.agency_slug);
    const list = bySlug.get(slug) ?? [];
    list.push(r);
    bySlug.set(slug, list);
  }

  // Compute total_stops_in_window per agency (sum of stops_total_year across
  // the per-year rows we got back). Used for both the min_total_stops filter
  // and the per-row guardrail column.
  const stopsInWindowBySlug = new Map<string, number>();
  for (const [slug, rows] of bySlug) {
    let sum = 0;
    for (const r of rows) sum += Number(r.stops_total_year ?? 0);
    stopsInWindowBySlug.set(slug, sum);
  }

  // Apply the min_total_stops filter (orthogonal to whether the requested
  // metric had a value). Single-agency mode bypasses it — if the user asked
  // about a specific agency we always return what they asked for.
  let agencySlugs = [...bySlug.keys()];
  if (!args.agency_slug) {
    agencySlugs = agencySlugs.filter(
      (slug) => (stopsInWindowBySlug.get(slug) ?? 0) >= minTotalStops,
    );
  }
  const nInEligiblePool = agencySlugs.length;

  // Ranking mode: pick top_n by latest non-null year value in the window.
  let ranking_basis: string | null = null;
  if (args.top_n && !args.agency_slug) {
    const direction = args.ascending ? "asc" : "desc";
    ranking_basis = `latest year's value within [${yearMin}, ${yearMax}], sorted ${direction}`;
    const latestValues = agencySlugs.map((slug) => {
      const rows = bySlug.get(slug)!;
      // rows are already ordered by year DESC, so rows[0] is the latest.
      const latest = rows[0];
      return {
        slug,
        latest_year: Number(latest.year),
        latest_value: Number(latest.value),
      };
    });
    latestValues.sort((a, b) =>
      args.ascending
        ? a.latest_value - b.latest_value
        : b.latest_value - a.latest_value,
    );
    agencySlugs = latestValues.slice(0, args.top_n).map((r) => r.slug);
  }

  // Hard cap on per-year row count. Without an explicit top_n, sort agencies
  // by total_stops_in_window descending (most journalism-relevant first) and
  // include agencies in that order until we hit maxRows.
  let truncatedAgencies = false;
  if (!args.agency_slug && !args.top_n) {
    agencySlugs.sort(
      (a, b) =>
        (stopsInWindowBySlug.get(b) ?? 0) - (stopsInWindowBySlug.get(a) ?? 0),
    );
  }
  const kept: string[] = [];
  let rowsKept = 0;
  for (const slug of agencySlugs) {
    const need = bySlug.get(slug)!.length;
    if (rowsKept + need > maxRows && kept.length > 0) {
      truncatedAgencies = true;
      break;
    }
    kept.push(slug);
    rowsKept += need;
  }
  agencySlugs = kept;

  const agencies = agencySlugs.map((slug) => {
    const rows = bySlug.get(slug)!;
    const first = rows[0];
    const stopsInWindow = stopsInWindowBySlug.get(slug) ?? 0;
    const { low_volume_warning } = flagsFor(stopsInWindow);
    const per_year = rows.map((r) => {
      const year = Number(r.year);
      const issues = findIssuesFor(slug, year, args.canonical_key);
      return {
        year,
        value: r.value,
        stops_total_year: r.stops_total_year,
        ...(issues.length > 0 ? { known_data_issues: issues } : {}),
      };
    });
    // Roll up any per-year issues into an agency-level flag so a reader
    // scanning the agency list sees the warning without having to expand
    // per_year.
    const agencyIssues = findIssuesForAnyYear(slug, args.canonical_key);
    return {
      agency_slug: slug,
      canonical_name: first.canonical_name,
      county: first.county,
      agency_type: first.agency_type,
      latest_year_in_window: Number(first.year),
      latest_value: first.value,
      total_stops_in_window: stopsInWindow,
      low_volume_warning,
      ...(agencyIssues.length > 0
        ? { known_data_issues: agencyIssues }
        : {}),
      per_year,
    };
  });

  const filtered_year_range = [yearMin, yearMax] as [number, number];
  const yearsCoveredHere = Array.from(
    new Set(allRows.map((r) => Number(r.year))),
  ).sort((a, b) => a - b);

  const lowVolumeSummary = buildLowVolumeSummary(
    agencies.map((a) => ({
      canonical_name: a.canonical_name,
      total_stops_in_window: a.total_stops_in_window,
    })),
  );

  const payload = {
    canonical_key: args.canonical_key,
    race_column: raceLabel,
    type_heuristic: meta.type_heuristic,
    year_range_requested: filtered_year_range,
    years_actually_returned: yearsCoveredHere,
    metric_coverage_note: `This metric has data for years ${meta.years_present[0]}–${meta.years_present[meta.years_present.length - 1]} (${meta.years_present.length} years). Race columns populated for this metric: ${meta.races_populated.join(", ")}.`,
    ranking_basis,
    n_agencies_returned: agencies.length,
    n_in_eligible_pool: nInEligiblePool,
    truncated_by_max_rows: truncatedAgencies,
    rows_returned: rowsKept,
    max_rows: maxRows,
    min_total_stops: minTotalStops,
    filters: {
      agency_slug: args.agency_slug ?? null,
      county: args.county ?? null,
      agency_type: args.agency_type ?? null,
    },
    defaulted_filters: {
      min_total_stops: args.min_total_stops === undefined,
      max_rows: args.max_rows === undefined,
      year_range: args.year_range === undefined,
      race: args.race === undefined,
    },
    interpretation_note:
      meta.type_heuristic === "rate"
        ? "value is a pre-computed rate on the 0–100 scale. DO NOT sum these across years — average them or quote the per-year values."
        : meta.type_heuristic === "ratio"
          ? "value is the disparity ratio. 1.0 = parity with the white non-Hispanic baseline."
          : meta.type_heuristic === "population"
            ? "value is a population denominator (ACS / decennial), not a stop count."
            : "value is a raw count for that agency × year. Sum-able across years if the question warrants.",
    low_volume_warning_summary: lowVolumeSummary,
    ranking_caveat: RANKING_CAVEAT,
    further_research_prompt: RESEARCH_PROMPT,
    sample_size_companion:
      "Each per_year row includes stops_total_year — that agency's total stops in that year. Each agency carries total_stops_in_window + a low_volume_warning flag (set when below 2500 stops in the window). Treat any flagged agency with EXPLICIT skepticism in your answer.",
    agencies,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "query_metric",
  description:
    "Returns raw per-agency × per-year values for any canonical_key in the dataset, with NO cross-year aggregation and NO derivations — exactly what the agency filed (or what the pipeline pre-computed at the source). Use this for resident-stops, non-resident-stops, age/gender breakdowns, probable-cause variants, anything top_n_by doesn't cover. Optional ranking: pass top_n to rank by the latest year's value in the window. Every response includes the metric's coverage (which years actually have data), the per-row stops_total_year for sample-size context, and a ranking-volatility caveat. For curated derived metrics (search_rate, hit_rate, disparity_index, etc.), use top_n_by instead.",
  inputSchema: inputSchemaFromZod(QueryMetricInput),
  handler,
});
