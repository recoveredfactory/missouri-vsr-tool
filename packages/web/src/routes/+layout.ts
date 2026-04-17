export const trailingSlash = "ignore";

export async function load() {
  const umamiWebsiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? null;
  return { umamiWebsiteId };
}
