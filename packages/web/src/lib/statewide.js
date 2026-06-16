/**
 * The synthetic "agency" that represents the statewide aggregate — the sum of
 * every reporting agency ("Missouri (all agencies)"). It lives in the agency
 * index and the metric_year files like a normal agency, but it needs special
 * handling: its count magnitudes dwarf every real agency (so it must never be
 * drawn as a grey spaghetti line), and its own page is stripped down to census
 * + statewide trends.
 */

/** agency_slug of the statewide aggregate row. */
export const STATEWIDE_SLUG = "missouri-all-agencies";

/**
 * Canonical name normalized the same way the charts/search normalize agency
 * names (lowercase, non-alphanumeric runs → single space, trimmed):
 * "Missouri (all agencies)" → "missouri all agencies".
 */
export const STATEWIDE_AGG_NORMALIZED = "missouri all agencies";
