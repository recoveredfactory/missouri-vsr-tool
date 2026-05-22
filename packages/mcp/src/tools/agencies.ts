import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { getDb } from "../db.js";
import { normalize } from "../duckutil.js";
import { errorResult, registerTool, textResult } from "./registry.js";

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
  min_annual_stops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Filter to agencies whose total reported stops across all years meets or exceeds this minimum. Defaults to 0 (no filter).",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Maximum rows to return. Defaults to 200."),
});

type ListAgenciesArgs = z.infer<typeof ListAgenciesInput>;

const listAgenciesHandler = async (raw: unknown) => {
  const parsed = ListAgenciesInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }

  const args: ListAgenciesArgs = parsed.data;
  const minStops = args.min_annual_stops ?? 0;
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
    filters.push(`total_stops >= $${params.length + 1}`);
    params.push(minStops);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const sql = `
    SELECT
      agency_slug,
      canonical_name,
      county,
      agency_type,
      total_stops,
      years_with_data,
      latest_year_with_data
    FROM agencies
    ${where}
    ORDER BY total_stops DESC NULLS LAST, canonical_name
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
      min_annual_stops: minStops,
    },
    agencies: out,
  };

  return textResult(JSON.stringify(summary, null, 2));
};

registerTool({
  name: "list_agencies",
  description:
    "Lists Missouri law-enforcement agencies that file vehicle-stop reports, sorted by lifetime stop volume (largest first). Use this whenever a user names an agency loosely — match the natural-language name back to a stable agency_slug, then pass that slug to other tools. Each entry includes agency_slug (primary key), canonical_name, county, agency_type, total_stops across all reported years, the sorted list of years with data, and latest_year_with_data.",
  inputSchema: zodToJsonSchema(ListAgenciesInput, {
    target: "openApi3",
  }) as Record<string, unknown>,
  handler: listAgenciesHandler,
});
