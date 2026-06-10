// Shared race color palette for analysis figures.
//
// We lean on direct end-of-line / on-mark labels rather than legends, so these
// colors mainly need to be distinguishable and consistent across every figure
// in an article. Accessible, distinct hues; consistent across all charts.
export const RACE_COLORS: Record<string, string> = {
  White: "#64748b", // slate
  Black: "#1f6f43", // deep green (site brand family)
  Hispanic: "#c2410c", // burnt orange
  "Native American": "#7c3aed",
  Asian: "#0e7490",
  Other: "#a16207",
  Total: "#0f172a",
};

export const raceColor = (race: string): string =>
  RACE_COLORS[race] ?? "#475569";
