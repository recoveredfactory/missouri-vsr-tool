import { z } from "zod";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import { PROBLEMATIC_YEAR_FLOOR, yearRangeWarnings } from "../year-range.js";
import { getAgencyDemographics } from "./agency-demographics.js";
import { RESEARCH_PROMPT } from "./caveats.js";
import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";

const RACE_LABELS = [
  "White",
  "Black",
  "Hispanic",
  "Asian",
  "Native American",
  "Other",
] as const;

const StopShareVsPopulationShareInput = z.object({
  agency_slug: z
    .string()
    .min(1)
    .describe(
      "The agency_slug from list_agencies. Always resolve loose names through list_agencies first.",
    ),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe(
      "Inclusive [start, end] year window for the stop data. Defaults to the four most recent years on file for this agency (2020 is excluded by default because the AG's published 2020 data has unreconciled anomalies — pass year_range explicitly to include it). Population data is the ACS 5-year estimate as of the agency's latest reporting year (does not move with the stop year_range).",
    ),
});

type Args = z.infer<typeof StopShareVsPopulationShareInput>;

const handler = async (raw: unknown) => {
  const parsed = StopShareVsPopulationShareInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: Args = parsed.data;

  // Pull demographics first — if there's no jurisdiction ACS, no comparison
  // is possible and we surface that honestly.
  const demographics = await getAgencyDemographics(args.agency_slug);
  if (!demographics) {
    return errorResult(
      `No jurisdiction ACS data available for agency "${args.agency_slug}". State-level agencies (MSHP, DNR Park Rangers), multi-county agencies, and agencies whose addresses didn't geocode cleanly fall into this bucket — there's no population baseline to compare stops against. Call agency_demographics to see why, or use raw stop data without a population comparison.`,
    );
  }

  // Resolve year window from the agency's coverage if not specified.
  const conn = await getDb();
  const agencyStmt = await conn.prepare(
    `SELECT canonical_name, county, agency_type, years_with_data, latest_year_with_data
     FROM agencies WHERE agency_slug = $1`,
  );
  agencyStmt.bindVarchar(1, args.agency_slug);
  const aReader = await agencyStmt.runAndReadAll();
  const aRows = aReader.getRows();
  if (aRows.length === 0) {
    return errorResult(
      `No agency found with agency_slug = "${args.agency_slug}". Use list_agencies first.`,
    );
  }
  const aCols = aReader.columnNames();
  const aMeta: Record<string, unknown> = {};
  aCols.forEach((c, i) => {
    aMeta[c] = normalize(aRows[0][i]);
  });
  const latestYear = Number(aMeta.latest_year_with_data);

  const [startYear, endYear] = (() => {
    if (args.year_range) return args.year_range;
    if (Number.isFinite(latestYear)) {
      // Four most recent years, floored at PROBLEMATIC_YEAR_FLOOR (2021).
      return [
        Math.max(PROBLEMATIC_YEAR_FLOOR, latestYear - 3),
        latestYear,
      ] as [number, number];
    }
    return [PROBLEMATIC_YEAR_FLOOR, 2024] as [number, number];
  })();

  // Pull the agency's stops by race, summed across the window.
  const stopsStmt = await conn.prepare(
    `SELECT
       SUM(total)::BIGINT AS total,
       SUM(white)::BIGINT AS white,
       SUM(black)::BIGINT AS black,
       SUM(hispanic)::BIGINT AS hispanic,
       SUM(asian)::BIGINT AS asian,
       SUM(native_american)::BIGINT AS native_american,
       SUM(other)::BIGINT AS other
     FROM stops
     WHERE agency_slug = $1
       AND metric = 'stops'
       AND year BETWEEN $2 AND $3`,
  );
  stopsStmt.bindVarchar(1, args.agency_slug);
  stopsStmt.bindInteger(2, startYear);
  stopsStmt.bindInteger(3, endYear);
  const sReader = await stopsStmt.runAndReadAll();
  const sRows = sReader.getRows();
  if (sRows.length === 0 || sRows[0][0] === null) {
    return errorResult(
      `No stops on file for agency "${args.agency_slug}" in ${startYear}–${endYear}. Try a wider year_range or check list_agencies for typos.`,
    );
  }
  const sCols = sReader.columnNames();
  const stopsByRaceRaw: Record<string, number> = {};
  sCols.forEach((c, i) => {
    stopsByRaceRaw[c] = Number(normalize(sRows[0][i]) ?? 0);
  });
  const stopsTotal = stopsByRaceRaw.total ?? 0;
  if (stopsTotal === 0) {
    return errorResult(
      `Agency "${args.agency_slug}" filed zero stops in ${startYear}–${endYear}.`,
    );
  }

  const dbRaceKey: Record<(typeof RACE_LABELS)[number], string> = {
    White: "white",
    Black: "black",
    Hispanic: "hispanic",
    Asian: "asian",
    "Native American": "native_american",
    Other: "other",
  };

  // Build the paired comparison row per race.
  const popTotal = demographics.population.total;
  const pairs = RACE_LABELS.map((race) => {
    const stops = stopsByRaceRaw[dbRaceKey[race]] ?? 0;
    const stopsPct = stopsTotal > 0 ? (stops / stopsTotal) * 100 : 0;
    const popEntry = demographics.population.by_race[race];
    const popValue = popEntry?.value ?? null;
    const popPct = popEntry?.pct ?? null;
    return {
      race,
      stops_count: stops,
      stops_share_pct: stopsPct,
      population_count: popValue,
      population_share_pct: popPct,
      stops_vs_population_ratio:
        popPct !== null && popPct > 0 ? stopsPct / popPct : null,
    };
  });

  const lowVolumeWarning =
    stopsTotal < 500
      ? `LOW VOLUME: this agency filed only ${stopsTotal} stops in ${startYear}–${endYear}. Per-race shares are highly volatile at this volume; treat single-percentage-point differences as noise.`
      : stopsTotal < 2500
        ? `MODEST VOLUME: ${stopsTotal} stops in ${startYear}–${endYear}. Race shares are usable for direction but be cautious about precise magnitudes; consider widening the window or contextualizing with multi-year trend.`
        : null;

  const payload = {
    agency_slug: args.agency_slug,
    canonical_name: aMeta.canonical_name,
    county: aMeta.county,
    agency_type: aMeta.agency_type,
    stop_year_range: [startYear, endYear],
    data_quality_warnings: yearRangeWarnings(startYear, endYear),
    stops_total_in_window: stopsTotal,
    low_volume_warning: lowVolumeWarning,
    population_data_source: demographics.data_source,
    population_jurisdiction: demographics.jurisdiction,
    population_total: popTotal,
    pairs,
    method_explainer:
      "Plain English (surface this BEFORE the numbers): we counted this agency's stops by the driver's officer-perceived race over the window, then compared each race's SHARE of stops to that race's SHARE of the local population (from the Census American Community Survey). A ratio above 1.0 means the race is over-represented in stops vs. their share of the population; below 1.0 means under-represented. Important caveat: this doesn't account for who's actually DRIVING on those roads — through-traffic, commuters, and transit gaps make residency a noisy proxy for the population exposed to being stopped. Stop race is officer-perceived; population race is self-reported on the ACS, and ACS Hispanic identity is a separate ethnicity question (not a race line, the way the stops data treats it). This perceived-vs-self-reported gap is widest for 'Other': 'Other' is the fastest-growing group in Missouri's ACS (self-identification) while the share of stops where officers record 'Other' has barely moved — so a large stops-below-population gap for 'Other' is expected and is mostly about perception vs. self-ID, not necessarily under-stopping. This is related to but mechanically different from the disparity index (which uses per-capita stop RATES rather than shares). Further reading: https://www.census.gov/programs-surveys/acs (background on the ACS); call read_methodology() for the full caveats.",
    interpretation_notes: [
      "Stops are summed across the year window. Population is the ACS 5-year estimate from the agency's latest reporting year — it does NOT move with the stop year_range and may slightly mismatch in older windows.",
      "Stop race is OFFICER-PERCEIVED. Population race is ACS SELF-REPORTED. The comparison is informative but the two are not directly equivalent.",
      "stops_vs_population_ratio > 1.0 means the race is over-represented in stops relative to population; < 1.0 under-represented; null means no population data for that race line. This is closely related to (but mechanically different from) the disparity index, which uses a per-resident stop RATE per race rather than a stop SHARE. Use whichever framing is right for your story — and explain which one.",
      "For multi-county agencies (some sheriff's departments), the geocoded jurisdiction may be just the county-seat city. Treat the population baseline as a rough proxy in those cases.",
    ],
    further_research_prompt: RESEARCH_PROMPT,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "stop_share_vs_population_share",
  description:
    "Composite tool: pairs an agency's stop-share-by-race (summed across a year window) against the jurisdiction's ACS race composition. Returns per-race pairs (stops_count + stops_share_pct vs. population_count + population_share_pct + ratio). The journalistically interesting comparison for 'this agency stops Black drivers 30% of the time but the jurisdiction is 5% Black' kind of framings. Honest error when no jurisdiction ACS exists (state-level / multi-county / unmapped). Returns JSON only — Claude can chart the pairs as a grouped bar chart however the client renders best.",
  inputSchema: inputSchemaFromZod(StopShareVsPopulationShareInput),
  handler,
});
