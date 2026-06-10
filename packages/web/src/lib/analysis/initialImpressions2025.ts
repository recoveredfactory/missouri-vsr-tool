// Server-side data loader for the "First impressions of the 2025 report"
// article. Fetches the three analysis bundle files published alongside the v2.2
// release and reshapes them into the minimal, chart-ready shapes the figure
// components expect. Agency-reporting counts (graphic 5) are derived from
// agency_index.json since there is no dedicated analysis file for them yet.
//
// Source: releases/v2.2/dist/analysis/initial-impressions-2025/
//   ii2025_disparity_index.json   (years 2023, 2025 only — official ACS denom)
//   ii2025_search_reasons_by_year.json
//   ii2025_race_summary_2025.json
//   + agency_index.json (years_with_data per agency)

import { withDataBase } from "$lib/dataBase";

export const II2025_BASE =
  "/data/dist/analysis/initial-impressions-2025";

/** Races we surface in the article (matches the draft's W/B/H focus). */
export const FOCUS_RACES = ["White", "Black", "Hispanic"] as const;
export type FocusRace = (typeof FOCUS_RACES)[number];

export type DisparityCell = {
  share_pct: number;
  pop_pct_16plus: number;
  disparity_index: number;
  official_disparity_index?: number;
};

export type DisparityData = {
  years: number[]; // [2023, 2025]
  /** metric -> race -> year -> cell */
  byMetric: Record<"stops" | "searches" | "arrests", Record<string, Record<number, DisparityCell>>>;
  caveat: string;
};

export type SearchReasonsData = {
  years: number[];
  consent: number[];
  smell: number[];
  other: number[];
  /** Year the "smell of drugs/alcohol" series becomes apples-to-apples. */
  reliableFromYear: number;
};

export type RaceSummaryPoint = {
  race: string;
  search_rate: number;
  contraband_hit_rate: number;
  total_stops: number;
  stop_share_pct: number;
};

export type AgencyReportingPoint = { year: number; count: number };

export type InitialImpressions2025 = {
  disparity: DisparityData;
  searchReasons: SearchReasonsData;
  raceSummary: { year: number; races: RaceSummaryPoint[]; total: RaceSummaryPoint | null };
  agenciesReporting: AgencyReportingPoint[];
};

type FetchFn = typeof fetch;

const fetchJson = async (fetchFn: FetchFn, path: string): Promise<any> => {
  const res = await fetchFn(withDataBase(path));
  if (!res.ok) throw new Error(`fetch ${path} -> ${res.status}`);
  return res.json();
};

const shapeDisparity = (raw: any): DisparityData => {
  const years = Object.keys(raw.years ?? {})
    .map(Number)
    .sort((a, b) => a - b);
  const metrics = ["stops", "searches", "arrests"] as const;
  const byMetric = { stops: {}, searches: {}, arrests: {} } as DisparityData["byMetric"];
  for (const metric of metrics) {
    for (const race of FOCUS_RACES) {
      byMetric[metric][race] = {};
      for (const year of years) {
        const cell = raw.years?.[year]?.[metric]?.[race];
        if (!cell) continue;
        byMetric[metric][race][year] = {
          share_pct: cell.share_pct,
          pop_pct_16plus: cell.pop_pct_16plus,
          disparity_index: cell.disparity_index,
          official_disparity_index: cell.official_disparity_index,
        };
      }
    }
  }
  return { years, byMetric, caveat: raw.caveat ?? "" };
};

const shapeSearchReasons = (raw: any): SearchReasonsData => {
  const collapsed = raw.collapsed ?? {};
  const years = Object.keys(collapsed)
    .map(Number)
    .sort((a, b) => a - b);
  const at = (year: number, bucket: string) =>
    Number(collapsed[year]?.[bucket]?.Total ?? 0);
  return {
    years,
    consent: years.map((y) => at(y, "consent")),
    smell: years.map((y) => at(y, "smell_of_drugs_alcohol")),
    other: years.map((y) => at(y, "all_other")),
    // Per the bundle README: the odor category is only apples-to-apples from
    // 2023 on (2023 reporting-form change; cannabis legalized Dec 2022).
    reliableFromYear: 2023,
  };
};

const shapeRaceSummary = (raw: any) => {
  const byRace = raw.by_race ?? {};
  const toPoint = (race: string, c: any): RaceSummaryPoint => ({
    race,
    search_rate: c.search_rate,
    contraband_hit_rate: c.contraband_hit_rate,
    total_stops: c.total_stops,
    stop_share_pct: c.stop_share_pct,
  });
  const races = FOCUS_RACES.filter((r) => byRace[r]).map((r) => toPoint(r, byRace[r]));
  const total = byRace.Total ? toPoint("Total", byRace.Total) : null;
  return { year: Number(raw.year), races, total };
};

const deriveAgenciesReporting = (
  agencyIndex: any,
  endYear: number,
  windowYears = 10,
): AgencyReportingPoint[] => {
  const agencies: any[] = Array.isArray(agencyIndex)
    ? agencyIndex
    : (agencyIndex?.agencies ?? Object.values(agencyIndex ?? {}));
  const startYear = endYear - windowYears + 1;
  const counts = new Map<number, number>();
  for (let y = startYear; y <= endYear; y++) counts.set(y, 0);
  for (const a of agencies) {
    const ywd: number[] = a?.years_with_data ?? [];
    for (const y of ywd) {
      if (y >= startYear && y <= endYear) counts.set(y, (counts.get(y) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({ year, count }));
};

export const loadInitialImpressions2025 = async (
  fetchFn: FetchFn,
): Promise<InitialImpressions2025> => {
  const [disparityRaw, searchRaw, raceRaw, agencyIndex] = await Promise.all([
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_disparity_index.json`),
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_search_reasons_by_year.json`),
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_race_summary_2025.json`),
    fetchJson(fetchFn, `/data/dist/agency_index.json`),
  ]);

  const raceSummary = shapeRaceSummary(raceRaw);
  return {
    disparity: shapeDisparity(disparityRaw),
    searchReasons: shapeSearchReasons(searchRaw),
    raceSummary,
    agenciesReporting: deriveAgenciesReporting(agencyIndex, raceSummary.year || 2025),
  };
};
