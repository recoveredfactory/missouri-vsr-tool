import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import { errorResult, registerTool, textResult } from "./registry.js";

// Same metric vocabulary as top_n_by, expressed as DuckDB aggregate SQL
// over a (start, end) window. value_expr and sample_expr both operate on
// the aggregated CTE columns; the comparison table builds one row per
// requested agency and one implicit row for the statewide median.
interface CompareMetricSpec {
  description: string;
  sample_label: string;
  /** SQL that produces (agency_slug, value, sample_size) for every agency. */
  perAgencySql: (extra: string) => string;
}

const buildRateSpec = (
  numMetric: string,
  numRace: string,
  denomMetric: string,
  denomRace: string,
  scale = 1,
): CompareMetricSpec["perAgencySql"] =>
  (extra) => `
SELECT
  s.agency_slug,
  ${scale} * SUM(CASE WHEN s.metric = '${numMetric}' THEN s.${numRace} END) /
    NULLIF(SUM(CASE WHEN s.metric = '${denomMetric}' THEN s.${denomRace} END), 0) AS value,
  SUM(CASE WHEN s.metric = '${denomMetric}' THEN s.${denomRace} END) AS sample_size
FROM stops s
INNER JOIN agencies a ON a.agency_slug = s.agency_slug
WHERE s.year BETWEEN $start AND $end
  ${extra}
GROUP BY s.agency_slug
`;

const METRICS: Record<string, CompareMetricSpec> = {
  search_rate: {
    description: "Pooled search rate (0–100 pct) across the window.",
    sample_label: "stops in window",
    perAgencySql: buildRateSpec("searches", "total", "stops", "total", 100),
  },
  contraband_hit_rate: {
    description: "Pooled contraband hit rate (0–100 pct) across the window.",
    sample_label: "searches in window",
    perAgencySql: buildRateSpec("contraband-total", "total", "searches", "total", 100),
  },
  hispanic_stop_share: {
    description: "Pooled Hispanic stop share (0–100 pct) across the window.",
    sample_label: "stops in window",
    perAgencySql: buildRateSpec("stops", "hispanic", "stops", "total", 100),
  },
  black_stop_share: {
    description: "Pooled Black stop share (0–100 pct) across the window.",
    sample_label: "stops in window",
    perAgencySql: buildRateSpec("stops", "black", "stops", "total", 100),
  },
  total_stops: {
    description: "Sum of stops across the window.",
    sample_label: "stops in window",
    perAgencySql: (extra) => `
SELECT s.agency_slug,
       SUM(CASE WHEN s.metric = 'stops' THEN s.total END) AS value,
       SUM(CASE WHEN s.metric = 'stops' THEN s.total END) AS sample_size
FROM stops s
INNER JOIN agencies a ON a.agency_slug = s.agency_slug
WHERE s.year BETWEEN $start AND $end
  ${extra}
GROUP BY s.agency_slug
`,
  },
};

const CompareInput = z.object({
  metric: z
    .enum(Object.keys(METRICS) as [keyof typeof METRICS, ...Array<keyof typeof METRICS>])
    .describe("Metric to compare across agencies. Same vocabulary as top_n_by."),
  agency_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(20)
    .describe("List of agency_slugs to compare side-by-side. 1–20 entries."),
  year_range: z
    .tuple([z.number().int(), z.number().int()])
    .optional()
    .describe("Inclusive [start, end] window. Defaults to 2020–2024."),
});

type CompareArgs = z.infer<typeof CompareInput>;

const compareHandler = async (raw: unknown) => {
  const parsed = CompareInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: CompareArgs = parsed.data;
  const spec = METRICS[args.metric];
  const [start, end] = args.year_range ?? [2020, 2024];

  // Pull per-agency values for every qualifying agency in the dataset (we
  // need the full set to compute the statewide median honestly), then
  // project just the requested agencies into the side-by-side table.
  const sql = spec.perAgencySql("")
    .replace(/\$start/g, String(start))
    .replace(/\$end/g, String(end));

  const conn = await getDb();
  const reader = await conn.runAndReadAll(sql);
  const cols = reader.columnNames();

  type PerAgency = { agency_slug: string; value: number | null; sample_size: number };
  const allAgencies: PerAgency[] = reader.getRows().map((row) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c, i) => (o[c] = normalize(row[i])));
    return {
      agency_slug: o.agency_slug as string,
      value: typeof o.value === "number" && Number.isFinite(o.value) ? o.value : null,
      sample_size: typeof o.sample_size === "number" ? o.sample_size : 0,
    };
  });

  const eligible = allAgencies.filter(
    (r) => r.value !== null && r.sample_size > 0,
  );
  const sortedValues = eligible
    .map((r) => r.value as number)
    .sort((a, b) => a - b);

  const median = (() => {
    if (sortedValues.length === 0) return null;
    const n = sortedValues.length;
    const mid = Math.floor(n / 2);
    return n % 2 === 1
      ? sortedValues[mid]
      : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  })();

  const lookup = new Map(allAgencies.map((r) => [r.agency_slug, r]));

  // Pull metadata for the requested agencies in a single round trip.
  const metaSql = `SELECT agency_slug, canonical_name, county, agency_type
                   FROM agencies WHERE agency_slug IN (${args.agency_ids.map((_, i) => `$${i + 1}`).join(",")})`;
  const metaStmt = await conn.prepare(metaSql);
  args.agency_ids.forEach((s, i) => metaStmt.bindVarchar(i + 1, s));
  const metaReader = await metaStmt.runAndReadAll();
  const metaCols = metaReader.columnNames();
  const meta = new Map<
    string,
    { canonical_name: string; county: string | null; agency_type: string | null }
  >();
  for (const row of metaReader.getRows()) {
    const o: Record<string, unknown> = {};
    metaCols.forEach((c, i) => (o[c] = normalize(row[i])));
    meta.set(o.agency_slug as string, {
      canonical_name: o.canonical_name as string,
      county: (o.county as string) ?? null,
      agency_type: (o.agency_type as string) ?? null,
    });
  }

  const rows = args.agency_ids.map((slug) => {
    const m = meta.get(slug);
    const r = lookup.get(slug);
    return {
      agency_slug: slug,
      canonical_name: m?.canonical_name ?? slug,
      county: m?.county ?? null,
      agency_type: m?.agency_type ?? null,
      value: r?.value ?? null,
      sample_size: r?.sample_size ?? 0,
      pct_diff_vs_statewide_median:
        r?.value !== null && r?.value !== undefined && median !== null && median !== 0
          ? ((r.value - median) / median) * 100
          : null,
    };
  });

  const payload = {
    metric: args.metric,
    metric_description: spec.description,
    sample_size_label: spec.sample_label,
    year_range: [start, end],
    statewide_median: {
      value: median,
      based_on_n_agencies: eligible.length,
      note: "Median of all agencies in the dataset that had any data for this metric in the window. Not weighted by stop volume.",
    },
    requested_agencies: rows,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "compare",
  description: `Side-by-side comparison of a named metric across up to 20 specified agencies, with an implicit statewide-median row for context. Available metrics: ${Object.keys(METRICS).join(", ")}. Each agency row includes the metric value, the gating sample size (so the reader can spot thin denominators), and the percent difference vs. the statewide median. Use list_agencies to resolve names into slugs first.`,
  inputSchema: zodToJsonSchema(CompareInput, { target: "openApi3" }) as Record<string, unknown>,
  handler: compareHandler,
});
