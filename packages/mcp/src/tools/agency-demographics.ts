import { z } from "zod";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import { RESEARCH_PROMPT } from "./caveats.js";
import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";

// Per-agency cache of the extracted ACS demographics. Keyed by agency_slug.
// `null` means we already tried and there is no jurisdiction ACS for this
// agency (state-level, no geocode, etc.) — distinct from "not yet looked up."
const DEMOGRAPHICS_CACHE = new Map<string, ExtractedDemographics | null>();

interface ExtractedDemographics {
  agency_slug: string;
  canonical_name: string;
  jurisdiction: {
    formatted_address: string | null;
    geography_type: string | null;
  };
  data_source: {
    source: string;
    survey_years: string;
    survey_duration_years: string;
  } | null;
  population: {
    total: number;
    by_race: Record<string, { value: number; pct: number }>;
    by_sex: { Male: number | null; Female: number | null };
    median_age: number | null;
  };
  economics: {
    median_household_income_usd: number | null;
    per_capita_income_usd: number | null;
    number_of_households: number | null;
  };
}

// Map ACS race keys (self-reported) to stops-data canonical race labels
// (officer-perceived). Hispanic is reported as a race line in the VSR; here
// we collapse the ACS Hispanic-or-Latino umbrella so it pairs with that
// convention. Pacific Islander, some-other-race, and two-or-more roll into
// "Other" because none individually map to a stops-data category.
const RACE_AGGREGATIONS: Record<string, string[]> = {
  White: ["Not Hispanic or Latino: White alone"],
  Black: ["Not Hispanic or Latino: Black or African American alone"],
  Hispanic: ["Hispanic or Latino"],
  Asian: ["Not Hispanic or Latino: Asian alone"],
  "Native American": [
    "Not Hispanic or Latino: American Indian and Alaska Native alone",
  ],
  Other: [
    "Not Hispanic or Latino: Native Hawaiian and Other Pacific Islander alone",
    "Not Hispanic or Latino: Some other race alone",
    "Not Hispanic or Latino: Two or more races",
  ],
};

const baseUrl = () =>
  process.env.DATA_BASE_URL ?? "https://data.vsr.recoveredfactory.net";
const releasePath = () => process.env.DATA_RELEASE_PATH ?? "/releases/v2.1";

const agencyYearUrl = (slug: string, year: number) =>
  `${baseUrl()}${releasePath()}/dist/agency_year/${slug}/${year}.json`;

