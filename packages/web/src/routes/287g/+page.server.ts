import { withDataBase } from "$lib/dataBase";

type Agreement = {
  support_type?: string;
  signed_date?: string;
  moa_status?: string;
  moa_url?: string;
};

type Program287g = {
  snapshot_date?: string;
  snapshot_filename?: string;
  agreements?: Agreement[];
};

export type SeriesPoint = {
  year: number;
  value: number | null;
};

const RACE_COLUMNS = [
  "Total",
  "White",
  "Black",
  "Hispanic",
  "Native American",
  "Asian",
  "Other",
] as const;

export type RaceColumn = (typeof RACE_COLUMNS)[number];

export type RaceBreakdown = Partial<Record<RaceColumn, number | null>>;

export type RaceTriple = "White" | "Black" | "Hispanic";
export type RaceSeries = Record<RaceTriple, SeriesPoint[]>;

export type RaceQuad = "White" | "Black" | "Hispanic" | "Other";
export type RaceQuadSeries = Record<RaceQuad, SeriesPoint[]>;

const RACE_TRIPLE: readonly RaceTriple[] = ["White", "Black", "Hispanic"] as const;

export type SuppressionNote = {
  metric: "search-rate" | "arrest-rate";
  year: number;
};

export type Participant = {
  agency_slug: string;
  canonical_name: string;
  agency_type?: string;
  city?: string;
  county?: string;
  agreements: Agreement[];
  totalStopsSeries: SeriesPoint[];
  stopsCompositionSeries: RaceQuadSeries;
  searchRateByRaceSeries: RaceSeries;
  arrestRateByRaceSeries: RaceSeries;
  licenseStopRateByRaceSeries: RaceSeries;
  suppressedOutliers: SuppressionNote[];
  latestYear: number | null;
  latestTotalStops: number | null;
  latestHispanicStops: number | null;
  latestStopsByRace: RaceBreakdown;
  latestSearchRateByRace: RaceBreakdown;
  latestArrestRateByRace: RaceBreakdown;
  latestResidentStopsByRace: RaceBreakdown;
  latestNonResidentStopsByRace: RaceBreakdown;
};

/**
 * Per-race rates above this many per 100 stops are treated as data-entry
 * outliers (e.g. St. Charles arrest rate ~95 in one year for a single race).
 * Applied to arrest-rate and search-rate; license-stop-rate can legitimately
 * be high so it is not capped.
 */
const RACE_RATE_OUTLIER_THRESHOLD = 50;

const sanitizeRateSeries = (
  rs: RaceSeries,
  metric: SuppressionNote["metric"],
): { series: RaceSeries; notes: SuppressionNote[] } => {
  const suppressedYears = new Set<number>();
  const out: RaceSeries = { White: [], Black: [], Hispanic: [] };
  for (const race of RACE_TRIPLE) {
    for (const p of rs[race]) {
      if (
        typeof p.value === "number" &&
        Number.isFinite(p.value) &&
        p.value > RACE_RATE_OUTLIER_THRESHOLD
      ) {
        suppressedYears.add(p.year);
        out[race].push({ year: p.year, value: null });
      } else {
        out[race].push({ year: p.year, value: p.value });
      }
    }
  }
  const notes: SuppressionNote[] = Array.from(suppressedYears)
    .sort((a, b) => a - b)
    .map((year) => ({ metric, year }));
  return { series: out, notes };
};

type SubsetIndex = {
  agencies: string[];
  years: Array<number | string>;
  columns: string[];
};

type SubsetMetricFile = {
  rows?: Array<Array<number | null>>;
};

const fetchJson = async <T>(fetch: typeof window.fetch, url: string): Promise<T | null> => {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
};

