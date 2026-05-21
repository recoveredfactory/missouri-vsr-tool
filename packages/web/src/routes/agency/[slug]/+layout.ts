import { error } from "@sveltejs/kit";
import { withDataBase } from "$lib/dataBase";

// Module-scoped cache for CDN files that only change on deploy. On the server
// (SST Lambda) this persists for the life of the warm container; on the client
// it persists for the SPA session. Cached as Promise<json> so concurrent
// callers share the same in-flight fetch, and evicted on error.
const jsonCache = new Map<string, Promise<unknown>>();

function fetchJsonCached<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const existing = jsonCache.get(url);
  if (existing) return existing as Promise<T>;
  const promise = (async () => {
    const resp = await fetchImpl(url);
    if (!resp.ok) throw new Error(`fetch failed ${resp.status} ${url}`);
    return resp.json();
  })();
  jsonCache.set(url, promise);
  promise.catch(() => jsonCache.delete(url));
  return promise as Promise<T>;
}

export async function load({ fetch, params }) {
  const slug = params.slug;

  const [manifest, agencies] = await Promise.all([
    fetchJsonCached<any>(fetch, withDataBase("/data/dist/manifest.json")).catch(
      () => null,
    ),
    fetchJsonCached<any[]>(
      fetch,
      withDataBase("/data/dist/agency_index.json"),
    ).catch(() => []),
  ]);

  if (!manifest) {
    throw error(503, "Data unavailable — manifest could not be loaded");
  }

  const allYears: number[] = (manifest?.years as number[] ?? [])
    .slice()
    .sort((a, b) => b - a);
  const partialCoverageYears: number[] = manifest?.partial_coverage_years ?? [];

  if (!allYears.length) {
    throw error(503, "Data unavailable — no years in manifest");
  }

  const agencyIndexEntry = Array.isArray(agencies)
    ? agencies.find((entry: any) => entry?.agency_slug === slug)
    : null;

  if (!agencyIndexEntry) {
    throw error(404, `Agency not found: ${slug}`);
  }

  const indexYearsWithData = Array.isArray(agencyIndexEntry?.years_with_data)
    ? (agencyIndexEntry.years_with_data as number[])
        .map(Number)
        .filter((y) => Number.isFinite(y))
        .sort((a, b) => b - a)
    : null;
  const indexLatestYear = Number.isFinite(
    Number(agencyIndexEntry?.latest_year_with_data),
  )
    ? Number(agencyIndexEntry.latest_year_with_data)
    : null;

  const latestYear = indexLatestYear ?? indexYearsWithData?.[0] ?? allYears[0];

  const [latestYearData, baselines] = await Promise.all([
    fetch(withDataBase(`/data/dist/agency_year/${slug}/${latestYear}.json`))
      .then((r) => (r.ok ? r.json() : null)),
    fetchJsonCached<any[]>(
      fetch,
      withDataBase("/data/dist/statewide_slug_baselines.json"),
    ).catch(() => []),
  ]);

  if (!latestYearData) {
    throw error(404, `Agency year data not found: ${slug}/${latestYear}`);
  }

  const agencyYears: string[] | null = indexYearsWithData?.length
    ? indexYearsWithData.slice().sort((a, b) => a - b).map(String)
    : null;

  const program287g =
    agencyIndexEntry && typeof agencyIndexEntry === "object"
      ? (agencyIndexEntry as any).program_287g ?? null
      : null;

  return {
    slug,
    manifest,
    latestYearData,
    latestYear,
    years: allYears.map(String),
    agencyYears,
    partialCoverageYears,
    baselines,
    agencies,
    agencyCount: Array.isArray(agencies) ? agencies.length : 0,
    program287g,
    boundary: null,
  };
}
