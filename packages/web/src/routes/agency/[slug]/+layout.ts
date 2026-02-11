import { error } from "@sveltejs/kit";
import { withDataBase } from "$lib/dataBase";

export async function load({ fetch, params }) {
  const slug = params.slug;
  const response = await fetch(withDataBase(`/data/dist/agency_year/${slug}.json`));

  if (!response.ok) {
    throw error(404, `Agency not found: ${slug}`);
  }

  const data = await response.json();
  const baselineResponse = await fetch(withDataBase("/data/dist/statewide_slug_baselines.json"));
  const indexResponse = await fetch(withDataBase("/data/dist/agency_index.json"));
  const boundaryIndexResponse = await fetch(
    withDataBase("/data/dist/agency_boundaries_index.json")
  );
  const agencyId =
    data?.agency_metadata?.agency_id || data?.agency_metadata?.agency_slug || slug;
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
    data,
    baselines,
    agencies,
    agencyCount: Array.isArray(agencies) ? agencies.length : 0,
    boundary,
  };
}