const readValue = (cell: unknown): number | null => {
  if (
    cell &&
    typeof cell === "object" &&
    "value" in (cell as Record<string, unknown>)
  ) {
    const v = (cell as { value: unknown }).value;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return null;
};

const extractFromJson = (
  slug: string,
  canonicalName: string,
  json: Record<string, unknown>,
): ExtractedDemographics | null => {
  const agencyMeta = json.agency_metadata as Record<string, unknown> | undefined;
  const jResp = agencyMeta?.geocode_jurisdiction_response as
    | { results?: Array<Record<string, unknown>> }
    | undefined;
  const result = jResp?.results?.[0];
  if (!result) return null;
  const fields = result.fields as Record<string, unknown> | undefined;
  const acs = fields?.acs as Record<string, unknown> | undefined;
  if (!acs) return null;
  const demographics = acs.demographics as Record<string, unknown> | undefined;
  if (!demographics) return null;

  const race = demographics["Race and ethnicity"] as
    | Record<string, unknown>
    | undefined;
  const totalCell = race?.Total as { value?: number } | undefined;
  const total = typeof totalCell?.value === "number" ? totalCell.value : null;
  if (!race || total === null || total === 0) return null;

  const byRace: ExtractedDemographics["population"]["by_race"] = {};
  for (const [label, sources] of Object.entries(RACE_AGGREGATIONS)) {
    let value = 0;
    let anyPresent = false;
    for (const src of sources) {
      const v = readValue(race[src]);
      if (v !== null) {
        value += v;
        anyPresent = true;
      }
    }
    if (anyPresent) {
      byRace[label] = {
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
      };
    }
  }

  const sex = demographics.Sex as Record<string, unknown> | undefined;
  const sexMale = sex ? readValue(sex.Male) : null;
  const sexFemale = sex ? readValue(sex.Female) : null;

  const medianAge = demographics["Median age"] as
    | Record<string, unknown>
    | undefined;
  const medianAgeTotal =
    medianAge && typeof medianAge.Total === "object" && medianAge.Total
      ? (medianAge.Total as { value?: unknown }).value
      : null;

  const economics = acs.economics as Record<string, unknown> | undefined;
  const mhi = economics?.["Median household income"] as
    | { Total?: { value?: number } }
    | undefined;
  const pci = economics?.["Per capita income"] as
    | { Total?: { value?: number } }
    | undefined;
  const hh = economics?.["Number of households"] as
    | { Total?: { value?: number } }
    | undefined;

  const meta = acs.meta as
    | { source?: string; survey_years?: string; survey_duration_years?: string }
    | undefined;

  return {
    agency_slug: slug,
    canonical_name: canonicalName,
    jurisdiction: {
      formatted_address:
        typeof result.formatted_address === "string"
          ? result.formatted_address
          : null,
      geography_type:
        typeof (demographics.meta as { geography?: unknown })?.geography ===
        "string"
          ? ((demographics.meta as { geography: string }).geography as string)
          : null,
    },
    data_source: meta
      ? {
          source: meta.source ?? "American Community Survey (US Census Bureau)",
          survey_years: meta.survey_years ?? "(unknown)",
          survey_duration_years: meta.survey_duration_years ?? "(unknown)",
        }
      : null,
    population: {
      total,
      by_race: byRace,
      by_sex: { Male: sexMale, Female: sexFemale },
      median_age:
        typeof medianAgeTotal === "number" ? medianAgeTotal : null,
    },
    economics: {
      median_household_income_usd:
        typeof mhi?.Total?.value === "number" ? mhi.Total.value : null,
      per_capita_income_usd:
        typeof pci?.Total?.value === "number" ? pci.Total.value : null,
      number_of_households:
        typeof hh?.Total?.value === "number" ? hh.Total.value : null,
    },
  };
};

const loadDemographics = async (
  slug: string,
  canonicalName: string,
  latestYear: number,
): Promise<ExtractedDemographics | null> => {
  if (DEMOGRAPHICS_CACHE.has(slug)) {
    return DEMOGRAPHICS_CACHE.get(slug)!;
  }
  const url = agencyYearUrl(slug, latestYear);
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    DEMOGRAPHICS_CACHE.set(slug, null);
    return null;
  }
  const json = (await res.json()) as Record<string, unknown>;
  const extracted = extractFromJson(slug, canonicalName, json);
  DEMOGRAPHICS_CACHE.set(slug, extracted);
  return extracted;
};

export const getAgencyDemographics = async (
  slug: string,
): Promise<ExtractedDemographics | null> => {
  const conn = await getDb();
  const stmt = await conn.prepare(
    `SELECT canonical_name, latest_year_with_data
     FROM agencies WHERE agency_slug = $1`,
  );
  stmt.bindVarchar(1, slug);
  const reader = await stmt.runAndReadAll();
  const rows = reader.getRows();
  if (rows.length === 0) return null;
  const canonical = String(normalize(rows[0][0]));
  const latest = Number(normalize(rows[0][1]));
  if (!Number.isFinite(latest)) return null;
  return loadDemographics(slug, canonical, latest);
};

const AgencyDemographicsInput = z.object({
  agency_slug: z
    .string()
    .min(1)
    .describe(
      "The agency_slug from list_agencies (e.g. 'st-louis-city-police-dept'). Always resolve loose names through list_agencies first.",
    ),
});

type AgencyDemographicsArgs = z.infer<typeof AgencyDemographicsInput>;

