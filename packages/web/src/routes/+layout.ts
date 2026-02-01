export async function load({ fetch }) {
  const response = await fetch("/data/dist/agency_index.json");
  const umamiWebsiteId = import.meta.env.UMAMI_WEBSITE_ID ?? null;

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
