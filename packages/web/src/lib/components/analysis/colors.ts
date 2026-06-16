// Race color palette for analysis figures.
//
// Sourced from the app-wide palette in $lib/colors.js so the analysis charts
// stay consistent with the homepage and the metric / spaghetti charts (green
// for White, maroon for Black, blue for Hispanic, …) instead of carrying their
// own divergent hues. A later refactor may collapse this module entirely; for
// now it just re-points at the shared source and adds the aggregate color.
//
// We lean on direct end-of-line / on-mark labels rather than legends, so these
// colors mainly need to be distinguishable and consistent across every figure.
import { raceColors } from "$lib/colors.js";

export const RACE_COLORS: Record<string, string> = {
  ...raceColors,
  Total: "#1e293b", // slate-800 — matches MetricChartModal's TOTAL_COLOR
};

export const raceColor = (race: string): string =>
  RACE_COLORS[race] ?? "#475569";