const handler = async (raw: unknown) => {
  const parsed = AgencyDemographicsInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: AgencyDemographicsArgs = parsed.data;

  const conn = await getDb();
  const stmt = await conn.prepare(
    `SELECT canonical_name, county, agency_type, latest_year_with_data
     FROM agencies WHERE agency_slug = $1`,
  );
  stmt.bindVarchar(1, args.agency_slug);
  const reader = await stmt.runAndReadAll();
  const rows = reader.getRows();
  if (rows.length === 0) {
    return errorResult(
      `No agency found with agency_slug = "${args.agency_slug}". Use list_agencies to find the correct slug.`,
    );
  }
  const cols = reader.columnNames();
  const meta: Record<string, unknown> = {};
  cols.forEach((c, i) => {
    meta[c] = normalize(rows[0][i]);
  });

  const demographics = await getAgencyDemographics(args.agency_slug);

  if (!demographics) {
    return textResult(
      JSON.stringify(
        {
          agency_slug: args.agency_slug,
          canonical_name: meta.canonical_name,
          county: meta.county,
          agency_type: meta.agency_type,
          jurisdiction: null,
          population: null,
          economics: null,
          note: "This agency has no jurisdiction-specific ACS census data on file. State-level agencies (MSHP, DNR Park Rangers), agencies whose addresses didn't geocode to a Census place, and a handful of multi-county agencies fall into this bucket. For statewide enforcement comparisons, the population baseline is the whole state of Missouri (~6.2M residents per 2019-2023 ACS); this server does not pull statewide ACS figures directly. Use stop_share_vs_population_share when the agency does have jurisdiction data; otherwise, fall back to the per-agency stop data and acknowledge the missing denominator.",
          further_research_prompt: RESEARCH_PROMPT,
        },
        null,
        2,
      ),
    );
  }

  const payload = {
    ...demographics,
    county: meta.county,
    agency_type: meta.agency_type,
    method_explainer:
      "Plain English (surface this BEFORE the numbers): jurisdiction census data for this agency, from the American Community Survey 5-year estimates published by the U.S. Census Bureau. Race labels are MAPPED to match the stops data (White / Black / Hispanic / Asian / Native American / Other) — but they're not perfectly comparable: ACS race is self-reported by survey respondents, while stops-data race is officer-perceived during the stop. ACS 5-year estimates pool five years of surveys to stabilize small-area numbers, so a 2024 estimate is averaged across roughly 2020–2024 of responses. State-level agencies (MSHP, DNR Park Rangers) and unmapped agencies return null — there's no single jurisdiction to compute demographics for. ACS estimates have margins of error that are not surfaced in this payload; for journalism use, pull the underlying tables directly. Further reading: https://www.census.gov/programs-surveys/acs (Census Bureau ACS overview and table access).",
    interpretation_notes: [
      "Race here is ACS self-reported (Census Bureau). Race in the stops table is officer-perceived. The two are not directly comparable — comparison is informative but not exact.",
      "'Other' aggregates Native Hawaiian/Pacific Islander + Some-other-race + Two-or-more-races to roughly align with the stops-data 'Other' bucket. The mapping is not perfect.",
      "Margins of error are not surfaced here. ACS place-level estimates have meaningful MoEs — for journalism use, pull the underlying tables.",
      "Jurisdiction here is the geocoded primary boundary for the agency's address (typically the city). It may not perfectly match the agency's actual enforcement footprint (e.g., a sheriff's office whose 'jurisdiction' geocodes to the county seat).",
    ],
    further_research_prompt: RESEARCH_PROMPT,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "agency_demographics",
  description:
    "Returns the ACS jurisdiction census data for one agency: total population, race composition (mapped to the stops-data race labels: White / Black / Hispanic / Asian / Native American / Other), sex split, median age, median household income, per-capita income, household count. Source is the American Community Survey 5-year estimates as of the agency's latest reporting year. Returns an explicit null + a note when no jurisdiction ACS exists (state-level agencies, agencies that didn't geocode cleanly, etc.). Pair with stops data to compare officer-perceived stop demographics against ACS-reported population demographics.",
  inputSchema: inputSchemaFromZod(AgencyDemographicsInput),
  handler,
});
