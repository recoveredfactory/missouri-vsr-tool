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

export type Participant = {
  agency_slug: string;
  canonical_name: string;
  agency_type?: string;
  city?: string;
  county?: string;
  agreements: Agreement[];
  totalStopsSeries: SeriesPoint[];
  hispanicShareSeries: SeriesPoint[];
  arrestRateSeries: SeriesPoint[];
  latestYear: number | null;
  latestTotalStops: number | null;
  latestHispanicShare: number | null;
  latestArrestRate: number | null;
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

export async function load({ fetch }) {
  const [agencyEntries, subsetIndex, stopsFile, arrestRateFile] = await Promise.all([
    fetchJson<Array<Record<string, any>>>(fetch, withDataBase("/data/dist/agency_index.json")),
    fetchJson<SubsetIndex>(fetch, withDataBase("/data/dist/metric_year_subset/_index.json")),
    fetchJson<SubsetMetricFile>(fetch, withDataBase("/data/dist/metric_year_subset/stops.json")),
    fetchJson<SubsetMetricFile>(fetch, withDataBase("/data/dist/metric_year_subset/arrest-rate.json")),
  ]);

  if (!agencyEntries) {
    return { participants: [] as Participant[], snapshotDate: "", years: [] as number[] };
  }

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
  const hispanicIdx = colIdx("Hispanic");

  const stopsByAgencyYear = new Map<
    number,
    Array<{ total: number | null; hispanic: number | null }>
  >();
  if (stopsFile?.rows) {
    for (const row of stopsFile.rows) {
      if (!Array.isArray(row)) continue;
      const aIdx = Number(row[0]);
      const yIdx = Number(row[1]);
      if (!Number.isFinite(aIdx) || !Number.isFinite(yIdx)) continue;
      if (!stopsByAgencyYear.has(aIdx)) {
        stopsByAgencyYear.set(
          aIdx,
          Array.from({ length: yearCount }, () => ({ total: null, hispanic: null })),
        );
      }
      const slot = stopsByAgencyYear.get(aIdx)![yIdx];
      if (slot) {
        const total = totalIdx >= 0 ? row[totalIdx] : null;
        const hispanic = hispanicIdx >= 0 ? row[hispanicIdx] : null;
        slot.total = typeof total === "number" ? total : null;
        slot.hispanic = typeof hispanic === "number" ? hispanic : null;
      }
    }
  }

  const arrestRateByAgencyYear = new Map<number, Array<number | null>>();
  if (arrestRateFile?.rows) {
    for (const row of arrestRateFile.rows) {
      if (!Array.isArray(row)) continue;
      const aIdx = Number(row[0]);
      const yIdx = Number(row[1]);
      if (!Number.isFinite(aIdx) || !Number.isFinite(yIdx)) continue;
      if (!arrestRateByAgencyYear.has(aIdx)) {
        arrestRateByAgencyYear.set(
          aIdx,
          Array.from({ length: yearCount }, () => null as number | null),
        );
      }
      const v = hispanicIdx >= 0 ? row[hispanicIdx] : null;
      arrestRateByAgencyYear.get(aIdx)![yIdx] = typeof v === "number" ? v : null;
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

    const stopsRows = subsetIdx !== undefined ? stopsByAgencyYear.get(subsetIdx) ?? null : null;
    const arrestRows =
      subsetIdx !== undefined ? arrestRateByAgencyYear.get(subsetIdx) ?? null : null;

    const totalStopsSeries: SeriesPoint[] = years.map((year, i) => ({
      year,
      value: stopsRows?.[i]?.total ?? null,
    }));

    const hispanicShareSeries: SeriesPoint[] = years.map((year, i) => {
      const slot = stopsRows?.[i];
      if (!slot || slot.total === null || !slot.total || slot.hispanic === null) {
        return { year, value: null };
      }
      return { year, value: (slot.hispanic / slot.total) * 100 };
    });

    const arrestRateSeries: SeriesPoint[] = years.map((year, i) => ({
      year,
      value: arrestRows?.[i] ?? null,
    }));

    let latestIdx = -1;
    for (let i = years.length - 1; i >= 0; i -= 1) {
      if (
        totalStopsSeries[i].value !== null ||
        hispanicShareSeries[i].value !== null ||
        arrestRateSeries[i].value !== null
      ) {
        latestIdx = i;
        break;
      }
    }
    const latestYear = latestIdx >= 0 ? years[latestIdx] : null;

    participants.push({
      agency_slug: String(entry.agency_slug ?? ""),
      canonical_name: canonicalName,
      agency_type: entry.agency_type ?? "",
      city: entry.city ?? "",
      county: entry.county ?? "",
      agreements,
      totalStopsSeries,
      hispanicShareSeries,
      arrestRateSeries,
      latestYear,
      latestTotalStops: latestIdx >= 0 ? totalStopsSeries[latestIdx].value : null,
      latestHispanicShare: latestIdx >= 0 ? hispanicShareSeries[latestIdx].value : null,
      latestArrestRate: latestIdx >= 0 ? arrestRateSeries[latestIdx].value : null,
    });
  }

  participants.sort((a, b) => {
    const aStops = a.latestTotalStops;
    const bStops = b.latestTotalStops;
    const aHas = typeof aStops === "number" && Number.isFinite(aStops);
    const bHas = typeof bStops === "number" && Number.isFinite(bStops);
    if (aHas && bHas && aStops !== bStops) return (bStops as number) - (aStops as number);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.canonical_name.localeCompare(b.canonical_name, undefined, { sensitivity: "base" });
  });

  let totalStopsLatestSum = 0;
  let totalHispanicStopsLatestSum = 0;
  for (const p of participants) {
    if (p.latestYear === null) continue;
    const idx = years.indexOf(p.latestYear);
    if (idx < 0) continue;
    const stops = p.totalStopsSeries[idx]?.value;
    if (typeof stops === "number" && Number.isFinite(stops)) totalStopsLatestSum += stops;
    const hispanicShare = p.hispanicShareSeries[idx]?.value;
    if (
      typeof stops === "number" &&
      Number.isFinite(stops) &&
      typeof hispanicShare === "number" &&
      Number.isFinite(hispanicShare)
    ) {
      totalHispanicStopsLatestSum += (stops * hispanicShare) / 100;
    }
  }

  return {
    participants,
    snapshotDate,
    years,
    totalStopsLatestSum,
    totalHispanicStopsLatestSum,
  };
}
