import { error } from "@sveltejs/kit";
import { withDataBase } from "$lib/dataBase";

export async function load({ fetch, params }) {
  const slug = params.slug;

  const [manifestResponse, indexResponse] = await Promise.all([
    fetch(withDataBase("/data/dist/manifest.json")),
    fetch(withDataBase("/data/dist/agency_index.json")),
  ]);
  if (!manifestResponse.ok) {
    throw error(503, "Data unavailable — manifest could not be loaded");
  }
  const manifest = await manifestResponse.json();

  const allYears: number[] = (manifest?.years as number[] ?? []).slice().sort((a, b) => b - a);
  const partialCoverageYears: number[] = manifest?.partial_coverage_years ?? [];

  if (!allYears.length) {
    throw error(503, "Data unavailable — no years in manifest");
  }

  const agencies = indexResponse.ok ? await indexResponse.json() : [];
  const agencyIndexEntry = Array.isArray(agencies)
    ? agencies.find((entry: any) => entry?.agency_slug === slug)
    : null;

  // If the pipeline has emitted per-agency year coverage, use it directly and
  // skip the probing loop. Otherwise fall back to trying the 5 most recent years.
  const indexYearsWithData = Array.isArray(agencyIndexEntry?.years_with_data)
    ? (agencyIndexEntry.years_with_data as number[])
        .map(Number)
        .filter((y) => Number.isFinite(y))
        .sort((a, b) => b - a)
    : null;
  const indexLatestYear = Number.isFinite(Number(agencyIndexEntry?.latest_year_with_data))
    ? Number(agencyIndexEntry.latest_year_with_data)
    : null;

  // CloudFront emits CORS-less 403s for missing S3 keys during client-side nav,
  // which surfaces as `fetch` throwing — hence the try/catch inside the loop.
  let agencyResponse: Response | null = null;
  let latestYear = allYears[0];
  const probeOrder =
    indexLatestYear !== null
      ? [indexLatestYear]
      : indexYearsWithData?.length
        ? indexYearsWithData
        : allYears.slice(0, 5);
  for (const year of probeOrder) {
    try {
      const resp = await fetch(withDataBase(`/data/dist/agency_year/${slug}/${year}.json`));
      if (resp.ok) {
        agencyResponse = resp;
        latestYear = year;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!agencyResponse) {
    throw error(404, `Agency not found: ${slug}`);
  }

  const [latestYearData, baselineResponse, boundaryIndexResponse] =
    await Promise.all([
      agencyResponse.json(),
      fetch(withDataBase("/data/dist/statewide_slug_baselines.json")),
      fetch(withDataBase("/data/dist/agency_boundaries_index.json")),
    ]);

  const agencyId =
    latestYearData?.agency_metadata?.agency_id ||
    latestYearData?.agency_metadata?.agency_slug ||
    slug;
  let boundary = null;

  if (boundaryIndexResponse.ok) {
    try {
      const boundaryIndex = await boundaryIndexResponse.json();
      const slugs = Array.isArray(boundaryIndex?.slugs) ? boundaryIndex.slugs : [];
      if (slugs.includes(agencyId)) {
        const boundaryResponse = await fetch(
          withDataBase(`/data/dist/agency_boundaries/${agencyId}.geojson`)
        );
        boundary = boundaryResponse.ok ? await boundaryResponse.json() : null;
      }
    } catch {
      boundary = null;
    }
  } else {
    const boundaryResponse = await fetch(
      withDataBase(`/data/dist/agency_boundaries/${agencyId}.geojson`)
    );
    boundary = boundaryResponse.ok ? await boundaryResponse.json() : null;
  }

  const baselines = baselineResponse.ok ? await baselineResponse.json() : [];

  // Per-agency year coverage (ascending strings) when the pipeline provides it;
  // null signals "unknown" so the UI falls back to the statewide list.
  const agencyYears: string[] | null = indexYearsWithData?.length
    ? indexYearsWithData.slice().sort((a, b) => a - b).map(String)
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
    boundary,
  };
}
