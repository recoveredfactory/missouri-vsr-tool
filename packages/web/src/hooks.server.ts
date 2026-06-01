import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { extractLocaleFromHeader } from "$lib/paraglide/runtime";
import { GATE_COOKIE, isGateOpen } from "$lib/server/gate";

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
  "unlock",
  "_app",
  ".well-known",
  "sitemap.xml",
  "robots.txt",
  "favicon.png",
  "social-meta.png",
  "og",
]);

// While the staging gate is closed, only these top-level segments are
// reachable — the unlock page itself plus framework asset routes (without
// these the unlock page can't load its own JS/CSS in dev).
const GATE_BYPASS_PREFIXES = new Set(["unlock", "_app", ".well-known"]);

export const handle = async ({ event, resolve }) => {
  const { pathname, search } = event.url;

  // Staging password gate. Active only when STAGING_PASSWORD is set, which
  // sst.config.ts does solely for the staging stage — prod and local dev
  // skip this entirely. Runs before the locale redirects so an unauthed
  // visitor lands on /unlock instead of bouncing through /en first.
  const gatePassword = env.STAGING_PASSWORD;
  if (gatePassword) {
    const gateSegment = pathname.split("/")[1] ?? "";
    if (
      !GATE_BYPASS_PREFIXES.has(gateSegment) &&
      !isGateOpen(event.cookies.get(GATE_COOKIE), gatePassword)
    ) {
      const next = encodeURIComponent(`${pathname}${search}`);
      throw redirect(307, `/unlock?next=${next}`);
    }
  }

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
