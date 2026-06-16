#!/usr/bin/env node
// Bake per-page Open Graph images.
//
// Usage:
//   pnpm bake:og                 # all agencies + 287g + home + analysis
//   pnpm bake:og --only 287g     # just that template
//   pnpm bake:og --only home
//   pnpm bake:og --only analysis
//   pnpm bake:og --only agencies
//   pnpm bake:og --slug missouri-state-highway-patrol
//   pnpm bake:og --limit 100     # for benchmarking — bake only the first N
//
// Concurrency: agency cards are rendered in a node:worker_threads pool.
// Pool size defaults to os.cpus().length; override with
// BAKE_OG_CONCURRENCY=N to tune.
//
// Output: packages/web/static/og/{home,287g,agency/{slug}}.png (gitignored)

import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

import { createAgencyBuilder } from "./bake-og-render.mjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, "..", "static");
const OUT_DIR = path.join(STATIC_DIR, "og");
const WORKER_PATH = path.join(__dirname, "bake-og-worker.mjs");

const CDN_BASE = process.env.PUBLIC_DATA_BASE_URL ?? "https://data.vsr.recoveredfactory.net";
const RELEASE_PATH = process.env.PUBLIC_DATA_RELEASE_PATH ?? "/releases/v2.2";
const SIZE = { width: 1200, height: 630 };

// ---------- args ----------

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const only = argValue("--only");
const slugFilter = argValue("--slug");
const limitArg = Number(argValue("--limit"));
const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : null;

// ---------- fonts ----------

const loadFont = async (weight) => {
  const filePath = require.resolve(
    `@fontsource/inter/files/inter-latin-${weight}-normal.woff`,
  );
  return readFile(filePath);
};

const [fontRegular, fontBold, fontBlack] = await Promise.all([
  loadFont(400),
  loadFont(700),
  loadFont(900),
]);

const fonts = [
  { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
  { name: "Inter", data: fontBold, weight: 700, style: "normal" },
  { name: "Inter", data: fontBlack, weight: 900, style: "normal" },
];

// ---------- background brand image ----------
//
// Resized once on startup to the card output size. The original CSS
// used `background-size: 1200px 630px`, so `fit: "fill"` matches that
// stretch behavior exactly. Held as a PNG buffer (not a data URL) so
// sharp can use it directly as the bottom of the composite.

const brandPngSrc = await readFile(path.join(STATIC_DIR, "social-meta.png"));
const brandPng = await sharp(brandPngSrc)
  .resize(SIZE.width, SIZE.height, { fit: "fill" })
  .png()
  .toBuffer();

// ---------- map svg: parse once ----------

const fetchText = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  return r.text();
};

const locatorSvg = await fetchText(`${CDN_BASE}${RELEASE_PATH}/dist/mo_locator.svg`);

const viewBoxMatch = locatorSvg.match(/viewBox="([^"]+)"/);
const statePathMatch = locatorSvg.match(/<path class="state" d="([^"]+)"/);
if (!viewBoxMatch || !statePathMatch) {
  throw new Error("Failed to parse mo_locator.svg");
}
const VIEWBOX = viewBoxMatch[1];
const STATE_PATH = statePathMatch[1];

// Interstates + US highways. State routes (420 more) would blanket
// the map in noise at 220 px wide.
const extractRoads = (className) => {
  const re = new RegExp(
    `<path[^>]*class="road ${className}"[^>]*\\bd="([^"]+)"`,
    "g",
  );
  const out = [];
  let mm;
  while ((mm = re.exec(locatorSvg))) out.push(mm[1]);
  return out;
};
const interstatePaths = extractRoads("interstate");
const usHighwayPaths = extractRoads("us-highway");
const ROADS_SVG =
  usHighwayPaths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#cbd5e1" stroke-width="0.016" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />`,
    )
    .join("") +
  interstatePaths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#94a3b8" stroke-width="0.024" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />`,
    )
    .join("");

// Per-agency jurisdiction polygons (county outlines for sheriffs,
// city outlines for municipal PDs, etc.). Each entry also carries the
// polygon's bounding-box size so the renderer can skip the polygon when
// it would be sub-pixel small (small-town city limits in a 300 px inset).
const jurisdictionBySlug = new Map();
const jurisRe = /<path[^>]*id="agency-([^"]+)"[^>]*\bd="([^"]+)"/g;
let jm;
while ((jm = jurisRe.exec(locatorSvg))) {
  const slug = jm[1];
  const d = jm[2];
  const nums = d.match(/-?\d+(?:\.\d+)?/g);
  let w = 0;
  let h = 0;
  if (nums && nums.length >= 4) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    w = maxX - minX;
    h = maxY - minY;
  }
  jurisdictionBySlug.set(slug, { d, maxDim: Math.max(w, h) });
}

const centroidByslug = new Map();
const circleRe = /<circle[^>]*data-slug="([^"]+)"[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"/g;
let m;
while ((m = circleRe.exec(locatorSvg))) {
  centroidByslug.set(m[1], { cx: Number(m[2]), cy: Number(m[3]) });
}

