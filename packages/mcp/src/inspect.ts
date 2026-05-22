import { DuckDBInstance } from "@duckdb/node-api";

const PARQUET_URL =
  "https://data.vsr.recoveredfactory.net/releases/v2.1/downloads/missouri_vsr_2000_2024_vsr_statistics.parquet";

// Reuse the http/1.1 downloader from db.ts behaviorally — but skip for now
// since we have /tmp/vsr-full-retry.parquet already.
const LOCAL = "/tmp/vsr-full-retry.parquet";

const main = async () => {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  // Look at all the variants of "arrests" for the MO Highway Patrol in 2024
  const r = await conn.runAndReadAll(`
    SELECT * FROM read_parquet('${LOCAL}')
    WHERE agency = 'Missouri State Highway Patrol'
      AND year = 2024
      AND canonical_key = 'arrests'
  `);

  const cols = r.columnNames();
  for (const row of r.getRows()) {
    console.log("---");
    cols.forEach((c, i) => {
      const v = row[i];
      if (v === null || v === undefined) return;
      const s =
        typeof v === "bigint"
          ? `${v.toString()}n`
          : typeof v === "object"
            ? JSON.stringify(v, (_, val) =>
                typeof val === "bigint" ? val.toString() : val,
              )
            : String(v);
      console.log(`  ${c}: ${s}`);
    });
  }

  await conn.disconnectSync();
  void PARQUET_URL;
};

main().catch(console.error);
