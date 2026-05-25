import { z } from "zod";

import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";

// Hand-curated list of known data-quality issues — almost always artifacts
// of the AG's office ingest pipeline rather than what the agency actually
// filed. Each entry should be linkable to a public caveat the project
// publishes (or to direct correspondence with the agency / AG's office).
//
// To add an issue: append to KNOWN_ISSUES below. Severity tiers:
//   "high"   — value is wildly wrong (e.g. inflated 10×+); do not quote.
//   "medium" — value is meaningfully off but the direction is right.
//   "low"    — minor discrepancy or unverified report; flag but usable.
//
// All affected (agency, year, metric) tuples will surface this issue in
// any analytical tool response that returns them.

export interface KnownDataIssue {
  agency_slug: string;
  years: number[];
  /** Affected metric keys (canonical or top_n_by names). Omit to flag all metrics for this agency × year. */
  metrics?: string[];
  severity: "high" | "medium" | "low";
  /** One-line summary surfaced inline in tool responses. */
  summary: string;
  /** Longer context surfaced when the caller asks via known_data_issues. */
  detail: string;
  /** How the issue was reported / verified. */
  source?: string;
  /** ISO date when the caveat was added to this list. */
  added: string;
}

export const KNOWN_ISSUES: KnownDataIssue[] = [
  {
    agency_slug: "kirkwood-police-dept",
    years: [2024],
    metrics: [
      "searches",
      "search-rate",
      "search_rate",
      "contraband-hit-rate",
      "contraband_hit_rate",
      "search_rate_minus_hit_rate",
    ],
    severity: "high",
    summary:
      "Kirkwood PD 2024 search count is inflated by the state AG's ingest pipeline — agency's filed numbers were normal but the state's published total ballooned to the thousands. Any search-derived rate for Kirkwood 2024 is unreliable.",
    detail:
      "Per direct correspondence with the agency: Kirkwood Police Department's 2024 filing to the Missouri Attorney General's office reported a normal number of vehicle searches consistent with prior years. The state's published 2024 Vehicle Stops Report shows Kirkwood with search counts in the thousands — orders of magnitude higher. The agency confirmed the discrepancy and provided their original filing for comparison; the topline was slightly off but the search figures were within historical norms. The error appears to have been introduced during the AG's ingest. Until the AG republishes corrected data, treat any Kirkwood 2024 search rate, contraband hit rate, or search-rate-minus-hit-rate as unreliable. The 2024 stop count itself is also slightly off but in a less impactful way.",
    source: "Direct correspondence with Kirkwood PD, 2025",
    added: "2026-05-24",
  },
];

const matchesAgencyYear = (
  issue: KnownDataIssue,
  agency_slug: string,
  year?: number,
): boolean => {
  if (issue.agency_slug !== agency_slug) return false;
  if (year === undefined) return true;
  return issue.years.includes(year);
};

const matchesMetric = (issue: KnownDataIssue, metric?: string): boolean => {
  if (!issue.metrics || issue.metrics.length === 0) return true;
  if (metric === undefined) return true;
  return issue.metrics.includes(metric);
};

/**
 * Find all known issues that touch a given agency × optional year ×
 * optional metric. Used to auto-attach warnings to analytical tool
 * responses. Returns an empty array if no issues match.
 */
export const findIssuesFor = (
  agency_slug: string,
  year?: number,
  metric?: string,
): KnownDataIssue[] =>
  KNOWN_ISSUES.filter(
    (i) =>
      matchesAgencyYear(i, agency_slug, year) && matchesMetric(i, metric),
  );

/**
 * Find all known issues for ANY year of an agency, optionally filtered to
 * a metric. For tools that return per-year rows where you want to know if
 * any year is affected.
 */
export const findIssuesForAgency = (
  agency_slug: string,
  metric?: string,
): KnownDataIssue[] =>
  KNOWN_ISSUES.filter(
    (i) => i.agency_slug === agency_slug && matchesMetric(i, metric),
  );

const KnownIssuesInput = z.object({
  agency_slug: z
    .string()
    .optional()
    .describe(
      "Filter to issues touching this agency_slug. Omit to return all known issues.",
    ),
  year: z
    .number()
    .int()
    .optional()
    .describe(
      "Filter to issues that affect this year. Combine with agency_slug for a targeted lookup.",
    ),
  metric: z
    .string()
    .optional()
    .describe(
      "Filter to issues affecting this metric (canonical_key or top_n_by metric name). Combine with agency_slug for the most specific match.",
    ),
});

type KnownIssuesArgs = z.infer<typeof KnownIssuesInput>;

const handler = async (raw: unknown) => {
  const parsed = KnownIssuesInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: KnownIssuesArgs = parsed.data;

  let matching = KNOWN_ISSUES;
  if (args.agency_slug) {
    matching = matching.filter((i) => i.agency_slug === args.agency_slug);
  }
  if (args.year !== undefined) {
    const y = args.year;
    matching = matching.filter((i) => i.years.includes(y));
  }
  if (args.metric) {
    const m = args.metric;
    matching = matching.filter((i) => matchesMetric(i, m));
  }

  return textResult(
    JSON.stringify(
      {
        n_total_issues: KNOWN_ISSUES.length,
        n_matching: matching.length,
        filters: {
          agency_slug: args.agency_slug ?? null,
          year: args.year ?? null,
          metric: args.metric ?? null,
        },
        list_maintenance_note:
          "This list is hand-curated in packages/mcp/src/tools/known-issues.ts and ships with the server. Additions go through PR review. The list is necessarily incomplete — surface the issues here when they apply, but absence of an issue is NOT a guarantee of clean data. If you spot something fishy that isn't listed, flag it to the user as 'this looks suspicious but isn't on the known-issues list yet.'",
        issues: matching,
      },
      null,
      2,
    ),
  );
};

registerTool({
  name: "known_data_issues",
  description:
    "Returns hand-curated, project-maintained data-quality caveats for specific agency × year × metric combinations. Many of these are AG-office ingest artifacts where the agency filed normal numbers but the state's published data is wrong. Other analytical tools auto-attach matching issues to their per-row results as a `known_data_issues` field; this tool gives you the full list (or filtered subset). Treat 'severity: high' issues as unquotable until corrected. Absence of an issue here is NOT a guarantee of clean data — the list is necessarily incomplete.",
  inputSchema: inputSchemaFromZod(KnownIssuesInput),
  handler,
});