// ---------- pre-rasterize the base map per size ----------
//
// Used sizes: 300 (home + per-agency inset) and 260 (287g inset).
// Each base is held as both a raw RGBA buffer (for sharp composite when
// a highlight needs to go on top) and a finished PNG data URL (for the
// "no highlight" path).

const BASE_BG = "#ffffff";
const USED_SIZES = [260, 300];

const buildBaseSvg = () => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">
  <path d="${STATE_PATH}" fill="#f1f5f9" stroke="#0f172a" stroke-width="0.025" stroke-linejoin="round" />
  ${ROADS_SVG}
</svg>`;

const baseRasters = {};
const baseDataUrls = {};
for (const pxSize of USED_SIZES) {
  const img = new Resvg(buildBaseSvg(), {
    fitTo: { mode: "width", value: pxSize },
    background: BASE_BG,
  }).render();
  const pixels = Buffer.from(img.pixels);
  baseRasters[pxSize] = { pixels, width: img.width, height: img.height };
  const pngBuf = await sharp(pixels, {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
    .png()
    .toBuffer();
  baseDataUrls[pxSize] = `data:image/png;base64,${pngBuf.toString("base64")}`;
}

// ---------- shared render env ----------
//
// One bundle of state passed both into the in-process builder (used for
// home + 287g) and into each worker thread (used for agency cards).
// Buffers and Maps clone cleanly through structuredClone for workerData.

const renderEnv = {
  fonts,
  brandPng,
  viewbox: VIEWBOX,
  baseRasters,
  baseDataUrls,
  jurisdictionEntries: [...jurisdictionBySlug.entries()],
  centroidEntries: [...centroidByslug.entries()],
  outDir: OUT_DIR,
  size: SIZE,
};

const mainBuilder = createAgencyBuilder(renderEnv);
const { renderMapPng, renderToPng, card, writePng } = mainBuilder;

// ---------- per-page builders (main thread) ----------

const buildHome = async () => {
  // Headline stat = agencies that actually reported in the newest year in the
  // data — NOT every agency that has ever appeared. The cumulative count (all
  // ~769 agencies across 2001–latest) overstates how many are active today;
  // "agencies reporting in {latestYear}" is the honest "as of now" number.
  // The map dots are the subset of those agencies that have a geocoded
  // centroid (state-wide agencies have none).
  let totalAgencies = centroidByslug.size;
  let latestYear = null;
  let activeSlugs = null;
  try {
    const res = await fetch(`${CDN_BASE}${RELEASE_PATH}/dist/agency_index.json`);
    if (res.ok) {
      const agencies = await res.json();
      const years = agencies
        .map((a) => Number(a.latest_year_with_data))
        .filter(Number.isFinite);
      latestYear = years.length ? Math.max(...years) : null;
      if (latestYear != null) {
        const active = agencies.filter(
          (a) =>
            Array.isArray(a.years_with_data) &&
            a.years_with_data.map(Number).includes(latestYear),
        );
        totalAgencies = active.length;
        activeSlugs = new Set(active.map((a) => a.agency_slug));
      } else {
        totalAgencies = agencies.length;
      }
    }
  } catch {
    // best effort
  }
  const allCentroids = [...centroidByslug.entries()]
    .filter(([slug]) => !activeSlugs || activeSlugs.has(slug))
    .map(([, c]) => c);
  const homeMapDataUrl = await renderMapPng({ mode: "dots", dots: allCentroids }, 300);

  const png = await renderToPng(
    card({
      eyebrow: "Missouri Vehicle Stops",
      title: "Who gets stopped. Why. What happens next.",
      subtitle: "Traffic-stop data for every Missouri police agency.",
      stat: String(totalAgencies),
      statLabel: latestYear ? `agencies reporting in ${latestYear}` : "agencies tracked",
      mapDataUrl: homeMapDataUrl,
    }),
  );
  await writePng("home.png", png);
  console.log(
    `✓ home.png (${totalAgencies} agencies reporting in ${latestYear ?? "?"}, ${allCentroids.length} on map)`,
  );
};

const buildAnalysis = async () => {
  // OG card for the analysis articles. One per piece today; namespaced under
  // og/analysis/ so more articles can be added without collision. Strings are
  // hardcoded here (English) to match the other cards, which don't read from
  // Paraglide either. The map is decorative MO coverage, like the home card.
  const allCentroids = [...centroidByslug.values()];
  const mapDataUrl = await renderMapPng({ mode: "dots", dots: allCentroids }, 300);

  const png = await renderToPng(
    card({
      eyebrow: "Analysis",
      title: "First impressions of the 2025 Vehicle Stops Report",
      subtitle: "What the new Missouri data shows",
      stat: null,
      statLabel: null,
      mapDataUrl,
    }),
  );
  await writePng("analysis/first-impressions-2025.png", png);
  console.log("✓ analysis/first-impressions-2025.png");
};

const build287g = async () => {
  // Mirror the live /287g page's participant definition exactly: an
  // agency counts when `program_287g.agreements` is a non-empty array
  // (see packages/web/src/routes/287g/+page.server.ts). The earlier
  // truthy `program_287g` check would happen to match today, but the
  // page filter is the source of truth — keep them in lock-step.
  let participantSlugs = [];
  try {
    const res = await fetch(`${CDN_BASE}${RELEASE_PATH}/dist/agency_index.json`);
    if (res.ok) {
      const agencies = await res.json();
      participantSlugs = agencies
        .filter(
          (a) =>
            Array.isArray(a?.program_287g?.agreements) &&
            a.program_287g.agreements.length > 0,
        )
        .map((a) => a.agency_slug);
    }
  } catch {
    // best effort
  }
  // The map can only draw dots for participants with a centroid in
  // mo_locator.svg (state-wide agencies have none), so `highlights`
  // is a subset of `participantSlugs`. The headline stat shows the
  // full participant count to match the page.
  const highlights = participantSlugs
    .map((slug) => centroidByslug.get(slug))
    .filter(Boolean);

  const mapDataUrl = highlights.length
    ? await renderMapPng({ mode: "dots", dots: highlights }, 260)
    : baseDataUrls[300];

  const png = await renderToPng(
    card({
      eyebrow: "287(g) in Missouri",
      title: "How participating agencies stop Missourians",
      subtitle: "Stop volume, search and arrest rates, demographics.",
      stat: participantSlugs.length ? String(participantSlugs.length) : null,
      statLabel: participantSlugs.length ? "agencies in the program" : null,
      mapDataUrl,
    }),
  );
  await writePng("287g.png", png);
  console.log(
    `✓ 287g.png (${participantSlugs.length} participants, ${highlights.length} mapped)`,
  );
};

// ---------- agency cards via worker pool ----------

const buildAllAgencies = async () => {
  const url = `${CDN_BASE}${RELEASE_PATH}/dist/agency_index.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`agency_index.json fetch failed: ${res.status}`);
  let agencies = await res.json();
  if (slugFilter) {
    agencies = agencies.filter((a) => a.agency_slug === slugFilter);
    if (!agencies.length) {
      console.error(`No agency matched --slug ${slugFilter}`);
      process.exit(1);
    }
  }
  if (limit !== null) {
    agencies = agencies.slice(0, limit);
  }

  // Worker pool: each worker pays the per-process startup (font load,
  // sharp init) once and then handles many cards. resvg-js's render()
  // blocks the JS thread, so true parallelism only comes from running
  // multiple Node threads — hence worker_threads, not Promise.all.
  const envOverride = Number(process.env.BAKE_OG_CONCURRENCY);
  const poolSize = Number.isFinite(envOverride) && envOverride > 0
    ? Math.min(Math.floor(envOverride), agencies.length)
    : Math.min(os.cpus().length, agencies.length);

  console.log(
    `Baking ${agencies.length} agency cards across ${poolSize} worker${poolSize === 1 ? "" : "s"}…`,
  );
  const t0 = Date.now();

  const workers = Array.from(
    { length: poolSize },
    () => new Worker(WORKER_PATH, { workerData: renderEnv }),
  );

  let done = 0;
  const queue = [...agencies];

  const runWorker = (w) =>
    new Promise((resolveWorker, rejectWorker) => {
      const dispatchNext = () => {
        if (!queue.length) {
          w.postMessage({ shutdown: true });
          return;
        }
        const agency = queue.shift();
        w.postMessage({ agency });
      };

      w.on("message", (msg) => {
        if (msg?.error) {
          rejectWorker(new Error(msg.error));
          return;
        }
        done += 1;
        if (done % 25 === 0 || done === agencies.length) {
          process.stdout.write(`  ${done}/${agencies.length}\r`);
        }
        dispatchNext();
      });
      w.on("error", rejectWorker);
      w.on("exit", (code) => {
        if (code === 0) resolveWorker();
        else rejectWorker(new Error(`worker exited with code ${code}`));
      });

      dispatchNext();
    });

  try {
    await Promise.all(workers.map(runWorker));
  } catch (err) {
    for (const w of workers) w.terminate();
    throw err;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ ${agencies.length} agency cards in ${elapsed}s`);
};

// ---------- main ----------

await mkdir(OUT_DIR, { recursive: true });

if (only === "home" || !only) {
  await buildHome();
}
if (only === "287g" || !only) {
  await build287g();
}
if (only === "analysis" || !only) {
  await buildAnalysis();
}
if (only === "agencies" || !only) {
  await buildAllAgencies();
}

console.log(`\nOutput: ${OUT_DIR}`);
// resvg-js holds a worker thread that doesn't release on its own;
// force-exit so the script returns promptly.
process.exit(0);
