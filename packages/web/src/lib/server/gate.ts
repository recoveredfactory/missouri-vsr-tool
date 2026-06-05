import { createHash, timingSafeEqual } from "node:crypto";

// Staging-only password gate. Enabled purely by the presence of the
// STAGING_PASSWORD env var — set only on the staging stage in sst.config.ts,
// so prod and local dev are never gated. The cookie never stores the password
// itself: it holds a SHA-256 token derived from the password, recomputed and
// compared on every request. Knowing the cookie is equivalent to knowing the
// password, which is fine for a shared staging gate.

export const GATE_COOKIE = "vsr_staging_gate";

// 30 days — long enough that a reviewer isn't re-prompted mid-engagement,
// short enough that rotating STAGING_PASSWORD eventually locks everyone out.
export const GATE_MAX_AGE = 60 * 60 * 24 * 30;

export function gateToken(password: string): string {
  return createHash("sha256").update(`vsr-staging:${password}`).digest("hex");
}

export function isGateOpen(
  cookie: string | undefined,
  password: string,
): boolean {
  if (!cookie) return false;
  const expected = gateToken(password);
  if (cookie.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Only allow same-origin, single-leading-slash paths as a post-unlock
// redirect target. Blocks open-redirect via "//evil.com" or absolute URLs.
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
