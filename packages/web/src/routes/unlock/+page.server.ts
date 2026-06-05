import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import {
  GATE_COOKIE,
  GATE_MAX_AGE,
  gateToken,
  isGateOpen,
  sanitizeNext,
} from "$lib/server/gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url, cookies }) => {
  const password = env.STAGING_PASSWORD;
  // Gate disabled (prod / local) — nothing to unlock.
  if (!password) throw redirect(307, "/");

  const next = sanitizeNext(url.searchParams.get("next"));
  // Already past the gate — bounce straight through.
  if (isGateOpen(cookies.get(GATE_COOKIE), password)) throw redirect(307, next);

  return { next };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const password = env.STAGING_PASSWORD;
    if (!password) throw redirect(307, "/");

    const data = await request.formData();
    const attempt = String(data.get("password") ?? "");
    const next = sanitizeNext(String(data.get("next") ?? "/"));

    if (attempt !== password) {
      return fail(401, { error: true, next });
    }

    cookies.set(GATE_COOKIE, gateToken(password), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: GATE_MAX_AGE,
    });

    throw redirect(303, next);
  },
};
