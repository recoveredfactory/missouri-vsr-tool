import { redirect } from "@sveltejs/kit";
import { extractLocaleFromHeader } from "$lib/paraglide/runtime";

// Top-level paths that are NOT locale-prefixed pages — endpoints, static
// assets, framework internals, language-agnostic data fetchers. Anything
// not on this list and not already starting with /en or /es gets a 307
// to the locale-prefixed canonical URL so we don't serve the same HTML
// at two URLs (duplicate content risk — canonical handles it, but a
// redirect is cleaner for crawlers and link sharers).
const LOCALE_AGNOSTIC_PREFIXES = new Set([
  "about-data",
  "data",
  "map",
  "embed",
  "_app",
  ".well-known",
  "sitemap.xml",
  "robots.txt",
  "favicon.png",
  "social-meta.png",
  "og",
]);

export const handle = async ({ event, resolve }) => {
  const { pathname, search } = event.url;

  if (pathname === "/") {
    const locale = extractLocaleFromHeader(event.request) ?? "en";
    throw redirect(307, `/${locale}${search}`);
  }

  const firstSegment = pathname.split("/")[1] ?? "";
  if (
    firstSegment &&
    firstSegment !== "en" &&
    firstSegment !== "es" &&
    !LOCALE_AGNOSTIC_PREFIXES.has(firstSegment)
  ) {
    const locale = extractLocaleFromHeader(event.request) ?? "en";
    throw redirect(307, `/${locale}${pathname}${search}`);
  }

  const locale = firstSegment === "es" ? "es" : "en";
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", locale),
  });
};
