import { z } from "zod";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import { RESEARCH_PROMPT } from "./caveats.js";
import { errorResult, inputSchemaFromZod, registerTool, textResult } from "./registry.js";

type RaceColumn = "white" | "black" | "hispanic" | "asian" | "native_american" | "other";

const RACES: ReadonlyArray<{ key: RaceColumn; label: string }> = [
  { key: "white", label: "White" },
  { key: "black", label: "Black" },
  { key: "hispanic", label: "Hispanic" },
  { key: "asian", label: "Asian" },
  { key: "native_american", label: "Native American" },
  { key: "other", label: "Other" },
];

const BASELINE: RaceColumn = "white";
const HIT_RATE_MIN_SEARCHES = 50;

const DisparityInput = z.object({
  comparison_type: z
    .enum(["search_rate", "hit_rate", "outcome_test"])
    .describe(
      "Which view to return. `search_rate` = search rate by race. `hit_rate` = contraband hit rate by race. `outcome_test` = both side by side, the Knowles/Persico/Todd 2001 framing.",
    ),
  agency_id: z
    .string()
    .optional()
    .describe(
      "agency_slug to focus on. Omit for a statewide aggregate. If provided, all stops/searches/contraband counts are taken from that single agency.",
    ),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe("Inclusive [start, end] window. Default 2020–2024."),
  county: z
    .string()
    .optional()
    .describe(
      "Restrict to a single county (case-insensitive exact match). Useful for regional comparisons. Ignored if agency_id is set.",
    ),
});

type DisparityArgs = z.infer<typeof DisparityInput>;

