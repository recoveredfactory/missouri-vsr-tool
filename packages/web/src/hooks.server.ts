import { redirect } from "@sveltejs/kit";
import { extractLocaleFromHeader } from "$lib/paraglide/runtime";

export const handle = async ({ event, resolve }) => {
  if (event.url.pathname === "/") {
    const locale = extractLocaleFromHeader(event.request) ?? "en";
    throw redirect(307, `/${locale}`);
  }

  const locale =
    event.url.pathname.split("/")[1] === "es" ? "es" : "en";
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", locale),
  });
};
