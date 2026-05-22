import { createWriteStream, mkdtempSync, readFileSync } from "node:fs";
import { Agent, get as httpsGet } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

const DEFAULT_BASE_URL = "https://data.vsr.recoveredfactory.net";
const DEFAULT_RELEASE_PATH = "/releases/v2.1";

const baseUrl = () => process.env.DATA_BASE_URL ?? DEFAULT_BASE_URL;
const releasePath = () => process.env.DATA_RELEASE_PATH ?? DEFAULT_RELEASE_PATH;

const agencyIndexUrl = () => `${baseUrl()}${releasePath()}/dist/agency_index.json`;
const longStatsUrl = () =>
  `${baseUrl()}${releasePath()}/downloads/missouri_vsr_2000_2024_vsr_statistics.parquet`;
const locatorSvgUrl = () => `${baseUrl()}${releasePath()}/dist/mo_locator.svg`;

const downloadToTmp = (url: string, filename: string): Promise<string> => {
  const dir = mkdtempSync(join(tmpdir(), "vsr-mcp-"));
  const path = join(dir, filename);

  // node:https is HTTP/1.1 by default. The upstream CloudFront serves the
  // larger Parquet bodies cleanly over HTTP/1.1 but drops Snappy-compressed
  // ranges intermittently over HTTP/2 (which is what Node's fetch / undici
  // and DuckDB httpfs both prefer). Forcing the protocol fixes the
  // "decompression failure" / "terminated" mid-stream errors observed in
  // the development smoke harness.
  return new Promise((resolve, reject) => {
    const agent = new Agent({ keepAlive: false });
    const req = httpsGet(url, { agent }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        agent.destroy();
        downloadToTmp(res.headers.location, filename).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        agent.destroy();
        reject(new Error(`Status ${res.statusCode} for ${url}`));
        return;
      }
      const out = createWriteStream(path);
      res.pipe(out);
      out.on("finish", () => {
        agent.destroy();
        resolve(path);
      });
      out.on("error", (err) => {
        agent.destroy();
        reject(err);
      });
    });
    req.on("error", (err) => {
      agent.destroy();
      reject(err);
    });
  });
};

let connPromise: Promise<DuckDBConnection> | null = null;

let locatorSvgCache: string | null = null;

const init = async (): Promise<DuckDBConnection> => {
  // Pre-fetch Parquet, JSON, and the locator SVG to local disk via HTTP/1.1.
  // The upstream CloudFront drops Snappy-compressed Parquet blocks
  // intermittently over HTTP/2; forcing HTTP/1.1 bypasses that.
  const [statsPath, agencyPath, svgPath] = await Promise.all([
    downloadToTmp(longStatsUrl(), "stats.parquet"),
    downloadToTmp(agencyIndexUrl(), "agency_index.json"),
    downloadToTmp(locatorSvgUrl(), "mo_locator.svg"),
  ]);
  locatorSvgCache = readFileSync(svgPath, "utf-8");

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  // agency_index.json is small (~3.6MB); materialize into a fast in-memory
  // table. The pipeline emits it directly so we don't touch per-metric
  // files at cold start.
  //
  // Note: the pipeline's `all_stops_total` field is the agency's
  // most-recent-year stop count, NOT a lifetime sum. We carry it as
  // `latest_year_stops` and compute true `lifetime_stops` below from the
  // stats parquet.
  await conn.run(
    `CREATE TABLE agencies AS
     SELECT
       agency_slug,
       canonical_name,
       names,
       city,
       zip,
       county,
       agency_type,
       census_geoid,
       all_stops_total AS latest_year_stops,
       years_with_data,
       latest_year_with_data
     FROM read_json('${agencyPath}', maximum_object_size = 100000000)`,
  );

  // Materialize a slim `stops` table from the local Parquet. JOIN to
  // `agencies` resolves the canonical-name string back to the stable slug
  // and drops any rows whose agency isn't in the index.
  //
  // The Parquet emits two rows per (agency, year, metric): one with raw
  // values and one with a row_key suffix of "-percentage" carrying the
  // normalized shares (Totals sum to 1). Both share the same canonical_key,
  // so we filter the percentage rows out here to keep the metric space
  // clean. If a tool ever needs the shares it should compute them from the
  // raw row, not pull a second variant.
  await conn.run(
    `CREATE TABLE stops AS
     SELECT
       a.agency_slug,
       r.year::INTEGER AS year,
       r.canonical_key AS metric,
       r."Total" AS total,
       r."White" AS white,
       r."Black" AS black,
       r."Hispanic" AS hispanic,
       r."Asian" AS asian,
       r."Native American" AS native_american,
       r."Other" AS other
     FROM read_parquet('${statsPath}') r
     INNER JOIN agencies a ON a.canonical_name = r.agency
     WHERE r.canonical_key IS NOT NULL
       AND r.row_key NOT LIKE '%-percentage'`,
  );

  // Useful covering indexes for the most common access patterns.
  await conn.run("CREATE INDEX stops_slug ON stops (agency_slug)");
  await conn.run("CREATE INDEX stops_metric ON stops (metric)");
  await conn.run("CREATE INDEX stops_slug_metric ON stops (agency_slug, metric)");

  // True lifetime stop count, summed across every reported year. This is
  // what natural-language questions like "who runs the most stops" actually
  // mean. We materialize it once here so list_agencies can ORDER BY it.
  await conn.run(
    `ALTER TABLE agencies ADD COLUMN lifetime_stops BIGINT`,
  );
  await conn.run(
    `UPDATE agencies a
     SET lifetime_stops = COALESCE(t.lifetime_stops, 0)
     FROM (
       SELECT agency_slug, SUM(total)::BIGINT AS lifetime_stops
       FROM stops
       WHERE metric = 'stops'
       GROUP BY agency_slug
     ) t
     WHERE t.agency_slug = a.agency_slug`,
  );

  return conn;
};

export const getDb = (): Promise<DuckDBConnection> => {
  if (!connPromise) connPromise = init();
  return connPromise;
};

export const getLocatorSvg = async (): Promise<string> => {
  // Force the cold-start init to run; that populates locatorSvgCache as a
  // side effect of fetching everything in parallel.
  await getDb();
  if (!locatorSvgCache) {
    throw new Error("Locator SVG was not loaded at cold start.");
  }
  return locatorSvgCache;
};

export const resetDbForTesting = () => {
  connPromise = null;
  locatorSvgCache = null;
};
