import { error } from "@sveltejs/kit";
import { withDataBase } from "$lib/dataBase";

export async function load({ fetch, params }) {
  const { slug } = params;
  const metricKey = decodeURIComponent(params.metricKey);

  const [metricResponse, indexResponse] = await Promise.all([
    fetch(withDataBase(`/data/dist/metric_year/${metricKey}.json`)),
    fetch(withDataBase("/data/dist/agency_index.json")),
  ]);

  if (!metricResponse.ok) {
    throw error(404, `Metric not found: ${metricKey}`);
  }

  const metricRows = await metricResponse.json();
  const agencies = indexResponse.ok ? await indexResponse.json() : [];

  const agencyEntry = Array.isArray(agencies)
    ? agencies.find((a) => a.agency_slug === slug || a.slug === slug)
    : null;
  const agencyName =
    agencyEntry?.canonical_name || agencyEntry?.agency_name || slug;

  return {
    slug,
    agencyName,
    metricKey,
    metricRows: Array.isArray(metricRows) ? metricRows : [],
  };
}