const disparityHandler = async (raw: unknown) => {
  const parsed = DisparityInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: DisparityArgs = parsed.data;
  const [start, end] = args.year_range ?? [2020, 2024];

  const conn = await getDb();

  // Build aggregate SQL: SUM each race column for each of stops, searches,
  // contraband-total over the window.
  const raceSums = RACES.flatMap((r) => [
    `SUM(CASE WHEN s.metric = 'stops' THEN s.${r.key} END) AS stops_${r.key}`,
    `SUM(CASE WHEN s.metric = 'searches' THEN s.${r.key} END) AS searches_${r.key}`,
    `SUM(CASE WHEN s.metric = 'contraband-total' THEN s.${r.key} END) AS contraband_${r.key}`,
  ]).join(",\n         ");

  const filters: string[] = [
    "s.year BETWEEN $1 AND $2",
    "s.metric IN ('stops', 'searches', 'contraband-total')",
  ];
  const bindings: Array<{ kind: "varchar"; value: string }> = [];

  if (args.agency_id) {
    filters.push(`s.agency_slug = $${bindings.length + 3}`);
    bindings.push({ kind: "varchar", value: args.agency_id });
  } else if (args.county) {
    filters.push(`LOWER(a.county) = $${bindings.length + 3}`);
    bindings.push({ kind: "varchar", value: args.county.toLowerCase() });
  }

  const sql = `
    SELECT ${raceSums}
    FROM stops s
    INNER JOIN agencies a ON a.agency_slug = s.agency_slug
    WHERE ${filters.join("\n      AND ")}
  `;

  const stmt = await conn.prepare(sql);
  stmt.bindInteger(1, start);
  stmt.bindInteger(2, end);
  bindings.forEach((b, i) => stmt.bindVarchar(i + 3, b.value));
  const reader = await stmt.runAndReadAll();
  const cols = reader.columnNames();
  const row = reader.getRows()[0] ?? [];

  const flat: Record<string, number> = {};
  cols.forEach((c, i) => {
    const v = normalize(row[i]);
    flat[c] = typeof v === "number" ? v : 0;
  });

  const baselineStops = flat[`stops_${BASELINE}`] ?? 0;
  const baselineSearches = flat[`searches_${BASELINE}`] ?? 0;
  const baselineSearchRate =
    baselineStops > 0 ? (100 * baselineSearches) / baselineStops : null;
  const baselineHitRate =
    baselineSearches >= HIT_RATE_MIN_SEARCHES
      ? (100 * (flat[`contraband_${BASELINE}`] ?? 0)) / baselineSearches
      : null;

  const byRace = RACES.map((r) => {
    const stops = flat[`stops_${r.key}`] ?? 0;
    const searches = flat[`searches_${r.key}`] ?? 0;
    const contraband = flat[`contraband_${r.key}`] ?? 0;

    const searchRate = stops > 0 ? (100 * searches) / stops : null;
    const hitRate =
      searches >= HIT_RATE_MIN_SEARCHES ? (100 * contraband) / searches : null;

    const searchRateRatio =
      r.key === BASELINE
        ? 1
        : searchRate !== null && baselineSearchRate !== null && baselineSearchRate > 0
          ? searchRate / baselineSearchRate
          : null;
    const hitRateRatio =
      r.key === BASELINE
        ? 1
        : hitRate !== null && baselineHitRate !== null && baselineHitRate > 0
          ? hitRate / baselineHitRate
          : null;

    return {
      race: r.label,
      stops,
      searches,
      contraband_found: contraband,
      search_rate_pct: searchRate,
      contraband_hit_rate_pct:
        hitRate === null ? "insufficient data (need ≥50 searches)" : hitRate,
      search_rate_ratio_vs_white: searchRateRatio,
      hit_rate_ratio_vs_white: hitRateRatio,
    };
  });

  // Filter the response to the requested view.
  const view = (() => {
    switch (args.comparison_type) {
      case "search_rate":
        return byRace.map((r) => ({
          race: r.race,
          stops: r.stops,
          searches: r.searches,
          search_rate_pct: r.search_rate_pct,
          search_rate_ratio_vs_white: r.search_rate_ratio_vs_white,
        }));
      case "hit_rate":
        return byRace.map((r) => ({
          race: r.race,
          searches: r.searches,
          contraband_found: r.contraband_found,
          contraband_hit_rate_pct: r.contraband_hit_rate_pct,
          hit_rate_ratio_vs_white: r.hit_rate_ratio_vs_white,
        }));
      case "outcome_test":
      default:
        return byRace;
    }
  })();

  const payload = {
    comparison_type: args.comparison_type,
    scope: args.agency_id
      ? { agency_slug: args.agency_id }
      : args.county
        ? { county: args.county }
        : { statewide: true },
    year_range: [start, end],
    baseline: "White (non-Hispanic by reporting convention)",
    method:
      args.comparison_type === "outcome_test"
        ? "Outcome test (Knowles/Persico/Todd 2001). The intuition: if officers applied the same suspicion threshold across groups, the contraband hit rate would equalize at the margin. A pattern where one group is searched at a higher rate AND finds contraband at a lower rate is consistent with a lower threshold of suspicion for that group. The test does not directly prove discrimination — selection effects can produce similar patterns — but it is the standard quantitative test in the policing literature. Interpretation is on the reader; this tool does not editorialize."
        : args.comparison_type === "search_rate"
          ? "Search rate by race over the window, with ratio vs. white non-Hispanic. search_rate_pct = 100 * SUM(searches by race) / SUM(stops by race)."
          : "Contraband hit rate by race over the window, with ratio vs. white non-Hispanic. hit_rate_pct = 100 * SUM(contraband_found by race) / SUM(searches by race). Requires ≥50 searches per race to report; otherwise insufficient_data is returned for that race.",
    sample_size_minimum_for_hit_rate: HIT_RATE_MIN_SEARCHES,
    further_research_prompt: RESEARCH_PROMPT,
    results: view,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "disparity",
  description:
    "Implements the classic outcome test for racial disparity in traffic-stop searches (Knowles, Persico, Todd 2001). Three views: `search_rate` = search rate by race vs. white-non-Hispanic baseline; `hit_rate` = contraband hit rate by race vs. baseline (≥50 searches required); `outcome_test` = both side by side. Can scope to a single agency_slug, a county, or statewide. Defaults to 2020–2024. Returns ratios but does not editorialize on what they mean.",
  inputSchema: inputSchemaFromZod(DisparityInput),
  handler: disparityHandler,
});
