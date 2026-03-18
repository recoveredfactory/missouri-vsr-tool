const BASE_URL = import.meta.env.PUBLIC_SITE_URL || "https://vsr.recoveredfactory.net";

function urlEntry(path) {
  const suffix = path === "/" ? "" : path;
  const en = `${BASE_URL}/en${suffix}`;
  return `  <url>
    <loc>${en}</loc>
  </url>`;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ fetch }) {
  const response = await fetch("/data/dist/agency_index.json");
  const agencies = response.ok ? await response.json() : [];

  const urls = [urlEntry("/")];
  for (const agency of agencies) {
    if (agency.agency_slug) {
      urls.push(urlEntry(`/agency/${agency.agency_slug}`));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
