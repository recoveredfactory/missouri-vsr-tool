// Worker thread for bake-og-images.mjs. Receives one agency at a time
// from the parent, renders + writes its OG card, and posts back a
// completion marker (or an error). Initialization happens once from
// `workerData` so the heavy assets (fonts, brand PNG, base rasters)
// are paid for once per worker, not per card.

import { parentPort, workerData } from "node:worker_threads";
import { createAgencyBuilder } from "./bake-og-render.mjs";

const { buildAgency } = createAgencyBuilder(workerData);

parentPort.on("message", async (msg) => {
  if (msg?.shutdown) {
    process.exit(0);
  }
  const agency = msg?.agency;
  if (!agency) {
    parentPort.postMessage({ error: "no agency in message" });
    return;
  }
  try {
    await buildAgency(agency);
    parentPort.postMessage({ ok: agency.agency_slug });
  } catch (err) {
    parentPort.postMessage({
      error: `${agency.agency_slug}: ${err?.message ?? String(err)}`,
    });
  }
});
