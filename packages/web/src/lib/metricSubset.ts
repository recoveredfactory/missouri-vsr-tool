import { withDataBase } from "$lib/dataBase";

export type MetricSubsetRow = Array<number | null>;

export type MetricYearSubset = {
  agencies: string[];
  years: Array<number | string>;
  columns: string[];
  rows: Record<string, MetricSubsetRow[]>;
};

export type MetricSubsetIndex = {
  agencies: string[];
  years: Array<number | string>;
  columns: string[];
  row_keys: string[];
};

// Module-level caches — survive component remount / locale switch so we
// never re-fetch the same JSON within a session.
let indexPromise: Promise<MetricSubsetIndex> | null = null;
const metricPromises = new Map<string, Promise<MetricSubsetRow[]>>();
const yearPromises = new Map<string, Promise<MetricYearSubset>>();
let monolithPromise: Promise<MetricYearSubset> | null = null;

// When the pipeline hasn't shipped split files yet, we transparently fall back
// to the old monolithic metric_year_subset.json. This flag flips after the
// first per-metric 404 so we stop trying split URLs for the session.
let splitFilesUnavailable = false;
let byYearUnavailable = false;

const INDEX_URL = withDataBase("/data/dist/metric_year_subset/_index.json");
const METRIC_URL = (rowKey: string) =>
  withDataBase(`/data/dist/metric_year_subset/${encodeURIComponent(rowKey)}.json`);
const BY_YEAR_URL = (year: string | number) =>
  withDataBase(`/data/dist/metric_year_subset/by_year/${encodeURIComponent(String(year))}.json`);
const MONOLITH_URL = withDataBase("/data/dist/metric_year_subset.json");

const fetchMonolith = (): Promise<MetricYearSubset> => {
  if (monolithPromise) return monolithPromise;
  monolithPromise = fetch(MONOLITH_URL)
    .then(async (r) => {
      if (!r.ok) throw new Error(`metric subset ${r.status}`);
      return (await r.json()) as MetricYearSubset;
    })
    .catch((err) => {
      monolithPromise = null;
      throw err;
    });
  return monolithPromise;
};

export const fetchSubsetIndex = (): Promise<MetricSubsetIndex> => {
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    if (!splitFilesUnavailable) {
      try {
        const r = await fetch(INDEX_URL);
        if (r.ok) return (await r.json()) as MetricSubsetIndex;
        if (r.status === 404) splitFilesUnavailable = true;
      } catch {
        // network errors fall through to monolith
      }
    }
    const monolith = await fetchMonolith();
    return {
      agencies: monolith.agencies,
      years: monolith.years,
      columns: monolith.columns,
      row_keys: Object.keys(monolith.rows ?? {}),
    };
  })().catch((err) => {
    indexPromise = null;
    throw err;
  });

  return indexPromise;
};

export const fetchMetricRows = (rowKey: string): Promise<MetricSubsetRow[]> => {
  const cached = metricPromises.get(rowKey);
  if (cached) return cached;

  const promise = (async () => {
    if (!splitFilesUnavailable) {
      try {
        const r = await fetch(METRIC_URL(rowKey));
        if (r.ok) {
          const body = (await r.json()) as { rows?: MetricSubsetRow[] };
          return Array.isArray(body?.rows) ? body.rows : [];
        }
        if (r.status === 404) splitFilesUnavailable = true;
      } catch {
        // fall through
      }
    }
    const monolith = await fetchMonolith();
    return monolith.rows?.[rowKey] ?? [];
  })().catch((err) => {
    metricPromises.delete(rowKey);
    throw err;
  });

  metricPromises.set(rowKey, promise);
  return promise;
};

// Fetch the combined per-year slice used by scatter charts. Returns data in
// the same `MetricYearSubset` shape the existing consumers expect, but with
// only this one year present. Each by_year file is ~500KB uncompressed
// (~80KB gzipped) and contains all metrics for that year, which replaces
// 9 separate per-metric fetches for the scatter section.
//
// Falls back to per-metric + filter if by_year/{year}.json is missing.
export const fetchYearSubset = (
  year: string | number,
  fallbackRowKeys: string[] = []
): Promise<MetricYearSubset> => {
  const key = String(year);
  const cached = yearPromises.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<MetricYearSubset> => {
    if (!byYearUnavailable) {
      try {
        const r = await fetch(BY_YEAR_URL(year));
        if (r.ok) {
          const body = (await r.json()) as {
            year: number | string;
            agencies: string[];
            columns: string[];
            rows: Record<string, MetricSubsetRow[]>;
          };
          // by_year rows are [agency_idx, Total, ...]; widen to the shared
          // [agency_idx, year_idx, Total, ...] shape by injecting year_idx=0.
          const widenedColumns = [body.columns[0], "year_idx", ...body.columns.slice(1)];
          const widenedRows: Record<string, MetricSubsetRow[]> = {};
          for (const [rk, rows] of Object.entries(body.rows ?? {})) {
            widenedRows[rk] = rows.map((row) => [row[0], 0, ...row.slice(1)]);
          }
          return {
            agencies: body.agencies,
            years: [body.year],
            columns: widenedColumns,
            rows: widenedRows,
          };
        }
        if (r.status === 404) byYearUnavailable = true;
      } catch {
        // fall through to per-metric fallback
      }
    }

    // Fallback: assemble from per-metric files and filter to this year.
    const full = await fetchSubsetFor(fallbackRowKeys);
    const yearIdx = full.years.findIndex((y) => String(y) === key);
    if (yearIdx === -1) {
      return { agencies: full.agencies, years: [year], columns: full.columns, rows: {} };
    }
    const filteredRows: Record<string, MetricSubsetRow[]> = {};
    for (const [rk, rows] of Object.entries(full.rows)) {
      filteredRows[rk] = rows.filter((row) => Number(row[1]) === yearIdx)
        .map((row) => [row[0], 0, ...row.slice(2)]);
    }
    return {
      agencies: full.agencies,
      years: [year],
      columns: full.columns,
      rows: filteredRows,
    };
  })().catch((err) => {
    yearPromises.delete(key);
    throw err;
  });

  yearPromises.set(key, promise);
  return promise;
};

// Convenience: return an object shaped like MetricYearSubset but containing
// only the rows for the given row_keys. Lets existing consumers keep using the
// `payload.rows[key]` access pattern without restructuring.
export const fetchSubsetFor = async (
  rowKeys: string[]
): Promise<MetricYearSubset> => {
  const [index, ...rowLists] = await Promise.all([
    fetchSubsetIndex(),
    ...rowKeys.map(fetchMetricRows),
  ]);
  const rows: Record<string, MetricSubsetRow[]> = {};
  rowKeys.forEach((key, i) => {
    rows[key] = rowLists[i];
  });
  return {
    agencies: index.agencies,
    years: index.years,
    columns: index.columns,
    rows,
  };
};
