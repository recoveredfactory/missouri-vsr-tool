import { z } from "zod";

import { RESEARCH_PROMPT } from "./caveats.js";
import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";

const baseUrl = () =>
  process.env.DATA_BASE_URL ?? "https://data.vsr.recoveredfactory.net";
const releasePath = () => process.env.DATA_RELEASE_PATH ?? "/releases/v2.2";

// The pipeline ships a manifest cataloging every published downloadable
// file (combined JSON, per-dataset CSV/Parquet, per-year wide CSV/Parquet,
// statewide subsets). We don't know the manifest's exact filename ahead of
// time — it follows the prefix-and-year convention the pipeline uses — so
// we discover it once at first call.
// Tried in order — newest release naming first. Covers v2.2 (…2000_2025…)
// and v2.1 (…2000_2024…) so the same code works across release paths.
const MANIFEST_FILENAME_GUESSES = [
  "missouri_vsr_2000_2025_downloads_manifest.json",
  "missouri_vsr_2000_2024_downloads_manifest.json",
];

interface ManifestFile {
  path: string;
  size_bytes: number;
  group?: string;
  format?: string;
  year?: number;
}

interface DownloadsManifest {
  prefix: string;
  base_dir: string;
  file_count: number;
  files: ManifestFile[];
}

let manifestCache: DownloadsManifest | null = null;

const downloadsBaseUrl = () => `${baseUrl()}${releasePath()}/downloads`;

const loadManifest = async (): Promise<DownloadsManifest> => {
  if (manifestCache) return manifestCache;
  const base = downloadsBaseUrl();
  for (const filename of MANIFEST_FILENAME_GUESSES) {
    const url = `${base}/${filename}`;
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.ok) {
        manifestCache = (await res.json()) as DownloadsManifest;
        return manifestCache;
      }
    } catch {
      // try next
    }
  }
  throw new Error(
    `Could not locate downloads manifest at ${base}/. Tried: ${MANIFEST_FILENAME_GUESSES.join(", ")}.`,
  );
};

const formatBytes = (n: number): string => {
  if (!Number.isFinite(n) || n < 0) return "?";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return i === 0 ? `${v} B` : `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
};

const ListDownloadsInput = z.object({
  group: z
    .enum(["csv", "json", "parquet"])
    .optional()
    .describe(
      "Filter to a single file group. csv = comma-separated, opens in spreadsheets and pandas/R. parquet = columnar binary, much smaller and faster for analytical workloads. json = full combined dataset (one big file with every dataset nested).",
    ),
  format: z
    .string()
    .optional()
    .describe(
      "Filter to a format tag (e.g. 'wide' for the wide-format per-year files). Omit to include all formats.",
    ),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2024)
    .optional()
    .describe(
      "Filter to a single report year. Per-year wide-format files only — the combined and per-dataset files cover all years and have no year tag.",
    ),
  contains: z
    .string()
    .optional()
    .describe(
      "Substring filter on the file path. Case-insensitive. Useful for finding (e.g.) 'agency_comments' or 'agency_index' specific files.",
    ),
});

type ListDownloadsArgs = z.infer<typeof ListDownloadsInput>;

const handler = async (raw: unknown) => {
  const parsed = ListDownloadsInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: ListDownloadsArgs = parsed.data;

  let manifest: DownloadsManifest;
  try {
    manifest = await loadManifest();
  } catch (err) {
    return errorResult(
      err instanceof Error ? err.message : "Failed to load downloads manifest.",
    );
  }

  const base = downloadsBaseUrl();
  let files = manifest.files;
  if (args.group) files = files.filter((f) => f.group === args.group);
  if (args.format) files = files.filter((f) => f.format === args.format);
  if (args.year !== undefined)
    files = files.filter((f) => f.year === args.year);
  if (args.contains) {
    const needle = args.contains.toLowerCase();
    files = files.filter((f) => f.path.toLowerCase().includes(needle));
  }

  const enriched = files.map((f) => ({
    path: f.path,
    group: f.group ?? null,
    format: f.format ?? null,
    year: f.year ?? null,
    size_bytes: f.size_bytes,
    size_human: formatBytes(f.size_bytes),
    url: `${base}/${f.path}`,
  }));

  const payload = {
    release_path: releasePath(),
    base_url: base,
    file_count_total: manifest.file_count,
    file_count_returned: enriched.length,
    filters: {
      group: args.group ?? null,
      format: args.format ?? null,
      year: args.year ?? null,
      contains: args.contains ?? null,
    },
    interpretation_notes: [
      "Parquet is the smallest and fastest for analytical workloads (pandas, DuckDB, R arrow). CSV is universal but ~10× larger. JSON is a single combined file covering everything but huge (>2GB).",
      "Per-year wide-format files (format='wide', year=NNNN) are a denormalized snapshot of one year — convenient for spreadsheet drops, but the row-based long format (no 'wide' tag) is the canonical shape and what the MCP queries internally.",
      "Sizes are uncompressed bytes; CSV files compress dramatically over the wire — actual download is much smaller if your client accepts gzip.",
    ],
    further_research_prompt: RESEARCH_PROMPT,
    files: enriched,
  };

  return textResult(JSON.stringify(payload, null, 2));
};

registerTool({
  name: "list_downloads",
  description:
    "Returns the catalog of downloadable data files published alongside this MCP — combined JSON, per-dataset CSV/Parquet (statewide stops, agency index, agency comments), per-year wide-format snapshots, and the slim statewide-subset. Each entry includes the full HTTPS URL, file size, group (csv/json/parquet), format, and year tag. Filter by group / format / year / substring. Use this when the user wants bulk data for their own analysis (pandas, R, DuckDB, spreadsheet) rather than going through the curated query tools.",
  inputSchema: inputSchemaFromZod(ListDownloadsInput),
  handler,
});
