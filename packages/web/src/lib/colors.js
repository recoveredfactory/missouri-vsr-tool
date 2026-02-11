/**
 * Shared color palettes for charts and visualizations.
 *
 * Race data uses a green gradient (brand color family).
 * Outcome data uses a blue gradient.
 * Accent colors use a rose/pink palette for callouts.
 */

/** Green gradient — race categories (wide spread, light → dark) */
export const raceColors = {
  White: "#25784c",
  Hispanic: "#1c4f74",
  Asian: "#b5697a",
  "Native American": "#61c7ed",
  Other: "#658cad",
  Black: "#792a3b",
};

/** Text colors for race segments — dark text on light backgrounds, white on dark */
export const raceTextColors = {
  White: "#022613",
  Hispanic: "#022613",
  Asian: "#ffffff",
  "Native American": "#ffffff",
  Other: "#ffffff",
  Black: "#6abb8d",
};

/** Distinct colors — outcome categories (one per color family) */
export const outcomeColors = {
  noAction: "#658cad",
  warnings: "#25784c",
  searches: "#25784c",
  arrests: "#1c4f74",
  citations: "#792a3b",
};

/** Accent colors for callouts and highlights */
export const accentColors = {
  dark: "#792a3b",
  mid: "#b5697a",
  light: "#f1a7b8",
  lightest: "#f5c2ce",
};
