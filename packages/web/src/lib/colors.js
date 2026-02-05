/**
 * Shared color palettes for charts and visualizations.
 *
 * Race data uses a teal gradient (brand color family).
 * Outcome data uses a slate gradient (neutral family).
 */

/** Teal gradient — race categories (light → dark) */
export const raceColors = {
  White: "#ccfbf1", // teal-100
  Hispanic: "#5eead4", // teal-300
  Asian: "#14b8a6", // teal-500
  "Native American": "#0d9488", // teal-600
  Other: "#0f766e", // teal-700 (brand)
  Black: "#134e4a", // teal-900
};

/** Text colors for race segments — dark text on light backgrounds, white on dark */
export const raceTextColors = {
  White: "#134e4a", // dark on teal-100
  Hispanic: "#134e4a", // dark on teal-300
  Asian: "#ffffff",
  "Native American": "#ffffff",
  Other: "#ffffff",
  Black: "#ccfbf1", // light on teal-900
};

/** Slate gradient — outcome categories (light → dark) */
export const outcomeColors = {
  noAction: "#cbd5e1", // slate-300
  citations: "#64748b", // slate-500
  searches: "#334155", // slate-700
  arrests: "#0f172a", // slate-900
};
