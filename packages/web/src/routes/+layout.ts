export const trailingSlash = "ignore";

import { env } from "$env/dynamic/public";
import { withDataBase } from "$lib/dataBase";

export async function load({ fetch }) {
  const dataBaseUrl = env.PUBLIC_DATA_BASE_URL ?? "";
  const response = await fetch(withDataBase("/data/dist/agency_index.json", dataBaseUrl));
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
