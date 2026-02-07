import { env } from "$env/dynamic/public";
import { setDataBaseUrl, withDataBase } from "$lib/dataBase";

export async function load({ fetch }) {
  const dataBaseUrl = env.PUBLIC_DATA_BASE_URL ?? "";
  setDataBaseUrl(dataBaseUrl);
  const response = await fetch(withDataBase("/data/dist/agency_index.json", dataBaseUrl));
  const umamiWebsiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? null;

  if (!response.ok) {
    return {
      agencies: [],
      umamiWebsiteId,
      dataBaseUrl,
    };
  }

  return {
    agencies: await response.json(),
    umamiWebsiteId,
    dataBaseUrl,
  };
}
