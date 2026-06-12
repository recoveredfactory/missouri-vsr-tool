// Server-side data loader for the "First impressions of the 2025 report"
// article. Fetches the analysis bundle files published alongside the v2.2
// release and reshapes them into the minimal, chart-ready shapes the figure
// components expect.
//
// Source: releases/v2.2/dist/analysis/initial-impressions-2025/
//   ii2025_disparity_index.json
//   ii2025_search_reasons_by_year.json
//   ii2025_race_summary_2025.json
//   ii2025_agencies_reporting.json  (graphic 1: roster composition + 2024 churn)

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

export type AgencyReportingPoint = {
  year: number;
  /** Reported (nonzero) this year and the prior year. */
  consistent: number;
  /** Reported this year, not last year, but had reported before. */
  returning: number;
  /** Never reported before this year. */
  new: number;
  /** Filed a report but recorded zero stops (from the report's "Zero Stops" list). */
  zero_stop_filers: number;
  /** consistent + returning + new + zero_stop_filers. */
  total_filed: number;
  total_stops: number;
};

/** Headline numbers behind the 2024 drop-out / 2025 return finding. */
export type ReportingChurn = {
  dropped_from_2023_to_2024: number;
  of_which_returned_in_2025: number;
  comeback_stops_2023: number;
  comeback_stops_2025: number;
  raw_pct_change_2024_to_2025: number;
  comeback_share_of_raw_increase_pct: number;
  balanced_panel_pct_change_2023_to_2025: number;
};

/**
 * Outcome-test scatter across more than one year, for the animated year toggle
 * on graphic 4. Each year's points share the 2025 bubble sizes (stop volume by
 * race barely moves across the window, so freezing size keeps the toggle
 * animation about the x/y shift — the actual story — rather than breathing
 * bubbles). Null when the bundle file is absent or carries < 2 usable years.
 */
export type OutcomeByYear = {
  years: number[]; // ascending, e.g. [2023, 2025]
  byYear: Record<number, RaceSummaryPoint[]>; // W/B/H per year
};

export type InitialImpressions2025 = {
  disparity: DisparityData;
  searchReasons: SearchReasonsData;
  raceSummary: { year: number; races: RaceSummaryPoint[]; total: RaceSummaryPoint | null };
  outcomeByYear: OutcomeByYear | null;
  agenciesReporting: AgencyReportingPoint[];
  reportingChurn: ReportingChurn | null;
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

/**
 * Years offered in the outcome-test toggle. Contraband-found counts are only
 * reported statewide from 2020 on, and the 2023 reporting-form change (plus Dec
 * 2022 cannabis legalization) makes pre-2023 contraband hit rates not
 * apples-to-apples with today — so we compare only across the clean window. See
 * the bundle's outcome_test_by_year `note` and project_outcome_toggle_spec.
 */
export const OUTCOME_TOGGLE_YEARS = [2023, 2025] as const;

const shapeOutcomeByYear = (
  raw: any,
  raceSummary: { races: RaceSummaryPoint[] },
): OutcomeByYear | null => {
  const byYearRaw = raw?.by_year;
  if (!byYearRaw) return null;
  // Bubble size rides on 2025 stop volume by race, held constant across years.
  const size = new Map(
    raceSummary.races.map((p) => [p.race, { total_stops: p.total_stops, stop_share_pct: p.stop_share_pct }]),
  );
  const years: number[] = [];
  const byYear: Record<number, RaceSummaryPoint[]> = {};
  for (const year of OUTCOME_TOGGLE_YEARS) {
    const block = byYearRaw[String(year)];
    if (!block || block.outcome_test_computable !== true) continue;
    const points = FOCUS_RACES.map((race): RaceSummaryPoint | null => {
      const c = block.by_race?.[race];
      if (!c || c.search_rate == null || c.contraband_hit_rate == null) return null;
      const s = size.get(race);
      return {
        race,
        search_rate: c.search_rate,
        contraband_hit_rate: c.contraband_hit_rate,
        total_stops: s?.total_stops ?? 0,
        stop_share_pct: s?.stop_share_pct ?? 0,
      };
    }).filter((p): p is RaceSummaryPoint => p != null);
    if (points.length) {
      years.push(year);
      byYear[year] = points;
    }
  }
  // A toggle needs at least two years; otherwise let the chart fall back to its
  // static single-year render.
  return years.length > 1 ? { years, byYear } : null;
};

const shapeAgenciesReporting = (raw: any): AgencyReportingPoint[] => {
  const byYear = raw?.by_year ?? {};
  return Object.keys(byYear)
    .map(Number)
    .sort((a, b) => a - b)
    .map((year) => {
      const c = byYear[year] ?? {};
      return {
        year,
        consistent: Number(c.consistent ?? 0),
        returning: Number(c.returning ?? 0),
        new: Number(c.new ?? 0),
        zero_stop_filers: Number(c.zero_stop_filers ?? 0),
        total_filed: Number(c.total_filed ?? 0),
        total_stops: Number(c.total_stops ?? 0),
      };
    });
};

const shapeReportingChurn = (raw: any): ReportingChurn | null => {
  const h = raw?.headline_2024;
  if (!h) return null;
  return {
    dropped_from_2023_to_2024: Number(h.dropped_from_2023_to_2024 ?? 0),
    of_which_returned_in_2025: Number(h.of_which_returned_in_2025 ?? 0),
    comeback_stops_2023: Number(h.comeback_stops_2023 ?? 0),
    comeback_stops_2025: Number(h.comeback_stops_2025 ?? 0),
    raw_pct_change_2024_to_2025: Number(h.raw_pct_change_2024_to_2025 ?? 0),
    comeback_share_of_raw_increase_pct: Number(h.comeback_share_of_raw_increase_pct ?? 0),
    balanced_panel_pct_change_2023_to_2025: Number(h.balanced_panel_pct_change_2023_to_2025 ?? 0),
  };
};

export const loadInitialImpressions2025 = async (
  fetchFn: FetchFn,
): Promise<InitialImpressions2025> => {
  const [disparityRaw, searchRaw, raceRaw, reportingRaw, outcomeRaw] = await Promise.all([
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_disparity_index.json`),
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_search_reasons_by_year.json`),
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_race_summary_2025.json`),
    // Optional: if this file hasn't been published yet, degrade gracefully
    // rather than 500-ing the whole article (the chart shows an empty state).
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_agencies_reporting.json`).catch(() => null),
    // Outcome-test year toggle (graphic 4). Statewide volume-weighted, computed
    // from the 'Missouri (all agencies)' aggregate — 2025 ties out to the AG's
    // official numbers. Optional: degrade to the 2025-only render if absent.
    fetchJson(fetchFn, `${II2025_BASE}/ii2025_outcome_test_by_year.json`).catch(() => null),
  ]);

  const raceSummary = shapeRaceSummary(raceRaw);
  return {
    disparity: shapeDisparity(disparityRaw),
    searchReasons: shapeSearchReasons(searchRaw),
    raceSummary,
    outcomeByYear: outcomeRaw ? shapeOutcomeByYear(outcomeRaw, raceSummary) : null,
    agenciesReporting: reportingRaw ? shapeAgenciesReporting(reportingRaw) : [],
    reportingChurn: reportingRaw ? shapeReportingChurn(reportingRaw) : null,
  };
};
