/**
 * Shared color palettes for charts and visualizations.
 *
 * Race data uses a green gradient (brand color family).
 * Outcome data uses a blue gradient.
 * Accent colors use a rose/pink palette for callouts.
 */

/** Green gradient — race categories (light → dark) */
export const raceColors = {
  White: "#3e9e6c",
  Hispanic: "#25784c",
  Asian: "#1b613c",
  "Native American": "#105430",
  Other: "#043b1d",
  Black: "#022613",
};

/** Text colors for race segments — dark text on light backgrounds, white on dark */
export const raceTextColors = {
  White: "#022613",
  Hispanic: "#ffffff",
  Asian: "#ffffff",
  "Native American": "#ffffff",
  Other: "#ffffff",
  Black: "#3e9e6c",
};

/** Distinct colors — outcome categories (one per color family) */
export const outcomeColors = {
  noAction: "#658cad",
  warnings: "#25784c",
  searches: "#25784c",
  citations: "#1c4f74",
  arrests: "#792a3b",
};

/** Accent colors for callouts and highlights */
export const accentColors = {
  dark: "#792a3b",
  mid: "#b5697a",
  light: "#f1a7b8",
  lightest: "#f5c2ce",
};
