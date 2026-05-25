import { z } from "zod";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
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
      "The agency_slug from list_agencies (e.g. 'missouri-state-hwy-patrol'). Always resolve loose names through list_agencies first.",
    ),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe(
      "Inclusive [start_year, end_year]. Omit for the most recent five years on file for this agency.",
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
      return [latestYear - 4, latestYear] as [number, number];
    }
    if (yearsWithData.length) {
      const sorted = [...yearsWithData].sort((a, b) => a - b);
      return [sorted[sorted.length - 5] ?? sorted[0], sorted[sorted.length - 1]] as [
        number,
        number,
      ];
    }
    return [2020, 2024] as [number, number];
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

  const summary = {
    agency: agencyMeta,
    known_data_issues: agencyIssues.length > 0 ? agencyIssues : null,
    year_range_requested: [startYear, endYear],
    year_range_observed: observedYears.length
      ? [observedYears[observedYears.length - 1], observedYears[0]]
      : null,
    metrics_returned: SUMMARY_METRICS,
    note: "Counts (stops/searches/contraband-total/arrests/citations) are raw integers. Rates (search-rate/contraband-hit-rate/arrest-rate/citation-rate) are reported as RATES PER 100 — typically 0–100 but **can exceed 100** because a single stop can produce multiple citations / multiple searches / multiple arrests. Do NOT chart these as percentages with a 0–100 axis or call them 'percent of stops' — they're per-100 rates. disparity-index--all-stops is a ratio against the white non-Hispanic baseline (1.0 = parity). For deeper interpretation see read_methodology.",
    further_research_prompt: RESEARCH_PROMPT,
    data,
  };

  return textResult(JSON.stringify(summary, null, 2));
};

registerTool({
  name: "agency_summary",
  description:
    "Returns a curated multi-year summary for a single agency: stop counts, search counts, contraband finds, arrest and citation counts, plus their corresponding rates, plus the disparity index — all broken down by race. Defaults to the most recent five years on file. Use list_agencies first to resolve a natural-language name into an agency_slug.",
  inputSchema: inputSchemaFromZod(AgencySummaryInput),
  handler: agencySummaryHandler,
});
