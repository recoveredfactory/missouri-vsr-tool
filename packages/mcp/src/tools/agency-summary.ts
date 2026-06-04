import { z } from "zod";

import { getDb, getProgram287gSnapshot, STATEWIDE_ROLLUP_SLUG } from "../db.js";
import { normalize } from "../duckutil.js";
import { PROBLEMATIC_YEAR_FLOOR, yearRangeWarnings } from "../year-range.js";
import { RESEARCH_PROMPT } from "./caveats.js";
import { findIssuesForAgency } from "./known-issues.js";
import { errorResult, inputSchemaFromZod, registerTool, textResult } from "./registry.js";

const SUMMARY_METRICS = [
  "stops",
  "searches",
  "contraband-total",
  "search-rate",
  "contraband-hit-rate",
  "arrests",
  "arrest-rate",
  "citations",
  "citation-rate",
  "disparity-index--all-stops",
] as const;

const AgencySummaryInput = z.object({
  agency_id: z
    .string()
    .min(1)
    .describe(
      "The agency_slug from list_agencies (e.g. 'missouri-state-hwy-patrol'). Always resolve loose names through list_agencies first. For STATEWIDE totals/rates, pass 'missouri-all-agencies' — the pre-computed aggregate across all agencies — instead of summing agencies yourself.",
    ),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe(
      "Inclusive [start_year, end_year]. Omit for the most recent four years on file for this agency (2020 is excluded by default because the AG's published 2020 data has unreconciled anomalies). Pass an explicit range to include 2020; a data_quality_warnings entry will be attached.",
    ),
});

type AgencySummaryArgs = z.infer<typeof AgencySummaryInput>;

