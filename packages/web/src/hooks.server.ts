import { redirect } from "@sveltejs/kit";
import { extractLocaleFromHeader } from "$lib/paraglide/runtime";

export const handle = async ({ event, resolve }) => {
  if (event.url.pathname === "/") {
    const locale = extractLocaleFromHeader(event.request) ?? "en";
    throw redirect(307, `/${locale}`);
  }

  return resolve(event);
};
