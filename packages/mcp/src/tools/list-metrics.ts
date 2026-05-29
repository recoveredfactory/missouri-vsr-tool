import { z } from "zod";

import { getMetricCoverage } from "../db.js";
import { RANKING_CAVEAT, RESEARCH_PROMPT } from "./caveats.js";
import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";

const TYPE_NOTE = [
  "type_heuristic is inferred from the slug, not from the values:",
  "'count' = sum-able integer (stops, searches, arrest-charge--drug-violation).",
  "'rate' = pre-computed percentage from the source PDF (search-rate, citation-rate, contraband-hit-rate). These are 0–100 scale, NOT 0–1. Do NOT sum rates across years — average them or pull the per-year values.",
  "'ratio' = disparity index (1.0 = parity with white non-Hispanic baseline).",
  "'population' = ACS or decennial population denominator, not a stop metric.",
].join(" ");

const ListMetricsInput = z.object({
  family: z
    .string()
    .optional()
    .describe(
      "Filter to a single family (the slug prefix before '--'). Examples: 'stops', 'arrest-charge', 'probable-cause', 'disparity-index'. Case-insensitive.",
    ),
  contains: z
    .string()
    .optional()
    .describe(
      "Filter to canonical_keys whose slug contains this substring (case-insensitive). Useful for natural-language matching, e.g. contains='resident' to find resident-stops, resident-stop-rate, etc.",
    ),
});

type ListMetricsArgs = z.infer<typeof ListMetricsInput>;

const handler = async (raw: unknown) => {
  const parsed = ListMetricsInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: ListMetricsArgs = parsed.data;
  const all = await getMetricCoverage();

  let filtered = all;
  if (args.family) {
    const needle = args.family.toLowerCase();
    filtered = filtered.filter((m) => m.family.toLowerCase() === needle);
  }
  if (args.contains) {
    const needle = args.contains.toLowerCase();
    filtered = filtered.filter((m) =>
      m.canonical_key.toLowerCase().includes(needle),
    );
  }

  // Group by family for legibility.
  const byFamily = new Map<string, typeof filtered>();
  for (const m of filtered) {
    const list = byFamily.get(m.family) ?? [];
    list.push(m);
    byFamily.set(m.family, list);
  }
  const families: Record<string, typeof filtered> = {};
  for (const fam of [...byFamily.keys()].sort()) {
    families[fam] = byFamily.get(fam)!;
  }

  const payload = {
    n_metrics_total: all.length,
    n_metrics_returned: filtered.length,
    filters: {
      family: args.family ?? null,
      contains: args.contains ?? null,
    },
    type_heuristic_note: TYPE_NOTE,
    ranking_caveat: RANKING_CAVEAT,
    further_research_prompt: RESEARCH_PROMPT,
    use_query_metric_for:
      "Reading raw values of any canonical_key for one or more agencies. No cross-year aggregation, no derivations — exactly what the agency filed.",
    use_top_n_by_for:
      "Ranking by curated derived metrics (search_rate, contraband_hit_rate, disparity_index_all_stops, resident_stop_share, etc.) where the denominator and the sample-size guard matter.",
    families,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "list_metrics",
  description:
    "Returns every canonical_key present in the loaded data, grouped by family, with empirically scanned coverage (years present, race columns populated, agency-year row count) and a type heuristic (count / rate / ratio / population). Call this when you need to know whether a specific metric exists in this dataset or what years it covers. Optional filters: `family` (exact match on slug prefix) and `contains` (substring match on the full slug). Pair with `query_metric` for raw reads or `top_n_by` for curated derivations.",
  inputSchema: inputSchemaFromZod(ListMetricsInput),
  handler,
});