const agencySummaryHandler = async (raw: unknown) => {
  const parsed = AgencySummaryInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: AgencySummaryArgs = parsed.data;

  const conn = await getDb();

  const agencyStmt = await conn.prepare(
    `SELECT agency_slug, canonical_name, county, agency_type,
            lifetime_stops, latest_year_stops,
            years_with_data, latest_year_with_data
     FROM agencies WHERE agency_slug = $1`,
  );
  agencyStmt.bindVarchar(1, args.agency_id);
  const agencyReader = await agencyStmt.runAndReadAll();
  const agencyRows = agencyReader.getRows();
  if (agencyRows.length === 0) {
    return errorResult(
      `No agency found with agency_slug = "${args.agency_id}". Use list_agencies to find the correct slug.`,
    );
  }
  const agencyCols = agencyReader.columnNames();
  const agencyMeta: Record<string, unknown> = {};
  agencyCols.forEach((col, i) => {
    agencyMeta[col] = normalize(agencyRows[0][i]);
  });

  const yearsWithData = Array.isArray(agencyMeta.years_with_data)
    ? (agencyMeta.years_with_data as number[])
    : [];
  const latestYear = Number(agencyMeta.latest_year_with_data);

  const [startYear, endYear] = (() => {
    if (args.year_range) return args.year_range;
    if (Number.isFinite(latestYear)) {
      // Default to four most recent years; floor start at PROBLEMATIC_YEAR_FLOOR (2021).
      return [
        Math.max(PROBLEMATIC_YEAR_FLOOR, latestYear - 3),
        latestYear,
      ] as [number, number];
    }
    if (yearsWithData.length) {
      const sorted = [...yearsWithData].sort((a, b) => a - b);
      const proposedStart = sorted[sorted.length - 4] ?? sorted[0];
      return [
        Math.max(PROBLEMATIC_YEAR_FLOOR, proposedStart),
        sorted[sorted.length - 1],
      ] as [number, number];
    }
    return [PROBLEMATIC_YEAR_FLOOR, 2024] as [number, number];
  })();

  const sql = `
    SELECT year, metric, total, white, black, hispanic, asian, native_american, other
    FROM stops
    WHERE agency_slug = $1
      AND year BETWEEN $2 AND $3
      AND metric IN (${SUMMARY_METRICS.map((_, i) => `$${i + 4}`).join(", ")})
    ORDER BY year DESC, metric
  `;
  const stmt = await conn.prepare(sql);
  stmt.bindVarchar(1, args.agency_id);
  stmt.bindInteger(2, startYear);
  stmt.bindInteger(3, endYear);
  SUMMARY_METRICS.forEach((m, i) => stmt.bindVarchar(i + 4, m));
  const reader = await stmt.runAndReadAll();

  const cols = reader.columnNames();
  const rows = reader.getRows();
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = normalize(row[i]);
    });
    return obj;
  });

  const observedYears = Array.from(new Set(data.map((d) => d.year as number))).sort(
    (a, b) => b - a,
  );

  const agencyIssues = findIssuesForAgency(args.agency_id);

  // 287(g) participation block. Only attached when this agency is on
  // ICE's most-recent published participating-agencies snapshot — and the
  // block's `as_of` field makes the point-in-time nature explicit. Call
  // list_287g_participants for the full snapshot caveats / methodology.
  const program287gSnap = await getProgram287gSnapshot();
  const program287gMatch = program287gSnap.participants.find(
    (p) => p.agency_slug === args.agency_id,
  );
  const program287g = program287gMatch
    ? {
        active_as_of: program287gSnap.snapshot_date,
        snapshot_source: `ICE Participating Agencies file (${program287gSnap.snapshot_filename})`,
        agreements: program287gMatch.agreements,
        as_of_caveat:
          "ACTIVE participation as of the snapshot only. If this agency has terminated its 287(g) agreement since then, that won't be reflected here until ICE publishes a new file. Call list_287g_participants for the full caveats.",
      }
    : null;

  const isStatewideRollup = args.agency_id === STATEWIDE_ROLLUP_SLUG;

  const summary = {
    agency: agencyMeta,
    statewide_rollup: isStatewideRollup
      ? "This is the STATEWIDE AGGREGATE across every reporting agency (the pre-computed 'Missouri (all agencies)' rollup), not a single department. Use these numbers directly for statewide totals/rates instead of summing individual agencies. Per-capita/population-denominator metrics (e.g. resident stop rate) are not meaningful here and may be omitted."
      : null,
    program_287g: program287g,
    known_data_issues: agencyIssues.length > 0 ? agencyIssues : null,
    year_range_requested: [startYear, endYear],
    year_range_basis:
      args.year_range === undefined
        ? `Defaulted to ${startYear}–${endYear} (four most recent years on file; 2020 is excluded by default — see data_quality_warnings or read_methodology).`
        : "Caller-specified year_range.",
    data_quality_warnings: yearRangeWarnings(startYear, endYear),
    year_range_observed: observedYears.length
      ? [observedYears[observedYears.length - 1], observedYears[0]]
      : null,
    metrics_returned: SUMMARY_METRICS,
    method_explainer:
      "Plain English (surface this BEFORE the numbers): you're getting four years of this agency's filings — raw counts (stops, searches, contraband, arrests, citations) plus the matching rates and the disparity index — broken out by the driver's officer-perceived race. Rates here are per 100 stops, not percentages: they can exceed 100 because one stop can produce multiple citations / multiple searches / multiple arrests (very common, especially for citations). The disparity-index--all-stops column is a RATIO of per-capita stop rates against the white non-Hispanic baseline; 1.0 = parity, above 1.0 = stopped at a higher per-resident rate. Don't chart any of the rates on a 0–100 axis labeled 'percent of stops' — say 'per 100' or 'per stop'. Further reading: call read_methodology() for the full metric definitions and the rate-vs-percentage distinction.",
    note: "Counts (stops/searches/contraband-total/arrests/citations) are raw integers. Rates (search-rate/contraband-hit-rate/arrest-rate/citation-rate) are reported as RATES PER 100 — typically 0–100 but **can exceed 100** because a single stop can produce multiple citations / multiple searches / multiple arrests. Do NOT chart these as percentages with a 0–100 axis or call them 'percent of stops' — they're per-100 rates. disparity-index--all-stops is a ratio against the white non-Hispanic baseline (1.0 = parity). For deeper interpretation see read_methodology.",
    further_research_prompt: RESEARCH_PROMPT,
    data,
  };

  return textResult(JSON.stringify(summary, null, 2));
};

registerTool({
  name: "agency_summary",
  description:
    "Returns a curated multi-year summary for a single agency: stop counts, search counts, contraband finds, arrest and citation counts, plus their corresponding rates, plus the disparity index — all broken down by race. Defaults to the most recent four years on file (2020 excluded by default due to unreconciled data anomalies — pass year_range explicitly to include it). Use list_agencies first to resolve a natural-language name into an agency_slug. For STATEWIDE figures, pass agency_id='missouri-all-agencies' to read the pre-computed aggregate directly rather than summing every agency.",
  inputSchema: inputSchemaFromZod(AgencySummaryInput),
  handler: agencySummaryHandler,
});
