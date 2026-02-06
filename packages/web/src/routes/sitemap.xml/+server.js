const BASE_URL = import.meta.env.PUBLIC_SITE_URL || "https://missourivsr.com";

function urlEntry(path) {
  const en = `${BASE_URL}/en${path}`;
  const es = `${BASE_URL}/es${path}`;
  const xDefault = `${BASE_URL}${path}`;
  return `  <url>
    <loc>${en}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>
    <xhtml:link rel="alternate" hreflang="es" href="${es}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
