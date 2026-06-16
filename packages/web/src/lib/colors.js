/**
 * Shared color palettes for charts and visualizations.
 *
 * Race and outcome data share a green/blue/amber palette (two shades each,
 * no red). Accent colors use the amber pair for callouts/highlights.
 */

/** Green/blue/amber palette — race categories, two shades per hue family */
export const raceColors = {
  White: "#17643b",
  Hispanic: "#5a7bd8",
  Asian: "#db9006",
  "Native American": "#2ab76b",
  Other: "#2748a5",
  Black: "#fbc560",
};

/** Text colors for race segments — dark text on light backgrounds, white on dark */
export const raceTextColors = {
  White: "#ffffff",
  Hispanic: "#ffffff",
  Asian: "#2b1900",
  "Native American": "#022613",
  Other: "#ffffff",
  Black: "#3d2a00",
};

/** Distinct colors — outcome categories (one per color family) */
export const outcomeColors = {
  noAction: "#57534e",
  warnings: "#17643b",
  searches: "#17643b",
  arrests: "#5a7bd8",
  citations: "#fbc560",
};

/** Accent colors for callouts and highlights — amber pair, light → dark */
export const accentColors = {
  dark: "#db9006",
  mid: "#fbc560",
  light: "#fdd9a0",
  lightest: "#fef0d6",
};
