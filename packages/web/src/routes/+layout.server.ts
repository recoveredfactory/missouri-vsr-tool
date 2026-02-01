import { env } from "$env/dynamic/private";

export async function load({ fetch }) {
  const response = await fetch("/data/dist/agency_index.json");

  if (!response.ok) {
    return {
      agencies: [],
      umamiWebsiteId: env.UMAMI_WEBSITE_ID ?? null,
    };
  }

  return {
    agencies: await response.json(),
    umamiWebsiteId: env.UMAMI_WEBSITE_ID ?? null,
  };
}
