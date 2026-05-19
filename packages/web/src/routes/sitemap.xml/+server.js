const BASE_URL = import.meta.env.PUBLIC_SITE_URL || "https://vsr.recoveredfactory.net";
const LOCALES = ["en", "es"];

// XML-escape the values we interpolate. URLs are normally safe but slugs
// could in theory contain `&` and we'd rather not break the document.
const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const locUrl = (locale, path) => `${BASE_URL}/${locale}${path === "/" ? "" : path}`;

// Build a sitemap entry that lists one locale as <loc> and all locales (plus
// x-default) as hreflang alternates. Google uses these to consolidate
// language variants instead of treating them as duplicates.
function urlEntry(path, lastmod) {
  const alternates = LOCALES.map(
    (locale) =>
      `    <xhtml:link rel="alternate" hreflang="${locale}" href="${xmlEscape(locUrl(locale, path))}" />`,
  ).join("\n");
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(locUrl("en", path))}" />`;

  // Emit one <url> per locale so each language version is discoverable
  // directly, while pointing at the others via hreflang.
  return LOCALES.map(
    (locale) => `  <url>
    <loc>${xmlEscape(locUrl(locale, path))}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}${alternates}
${xDefault}
  </url>`,
  ).join("\n");
}

// Best-effort: pull a site-wide lastmod from the data manifest. Falls back
// to nothing rather than a misleading current-day stamp.
async function fetchLastmod(fetch) {
  try {
    const dataBase = import.meta.env.PUBLIC_DATA_BASE_URL;
    const releasePath = import.meta.env.PUBLIC_DATA_RELEASE_PATH ?? "";
    if (!dataBase) return null;
    const res = await fetch(`${dataBase}${releasePath}/dist/manifest.json`);
    if (!res.ok) return null;
    const manifest = await res.json();
    const released = manifest?.released;
    return typeof released === "string" && /^\d{4}-\d{2}-\d{2}/.test(released) ? released : null;
  } catch {
    return null;
  }
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ fetch }) {
  const [agenciesRes, lastmod] = await Promise.all([
    fetch("/data/dist/agency_index.json"),
    fetchLastmod(fetch),
  ]);
  const agencies = agenciesRes.ok ? await agenciesRes.json() : [];

  const entries = [urlEntry("/", lastmod), urlEntry("/287g", lastmod)];
  for (const agency of agencies) {
    if (agency.agency_slug) {
      entries.push(urlEntry(`/agency/${agency.agency_slug}`, lastmod));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      // CloudFront-friendly: revalidate quickly so a fresh deploy updates
      // the sitemap without a long stale window.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
