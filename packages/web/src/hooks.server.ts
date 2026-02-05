import { redirect } from "@sveltejs/kit";

export const handle = async ({ event, resolve }) => {
  if (event.url.pathname === "/") {
    throw redirect(308, "/en");
  }

  return resolve(event);
};
