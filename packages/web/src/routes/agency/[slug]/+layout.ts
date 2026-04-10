import { error } from "@sveltejs/kit";
import { withDataBase } from "$lib/dataBase";

export async function load({ fetch, params }) {
  const slug = params.slug;

  // Fetch manifest first to know which years are available.
  const manifestResponse = await fetch(withDataBase("/data/dist/manifest.json"));
  let manifest: Record<string, unknown> | null = null;
  if (manifestResponse.ok) {
    manifest = await manifestResponse.json();
  }

  const allYears: number[] = Array.isArray(manifest?.years)
    ? (manifest.years as number[]).slice().sort((a, b) => b - a)
    : [];
  const partialCoverageYears: number[] = Array.isArray(manifest?.partial_coverage_years)
    ? (manifest.partial_coverage_years as number[])
    : [];

  // Load the most recent year's data server-side.
  const latestYear = allYears[0];
  if (!latestYear) {
    throw error(404, `Agency not found: ${slug}`);
  }

  const response = await fetch(
    withDataBase(`/data/dist/agency_year/${slug}/${latestYear}.json`)
  );
  if (!response.ok) {
    throw error(404, `Agency not found: ${slug}`);
  }
  const latestYearData = await response.json();

  const [baselineResponse, indexResponse, boundaryIndexResponse] = await Promise.all([
    fetch(withDataBase("/data/dist/statewide_slug_baselines.json")),
    fetch(withDataBase("/data/dist/agency_index.json")),
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
  const agencies = indexResponse.ok ? await indexResponse.json() : [];

  return {
    slug,
    latestYearData,
    latestYear,
    years: allYears.map(String),
    partialCoverageYears,
    baselines,
    agencies,
    agencyCount: Array.isArray(agencies) ? agencies.length : 0,
    boundary,
  };
}
