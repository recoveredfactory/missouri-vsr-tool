import { error } from "@sveltejs/kit";
import { withDataBase } from "$lib/dataBase";

export async function load({ fetch, params }) {
  const { slug, metricKey } = params;

  const [agencyResponse, baselinesResponse] = await Promise.all([
    fetch(withDataBase(`/data/dist/agency_year/${slug}.json`)),
    fetch(withDataBase("/data/dist/statewide_slug_baselines.json")),
  ]);

  if (!agencyResponse.ok) {
    throw error(404, `Agency not found: ${slug}`);
  }

  const agencyData = await agencyResponse.json();
  const baselines = baselinesResponse.ok ? await baselinesResponse.json() : [];

  return {
    slug,
    metricKey: decodeURIComponent(metricKey),
    agencyData,
    baselines,
  };
}
