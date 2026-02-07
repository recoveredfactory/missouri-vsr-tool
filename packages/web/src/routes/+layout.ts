import { withDataBase } from "$lib/dataBase";

export async function load({ fetch }) {
  const response = await fetch(withDataBase("/data/dist/agency_index.json"));
  const umamiWebsiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? null;

  if (!response.ok) {
    return {
      agencies: [],
      umamiWebsiteId,
    };
  }

  return {
    agencies: await response.json(),
    umamiWebsiteId,
  };
}
