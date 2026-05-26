import { z } from "zod";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import { errorResult, inputSchemaFromZod, registerTool, textResult } from "./registry.js";

const ListAgenciesInput = z.object({
  name_contains: z
    .string()
    .optional()
    .describe(
      "Case-insensitive substring filter against canonical name and known aliases. Omit to return all agencies.",
    ),
  county: z
    .string()
    .optional()
    .describe(
      "Filter by Missouri county. Case-insensitive exact match (e.g. 'St. Louis County', 'Boone County').",
    ),
  min_lifetime_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Filter to agencies whose lifetime stop count (summed across every reported year) meets or exceeds this minimum. Defaults to 0 (no filter).",
    ),
  max_lifetime_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Cap on lifetime stop count. Pair with min_lifetime_stops to focus on mid-sized agencies (e.g. min=5000, max=100000 excludes both micros and MSHP-class giants). Defaults to no cap.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Maximum rows to return. Defaults to 200."),
  include_statewide_rollup: z
    .boolean()
    .optional()
    .describe(
      "Whether to include the 'Missouri (all agencies)' statewide-rollup pseudo-agency (slug: missouri-all-agencies). Default false — the rollup aggregates every filing and is not a real agency. Set true if you specifically want it in the list.",
    ),
});

type ListAgenciesArgs = z.infer<typeof ListAgenciesInput>;

const listAgenciesHandler = async (raw: unknown) => {
  const parsed = ListAgenciesInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }

  const args: ListAgenciesArgs = parsed.data;
  const minStops = args.min_lifetime_stops ?? 0;
  const limit = args.limit ?? 200;

  const filters: string[] = [];
  const params: unknown[] = [];

  if (args.name_contains) {
    filters.push(
      `(LOWER(canonical_name) LIKE $${params.length + 1} OR EXISTS (SELECT 1 FROM UNNEST(names) AS n(name) WHERE LOWER(name) LIKE $${params.length + 1}))`,
    );
    params.push(`%${args.name_contains.toLowerCase()}%`);
  }

  if (args.county) {
    filters.push(`LOWER(county) = $${params.length + 1}`);
    params.push(args.county.toLowerCase());
  }

  if (minStops > 0) {
    filters.push(`lifetime_stops >= $${params.length + 1}`);
    params.push(minStops);
  }

  if (args.max_lifetime_stops !== undefined) {
    filters.push(`lifetime_stops <= $${params.length + 1}`);
    params.push(args.max_lifetime_stops);
  }

  if (!args.include_statewide_rollup) {
    filters.push(`is_statewide_rollup = FALSE`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const sql = `
    SELECT
      agency_slug,
      canonical_name,
      county,
      agency_type,
      lifetime_stops,
      latest_year_stops,
      years_with_data,
      latest_year_with_data
    FROM agencies
    ${where}
    ORDER BY lifetime_stops DESC NULLS LAST, canonical_name
    LIMIT ${limit}
  `;

  const conn = await getDb();
  const prepared = await conn.prepare(sql);
  for (let i = 0; i < params.length; i += 1) {
    const value = params[i];
    if (typeof value === "string") prepared.bindVarchar(i + 1, value);
    else if (typeof value === "number") prepared.bindInteger(i + 1, value);
  }
  const reader = await prepared.runAndReadAll();
  const rows = reader.getRows();
  const cols = reader.columnNames();

  const out = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = normalize(row[i]);
    });
    return obj;
  });

  const summary = {
    count: out.length,
    limited_to: limit,
    filters: {
      name_contains: args.name_contains ?? null,
      county: args.county ?? null,
      min_lifetime_stops: minStops,
      max_lifetime_stops: args.max_lifetime_stops ?? null,
    },
    agencies: out,
  };

  return textResult(JSON.stringify(summary, null, 2));
};

registerTool({
  name: "list_agencies",
  description:
    "Lists Missouri law-enforcement agencies that file vehicle-stop reports, sorted by lifetime stop volume (largest first). Use this whenever a user names an agency loosely — match the natural-language name back to a stable agency_slug, then pass that slug to other tools. Each entry includes agency_slug (primary key), canonical_name, county, agency_type, lifetime_stops (sum across every reported year), latest_year_stops (most recent year only), the sorted list of years with data, and latest_year_with_data.",
  inputSchema: inputSchemaFromZod(ListAgenciesInput),
  handler: listAgenciesHandler,
});