const normalizeName = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const numberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export async function load({ fetch }) {
  const subsetUrl = (key: string) =>
    withDataBase(`/data/dist/metric_year_subset/${key}.json`);

  const [
    agencyEntries,
    subsetIndex,
    stopsFile,
    arrestRateFile,
    searchRateFile,
    residentStopsFile,
    nonResidentStopsFile,
    licenseStopRateFile,
  ] = await Promise.all([
    fetchJson<Array<Record<string, any>>>(fetch, withDataBase("/data/dist/agency_index.json")),
    fetchJson<SubsetIndex>(fetch, withDataBase("/data/dist/metric_year_subset/_index.json")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("stops")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("arrest-rate")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("search-rate")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("resident-stops")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("non-resident-stops")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("license-stop-rate")),
  ]);

  const emptyReturn = {
    participants: [] as Participant[],
    snapshotDate: "",
    years: [] as number[],
    totalStopsLatestSum: 0,
    totalHispanicStopsLatestSum: 0,
    statewideTotalStopsLatest: 0,
    latestYearAnchor: null as number | null,
    supportTypeCounts: [] as Array<{ type: string; count: number }>,
    statewideSearchRateSeries: [] as SeriesPoint[],
    statewideArrestRateSeries: [] as SeriesPoint[],
    statewideLicenseStopRateSeries: [] as SeriesPoint[],
  };

  if (!agencyEntries) return emptyReturn;

  const years: number[] = Array.isArray(subsetIndex?.years)
    ? subsetIndex!.years.map((y) => Number(y)).filter((y) => Number.isFinite(y))
    : [];
  const yearCount = years.length;

  const subsetAgencyIdxByName = new Map<string, number>();
  if (subsetIndex?.agencies) {
    subsetIndex.agencies.forEach((name, idx) => {
      subsetAgencyIdxByName.set(normalizeName(name), idx);
    });
  }

  const colIdx = (col: string) =>
    subsetIndex?.columns ? subsetIndex.columns.indexOf(col) : -1;
  const totalIdx = colIdx("Total");
  const raceColIdx: Record<RaceColumn, number> = {
    Total: colIdx("Total"),
    White: colIdx("White"),
    Black: colIdx("Black"),
    Hispanic: colIdx("Hispanic"),
    "Native American": colIdx("Native American"),
    Asian: colIdx("Asian"),
    Other: colIdx("Other"),
  };

  const indexMetric = (
    file: SubsetMetricFile | null,
  ): Map<number, Array<RaceBreakdown | null>> => {
    const map = new Map<number, Array<RaceBreakdown | null>>();
    if (!file?.rows) return map;
    for (const row of file.rows) {
      if (!Array.isArray(row)) continue;
      const aIdx = Number(row[0]);
      const yIdx = Number(row[1]);
      if (!Number.isFinite(aIdx) || !Number.isFinite(yIdx)) continue;
      if (!map.has(aIdx)) {
        map.set(aIdx, Array.from({ length: yearCount }, () => null));
      }
      const breakdown: RaceBreakdown = {};
      for (const col of RACE_COLUMNS) {
        const idx = raceColIdx[col];
        if (idx >= 0) breakdown[col] = numberOrNull(row[idx]);
      }
      map.get(aIdx)![yIdx] = breakdown;
    }
    return map;
  };

  const stopsBy = indexMetric(stopsFile);
  const arrestRateBy = indexMetric(arrestRateFile);
  const searchRateBy = indexMetric(searchRateFile);
  const residentStopsBy = indexMetric(residentStopsFile);
  const nonResidentStopsBy = indexMetric(nonResidentStopsFile);
  const licenseStopRateBy = indexMetric(licenseStopRateFile);

  // Statewide weighted-by-stops rate series (Total column).
  const statewideRateSeries = (
    rateBy: Map<number, Array<RaceBreakdown | null>>,
  ): SeriesPoint[] =>
    years.map((year, yIdx) => {
      let weightSum = 0;
      let weighted = 0;
      for (const [aIdx, stopsRows] of stopsBy.entries()) {
        const stopSlot = stopsRows[yIdx];
        const rateSlot = rateBy.get(aIdx)?.[yIdx];
        if (!stopSlot || !rateSlot) continue;
        const stops = stopSlot.Total;
        const rate = rateSlot.Total;
        if (typeof stops === "number" && stops > 0 && typeof rate === "number") {
          weightSum += stops;
          weighted += stops * rate;
        }
      }
      return { year, value: weightSum > 0 ? weighted / weightSum : null };
    });

  /**
   * SSR HTML payload trimming: the page only ever renders a 10-year window
   * (`SPARKLINE_YEAR_WINDOW`). Slicing to the last 12 years before returning
   * keeps the response payload below Lambda's 6 MB cap.
   */
  const SERIES_TAIL_YEARS = 12;
  const tailWindow = <T,>(series: T[]): T[] =>
    series.length > SERIES_TAIL_YEARS ? series.slice(-SERIES_TAIL_YEARS) : series;
  const tailRaceSeries = (rs: RaceSeries): RaceSeries => ({
    White: tailWindow(rs.White),
    Black: tailWindow(rs.Black),
    Hispanic: tailWindow(rs.Hispanic),
  });
  const tailQuadSeries = (rs: RaceQuadSeries): RaceQuadSeries => ({
    White: tailWindow(rs.White),
    Black: tailWindow(rs.Black),
    Hispanic: tailWindow(rs.Hispanic),
    Other: tailWindow(rs.Other),
  });

  const statewideSearchRateSeries = tailWindow(statewideRateSeries(searchRateBy));
  const statewideArrestRateSeries = tailWindow(statewideRateSeries(arrestRateBy));
  const statewideLicenseStopRateSeries = tailWindow(statewideRateSeries(licenseStopRateBy));

  const buildRaceSeries = (
    rows: Array<RaceBreakdown | null> | null,
  ): RaceSeries => {
    const out: RaceSeries = { White: [], Black: [], Hispanic: [] };
    for (let i = 0; i < years.length; i += 1) {
      const slot = rows?.[i] ?? null;
      for (const race of RACE_TRIPLE) {
        const v = slot ? slot[race] : null;
        out[race].push({
          year: years[i],
          value: typeof v === "number" && Number.isFinite(v) ? v : null,
        });
      }
    }
    return out;
  };

  // Anchor year: latest year that any 287(g) participant has stops data for.
  const participatingSubsetIdxs = new Set<number>();
  for (const entry of agencyEntries) {
    const program: Program287g | undefined = entry?.program_287g;
    if (program && Array.isArray(program.agreements) && program.agreements.length) {
      const subsetIdx = subsetAgencyIdxByName.get(
        normalizeName(String(entry.canonical_name ?? entry.agency_slug ?? "")),
      );
      if (subsetIdx !== undefined) participatingSubsetIdxs.add(subsetIdx);
    }
  }

  let anchorYearIdx = -1;
  for (let i = years.length - 1; i >= 0 && anchorYearIdx === -1; i -= 1) {
    for (const sIdx of participatingSubsetIdxs) {
      const slot = stopsBy.get(sIdx)?.[i];
      if (slot && typeof slot.Total === "number") {
        anchorYearIdx = i;
        break;
      }
    }
  }
  const latestYearAnchor = anchorYearIdx >= 0 ? years[anchorYearIdx] : null;

  let statewideTotalStopsLatest = 0;
  if (anchorYearIdx >= 0 && stopsFile?.rows) {
    for (const row of stopsFile.rows) {
      if (!Array.isArray(row)) continue;
      if (Number(row[1]) !== anchorYearIdx) continue;
      const v = totalIdx >= 0 ? row[totalIdx] : null;
      if (typeof v === "number" && Number.isFinite(v)) statewideTotalStopsLatest += v;
    }
  }

  const participants: Participant[] = [];
  let snapshotDate = "";

  for (const entry of agencyEntries) {
    const program: Program287g | undefined = entry?.program_287g;
    const agreements = Array.isArray(program?.agreements) ? program!.agreements : [];
    if (!program || !agreements.length) continue;

    if (program.snapshot_date && program.snapshot_date > snapshotDate) {
      snapshotDate = program.snapshot_date;
    }

    const canonicalName = String(entry.canonical_name ?? entry.agency_slug ?? "");
    const subsetIdx = subsetAgencyIdxByName.get(normalizeName(canonicalName));

    const stopsRows = subsetIdx !== undefined ? stopsBy.get(subsetIdx) ?? null : null;
    const arrestRows = subsetIdx !== undefined ? arrestRateBy.get(subsetIdx) ?? null : null;
    const searchRows = subsetIdx !== undefined ? searchRateBy.get(subsetIdx) ?? null : null;
    const residentRows = subsetIdx !== undefined ? residentStopsBy.get(subsetIdx) ?? null : null;
    const nonResidentRows = subsetIdx !== undefined ? nonResidentStopsBy.get(subsetIdx) ?? null : null;
    const licenseStopRateRows =
      subsetIdx !== undefined ? licenseStopRateBy.get(subsetIdx) ?? null : null;

    const totalStopsSeries: SeriesPoint[] = years.map((year, i) => ({
      year,
      value: stopsRows?.[i]?.Total ?? null,
    }));

    const stopsCompositionSeries: RaceQuadSeries = {
      White: [],
      Black: [],
      Hispanic: [],
      Other: [],
    };
    for (let i = 0; i < years.length; i += 1) {
      const slot = stopsRows?.[i];
      const total = slot?.Total ?? null;
      const w = slot?.White ?? null;
      const b = slot?.Black ?? null;
      const hsp = slot?.Hispanic ?? null;
      const valid =
        typeof total === "number" &&
        total > 0 &&
        typeof w === "number" &&
        typeof b === "number" &&
        typeof hsp === "number";
      const yr = years[i];
      if (!valid) {
        stopsCompositionSeries.White.push({ year: yr, value: null });
        stopsCompositionSeries.Black.push({ year: yr, value: null });
        stopsCompositionSeries.Hispanic.push({ year: yr, value: null });
        stopsCompositionSeries.Other.push({ year: yr, value: null });
        continue;
      }
      const other = Math.max(0, (total as number) - (w as number) - (b as number) - (hsp as number));
      stopsCompositionSeries.White.push({ year: yr, value: w as number });
      stopsCompositionSeries.Black.push({ year: yr, value: b as number });
      stopsCompositionSeries.Hispanic.push({ year: yr, value: hsp as number });
      stopsCompositionSeries.Other.push({ year: yr, value: other });
    }

    const rawSearchRate = buildRaceSeries(searchRows);
    const rawArrestRate = buildRaceSeries(arrestRows);
    const licenseStopRateByRaceSeries = buildRaceSeries(licenseStopRateRows);

    const searchSan = sanitizeRateSeries(rawSearchRate, "search-rate");
    const arrestSan = sanitizeRateSeries(rawArrestRate, "arrest-rate");
    const searchRateByRaceSeries = searchSan.series;
    const arrestRateByRaceSeries = arrestSan.series;
    const suppressedOutliers: SuppressionNote[] = [
      ...searchSan.notes,
      ...arrestSan.notes,
    ].sort((a, b) => a.year - b.year || a.metric.localeCompare(b.metric));

    let latestIdx = -1;
    for (let i = years.length - 1; i >= 0; i -= 1) {
      const slot = stopsRows?.[i];
      if (slot && typeof slot.Total === "number") {
        latestIdx = i;
        break;
      }
    }
    const latestYear = latestIdx >= 0 ? years[latestIdx] : null;

    const stopsBreakdown: RaceBreakdown = (latestIdx >= 0 && stopsRows?.[latestIdx]) || {};
    const searchBreakdown: RaceBreakdown = (latestIdx >= 0 && searchRows?.[latestIdx]) || {};
    const arrestBreakdown: RaceBreakdown = (latestIdx >= 0 && arrestRows?.[latestIdx]) || {};
    const residentBreakdown: RaceBreakdown = (latestIdx >= 0 && residentRows?.[latestIdx]) || {};
    const nonResidentBreakdown: RaceBreakdown = (latestIdx >= 0 && nonResidentRows?.[latestIdx]) || {};

    const latestTotalStops =
      typeof stopsBreakdown.Total === "number" ? stopsBreakdown.Total : null;
    const latestHispanicStops =
      typeof stopsBreakdown.Hispanic === "number" ? stopsBreakdown.Hispanic : null;

    participants.push({
      agency_slug: String(entry.agency_slug ?? ""),
      canonical_name: canonicalName,
      agency_type: entry.agency_type ?? "",
      city: entry.city ?? "",
      county: entry.county ?? "",
      agreements,
      totalStopsSeries: tailWindow(totalStopsSeries),
      stopsCompositionSeries: tailQuadSeries(stopsCompositionSeries),
      searchRateByRaceSeries: tailRaceSeries(searchRateByRaceSeries),
      arrestRateByRaceSeries: tailRaceSeries(arrestRateByRaceSeries),
      licenseStopRateByRaceSeries: tailRaceSeries(licenseStopRateByRaceSeries),
      suppressedOutliers,
      latestYear,
      latestTotalStops,
      latestHispanicStops,
      latestStopsByRace: stopsBreakdown,
      latestSearchRateByRace: searchBreakdown,
      latestArrestRateByRace: arrestBreakdown,
      latestResidentStopsByRace: residentBreakdown,
      latestNonResidentStopsByRace: nonResidentBreakdown,
    });
  }

  participants.sort((a, b) => {
    const aHas = typeof a.latestHispanicStops === "number" && Number.isFinite(a.latestHispanicStops);
    const bHas = typeof b.latestHispanicStops === "number" && Number.isFinite(b.latestHispanicStops);
    if (aHas && bHas && a.latestHispanicStops !== b.latestHispanicStops) {
      return (b.latestHispanicStops as number) - (a.latestHispanicStops as number);
    }
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.canonical_name.localeCompare(b.canonical_name, undefined, { sensitivity: "base" });
  });

  let totalStopsLatestSum = 0;
  let totalHispanicStopsLatestSum = 0;
  for (const p of participants) {
    if (typeof p.latestTotalStops === "number") totalStopsLatestSum += p.latestTotalStops;
    if (typeof p.latestHispanicStops === "number")
      totalHispanicStopsLatestSum += p.latestHispanicStops;
  }

  const supportTypeCountMap = new Map<string, number>();
  for (const p of participants) {
    for (const a of p.agreements) {
      const t = (a.support_type || "").trim();
      if (!t) continue;
      supportTypeCountMap.set(t, (supportTypeCountMap.get(t) ?? 0) + 1);
    }
  }
  const supportTypeCounts = Array.from(supportTypeCountMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    participants,
    snapshotDate,
    years,
    totalStopsLatestSum,
    totalHispanicStopsLatestSum,
    statewideTotalStopsLatest,
    latestYearAnchor,
    supportTypeCounts,
    statewideSearchRateSeries,
    statewideArrestRateSeries,
    statewideLicenseStopRateSeries,
  };
}
