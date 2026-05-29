// Centralized year-range handling.
//
// The Missouri AG's 2020 vehicle-stops publication has documented data
// anomalies we can't reconcile (race-share inversions, mid-year reporting
// gaps, and category-shift artifacts from the 2020 form revision overlap).
// We've raised this with the AG's office and don't have answers. Until we
// do, every multi-year default in this server starts in 2021, and any tool
// call that explicitly includes 2020 in its range gets a top-level warning.
//
// Raw-read tools (query_metric) still default to the metric's full coverage
// range — that includes 2020 when the metric has data there — because the
// purpose of a raw read is "show me what's published." Those get the same
// warning attached but no automatic truncation.

export const PROBLEMATIC_YEAR_FLOOR = 2021;

export const PROBLEMATIC_YEAR_WARNING =
  "Range includes 2020. The Missouri AG's published 2020 data has known anomalies (race-share inversions, mid-year reporting gaps, category-shift artifacts from the form revision that crossed 2019→2020) that we have not been able to reconcile with the AG's office. Multi-year defaults in this server now start in 2021 for that reason; 2020 in this response is here because the caller asked for it or the metric's full coverage range includes it. Treat any 2020 single-year value or any rate computed using 2020 in the denominator with caution; verify against the agency's filed numbers (FOIA) or the agency_comments table before publishing.";

/**
 * Default year window for multi-year tools (trend, disparity, agency_summary,
 * stop-share-vs-pop-share). Floors the start at PROBLEMATIC_YEAR_FLOOR even
 * if `windowYears` would otherwise pull it back further.
 */
export const defaultWindow = (
  endYear: number,
  windowYears: number,
): [number, number] => [
  Math.max(PROBLEMATIC_YEAR_FLOOR, endYear - windowYears + 1),
  endYear,
];

/**
 * Returns an array of data-quality warnings for a (start, end) year range.
 * Currently surfaces only the 2020 caveat; designed to be extended as we
 * discover more year-wide issues.
 */
export const yearRangeWarnings = (
  start: number,
  end: number,
): string[] => {
  const out: string[] = [];
  if (start <= 2020 && end >= 2020) {
    out.push(PROBLEMATIC_YEAR_WARNING);
  }
  return out;
};
