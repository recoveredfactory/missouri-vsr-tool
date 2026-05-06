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

export type Participant = {
  agency_slug: string;
  canonical_name: string;
  agency_type?: string;
  city?: string;
  county?: string;
  agreements: Agreement[];
  totalStopsSeries: SeriesPoint[];
  hispanicShareSeries: SeriesPoint[];
  hispanicArrestRateSeries: SeriesPoint[];
  latestYear: number | null;
  latestTotalStops: number | null;
  latestHispanicStops: number | null;
  latestHispanicShare: number | null;
  latestHispanicArrestRate: number | null;
  latestStopsByRace: RaceBreakdown;
  latestSearchRateByRace: RaceBreakdown;
  latestArrestRateByRace: RaceBreakdown;
  latestResidentStopsByRace: RaceBreakdown;
  latestNonResidentStopsByRace: RaceBreakdown;
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
  ] = await Promise.all([
    fetchJson<Array<Record<string, any>>>(fetch, withDataBase("/data/dist/agency_index.json")),
    fetchJson<SubsetIndex>(fetch, withDataBase("/data/dist/metric_year_subset/_index.json")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("stops")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("arrest-rate")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("search-rate")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("resident-stops")),
    fetchJson<SubsetMetricFile>(fetch, subsetUrl("non-resident-stops")),
  ]);

  const emptyReturn = {
    participants: [] as Participant[],
    snapshotDate: "",
    years: [] as number[],
    totalStopsLatestSum: 0,
    totalHispanicStopsLatestSum: 0,
    statewideTotalStopsLatest: 0,
    latestYearAnchor: null as number | null,
    statewideHispanicShareSeries: [] as SeriesPoint[],
    statewideHispanicArrestRateSeries: [] as SeriesPoint[],
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

  // Statewide Hispanic share: sum(Hispanic stops) / sum(Total stops) per year.
  // Statewide Hispanic arrest rate: weighted by Hispanic stops.
  const statewideHispanicShareSeries: SeriesPoint[] = years.map((year, yIdx) => {
    let totalSum = 0;
    let hispSum = 0;
    for (const breakdowns of stopsBy.values()) {
      const slot = breakdowns[yIdx];
      if (!slot) continue;
      const t = slot.Total;
      const h = slot.Hispanic;
      if (typeof t === "number" && typeof h === "number") {
        totalSum += t;
        hispSum += h;
      }
    }
    return { year, value: totalSum > 0 ? (hispSum / totalSum) * 100 : null };
  });

  const statewideHispanicArrestRateSeries: SeriesPoint[] = years.map((year, yIdx) => {
    let weightSum = 0;
    let weightedRateSum = 0;
    for (const [aIdx, stopsRows] of stopsBy.entries()) {
      const stopSlot = stopsRows[yIdx];
      const rateSlot = arrestRateBy.get(aIdx)?.[yIdx];
      if (!stopSlot || !rateSlot) continue;
      const stops = stopSlot.Hispanic;
      const rate = rateSlot.Hispanic;
      if (
        typeof stops === "number" &&
        stops > 0 &&
        typeof rate === "number"
      ) {
        weightSum += stops;
        weightedRateSum += stops * rate;
      }
    }
    return { year, value: weightSum > 0 ? weightedRateSum / weightSum : null };
  });

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

    const totalStopsSeries: SeriesPoint[] = years.map((year, i) => ({
      year,
      value: stopsRows?.[i]?.Total ?? null,
    }));

    const hispanicShareSeries: SeriesPoint[] = years.map((year, i) => {
      const slot = stopsRows?.[i];
      const total = slot?.Total ?? null;
      const hispanic = slot?.Hispanic ?? null;
      if (typeof total !== "number" || !total || typeof hispanic !== "number") {
        return { year, value: null };
      }
      return { year, value: (hispanic / total) * 100 };
    });

    const hispanicArrestRateSeries: SeriesPoint[] = years.map((year, i) => ({
      year,
      value: arrestRows?.[i]?.Hispanic ?? null,
    }));

    let latestIdx = -1;
    for (let i = years.length - 1; i >= 0; i -= 1) {
      if (
        totalStopsSeries[i].value !== null ||
        hispanicShareSeries[i].value !== null ||
        hispanicArrestRateSeries[i].value !== null
      ) {
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

    const latestTotalStops = latestIdx >= 0 ? totalStopsSeries[latestIdx].value : null;
    const latestHispanicShare =
      latestIdx >= 0 ? hispanicShareSeries[latestIdx].value : null;
    const latestHispanicArrestRate =
      latestIdx >= 0 ? hispanicArrestRateSeries[latestIdx].value : null;
    const latestHispanicStops =
      typeof latestTotalStops === "number" &&
      typeof latestHispanicShare === "number"
        ? (latestTotalStops * latestHispanicShare) / 100
        : null;

    participants.push({
      agency_slug: String(entry.agency_slug ?? ""),
      canonical_name: canonicalName,
      agency_type: entry.agency_type ?? "",
      city: entry.city ?? "",
      county: entry.county ?? "",
      agreements,
      totalStopsSeries,
      hispanicShareSeries,
      hispanicArrestRateSeries,
      latestYear,
      latestTotalStops,
      latestHispanicStops,
      latestHispanicShare,
      latestHispanicArrestRate,
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

  return {
    participants,
    snapshotDate,
    years,
    totalStopsLatestSum,
    totalHispanicStopsLatestSum,
    statewideTotalStopsLatest,
    latestYearAnchor,
    statewideHispanicShareSeries,
    statewideHispanicArrestRateSeries,
  };
}
