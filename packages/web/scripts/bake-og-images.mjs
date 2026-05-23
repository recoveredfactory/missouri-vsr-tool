#!/usr/bin/env node
// Bake per-page Open Graph images.
//
// Usage:
//   pnpm bake:og                 # all agencies + 287g + home
//   pnpm bake:og --only 287g     # just that template
//   pnpm bake:og --only home
//   pnpm bake:og --only agencies
//   pnpm bake:og --slug missouri-state-highway-patrol
//
// Output: packages/web/static/og/{home,287g,agency/{slug}}.png (gitignored)

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import satori from "satori";
import { html as htmlToVnode } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, "..", "static");
const OUT_DIR = path.join(STATIC_DIR, "og");

const CDN_BASE = process.env.PUBLIC_DATA_BASE_URL ?? "https://data.vsr.recoveredfactory.net";
const RELEASE_PATH = process.env.PUBLIC_DATA_RELEASE_PATH ?? "/releases/v2.1";
const SIZE = { width: 1200, height: 630 };

// ---------- args ----------

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const only = argValue("--only");
const slugFilter = argValue("--slug");

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

// ---------- background brand image (data URL) ----------

const brandPng = await readFile(path.join(STATIC_DIR, "social-meta.png"));
const brandDataUrl = `data:image/png;base64,${brandPng.toString("base64")}`;

// ---------- map svg: parse once, render per-agency on demand ----------

const fetchText = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  return r.text();
};

const locatorSvg = await fetchText(`${CDN_BASE}${RELEASE_PATH}/dist/mo_locator.svg`);

// Pull state outline, the roads group, and per-agency jurisdiction
// paths from the source SVG so we can render any subset we like.
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
  // Pull every numeric coordinate out of the path. The locator SVG only
  // uses absolute M/L commands with space-separated x y pairs, so we can
  // just collect all signed decimals and pair them up.
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

// Centroid points by slug.
const centroidByslug = new Map();
const circleRe = /<circle[^>]*data-slug="([^"]+)"[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"/g;
let m;
while ((m = circleRe.exec(locatorSvg))) {
  centroidByslug.set(m[1], { cx: Number(m[2]), cy: Number(m[3]) });
}

// ViewBox bounds, parsed once. SVG viewBox format is "minX minY w h" —
// we need these so embedded base PNGs can be placed in the same user
// coordinate system the highlight paths use (state-plane-ish lon/lat,
// not pixels).
const [VB_MIN_X, VB_MIN_Y, VB_W, VB_H] = VIEWBOX.split(/\s+/).map(Number);

// Pre-rasterize the base map (state outline + roads, no highlight) once
// per output size and cache the result. The expensive part of resvg's
// per-call work here is parsing the ~50 road paths in the source SVG;
// pre-rasterizing means each per-agency render just decodes a small PNG
// and overlays one circle or polygon on top.
const basePngBySize = new Map();
const getBase = (pxSize) => {
  const cached = basePngBySize.get(pxSize);
  if (cached) return cached;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">
  <path d="${STATE_PATH}" fill="#f1f5f9" stroke="#0f172a" stroke-width="0.025" stroke-linejoin="round" />
  ${ROADS_SVG}
</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: pxSize } })
    .render()
    .asPng();
  const entry = {
    buffer: png,
    dataUrl: `data:image/png;base64,${png.toString("base64")}`,
  };
  basePngBySize.set(pxSize, entry);
  return entry;
};

// Render a mini-map at the given pixel size. `mode`:
//   "none"        — state outline + roads, no highlight
//   "dots"        — state + roads + a list of centroid dots
//   "jurisdiction"— state + roads + one filled polygon
//
// For modes with a highlight, we compose by stacking the pre-rasterized
// base PNG (via <image>) under the highlight in a tiny SVG. resvg only
// has to decode the embedded PNG and rasterize the overlay — much
// cheaper than re-parsing the full base every call.
const renderMapPng = (opts, pxSize = 300) => {
  const { mode = "none", dots = [], path = null } = opts ?? {};
  const base = getBase(pxSize);
  if (mode === "none") return base.dataUrl;

  let highlight = "";
  if (mode === "jurisdiction" && path) {
    highlight = `<path d="${path}" fill="#047857" stroke="#065f46" stroke-width="0.025" stroke-linejoin="round" opacity="0.9" />`;
  } else if (mode === "dots" && dots.length) {
    const n = dots.length;
    const r = n <= 1 ? 0.18 : n <= 20 ? 0.13 : n <= 80 ? 0.1 : 0.08;
    const stroke = n <= 1 ? 0.05 : 0.025;
    highlight = dots
      .map(
        ({ cx, cy }) =>
          `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#047857" stroke="#ffffff" stroke-width="${stroke}" />`,
      )
      .join("");
  } else {
    return base.dataUrl;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">
  <image href="${base.dataUrl}" x="${VB_MIN_X}" y="${VB_MIN_Y}" width="${VB_W}" height="${VB_H}" preserveAspectRatio="xMidYMid meet" />
  ${highlight}
</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: pxSize } })
    .render()
    .asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
};

// Pre-rendered no-highlight base — used for the home card and as a
// fallback when an agency has neither a jurisdiction nor a centroid.
const baseMapDataUrl = getBase(300).dataUrl;

// ---------- helpers ----------

const formatStops = (n) => {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
};

// HTML-parser safety only. Apostrophes and double quotes are valid
// inside text nodes, so leaving them alone keeps "Sheriff's Office"
// rendering correctly instead of as "Sheriff&#39;s Office".
const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Pick a title font size based on character count so long agency names
// don't overflow the (~660 px) text column. Tuned so most titles wrap
// to two lines and the stat block always fits below.
const titleSize = (s) => {
  const n = s.length;
  if (n <= 16) return 82;
  if (n <= 22) return 66;
  if (n <= 30) return 56;
  if (n <= 40) return 48;
  if (n <= 50) return 42;
  return 36;
};

// ---------- card template ----------

const card = ({
  eyebrow,
  title,
  subtitle,
  stat,
  statLabel,
  mapDataUrl,
}) => `
<div style="
  display: flex;
  width: 1200px;
  height: 630px;
  padding: 65px 105px;
  background-image: url('${brandDataUrl}');
  background-size: 1200px 630px;
  font-family: 'Inter';
">
  <div style="
    display: flex;
    flex-direction: column;
    width: 990px;
    height: 500px;
    background: #ffffff;
    border-radius: 28px;
    padding: 52px 56px;
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.25);
  ">
    <div style="
      display: flex;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: #047857;
      text-transform: uppercase;
    ">
      ${escapeHtml(eyebrow)}
    </div>

    <div style="display: flex; flex-grow: 1; padding-top: 32px;">
      <div style="
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-width: 0;
        padding-right: 40px;
      ">
        <div style="
          display: flex;
          font-size: ${titleSize(title)}px;
          font-weight: 900;
          line-height: 1.05;
          color: #0f172a;
          letter-spacing: -0.02em;
        ">
          ${escapeHtml(title)}
        </div>
        ${
          subtitle
            ? `<div style="
                display: flex;
                margin-top: 14px;
                font-size: 28px;
                font-weight: 500;
                color: #475569;
              ">${escapeHtml(subtitle)}</div>`
            : ""
        }

        <div style="display: flex; flex-grow: 1;"></div>

        ${
          stat
            ? `<div style="display: flex; flex-direction: column;">
                <div style="
                  display: flex;
                  font-size: 116px;
                  font-weight: 900;
                  line-height: 1;
                  color: #047857;
                  letter-spacing: -0.03em;
                ">${escapeHtml(stat)}</div>
                ${
                  statLabel
                    ? `<div style="display: flex; margin-top: 8px; font-size: 26px; color: #475569;">${escapeHtml(statLabel)}</div>`
                    : ""
                }
              </div>`
            : ""
        }
      </div>

      <div style="
        display: flex;
        flex-direction: column;
        width: 280px;
        flex-shrink: 0;
        align-items: flex-end;
        justify-content: space-between;
        padding-top: 4px;
      ">
        ${
          mapDataUrl
            ? `<img src="${mapDataUrl}" style="width: 270px; height: 270px;" />`
            : `<div style="display: flex; width: 270px; height: 270px;"></div>`
        }
        <div style="display: flex; font-size: 20px; font-weight: 600; color: #94a3b8;">
          vsr.recoveredfactory.net
        </div>
      </div>
    </div>
  </div>
</div>
`;

// ---------- render pipeline ----------

const renderToPng = async (htmlString) => {
  const vnode = htmlToVnode(htmlString);
  const svg = await satori(vnode, { ...SIZE, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: SIZE.width } })
    .render()
    .asPng();
};

const writePng = async (relPath, buffer) => {
  const out = path.join(OUT_DIR, relPath);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, buffer);
};

// ---------- per-page builders ----------

const buildHome = async () => {
  // Use the real agency count for the stat — the map only shows agencies
  // with geocoded centroids (state-wide agencies have none), but the
  // dataset as a whole covers more.
  let totalAgencies = centroidByslug.size;
  try {
    const res = await fetch(`${CDN_BASE}${RELEASE_PATH}/dist/agency_index.json`);
    if (res.ok) {
      const agencies = await res.json();
      totalAgencies = agencies.length;
    }
  } catch {
    // best effort
  }
  const allCentroids = [...centroidByslug.values()];
  const homeMapDataUrl = renderMapPng({ mode: "dots", dots: allCentroids }, 300);

  const png = await renderToPng(
    card({
      eyebrow: "Missouri Vehicle Stops",
      title: "Who gets stopped. Why. What happens next.",
      subtitle: "Traffic-stop data for every Missouri police agency.",
      stat: String(totalAgencies),
      statLabel: "agencies tracked",
      mapDataUrl: homeMapDataUrl,
    }),
  );
  await writePng("home.png", png);
  console.log(`✓ home.png (${totalAgencies} agencies, ${centroidByslug.size} on map)`);
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
    ? renderMapPng({ mode: "dots", dots: highlights }, 260)
    : baseMapDataUrl;

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

const buildAgency = async (agency) => {
  const name = agency.canonical_name || agency.agency_slug;
  const isStateAgency = agency.agency_type === "State Agency";

  // Subtitle: county only — town gets dropped per request. Skip
  // entirely for state agencies (their reach is the whole map).
  const subtitle = isStateAgency ? null : agency.county || null;

  const stops = Number(agency.stops ?? agency.all_stops_total ?? 0);
  const latestYear =
    Array.isArray(agency.years_with_data) && agency.years_with_data.length
      ? Math.max(...agency.years_with_data.map(Number).filter(Number.isFinite))
      : null;

  // Map highlight priority: jurisdiction polygon (county/city outline)
  // → centroid dot → nothing. State agencies always get the bare map.
  // Tiny polygons (small-town city limits) fall through to the centroid
  // because their fill would render sub-pixel in a 300 px inset.
  // Threshold is in viewBox units; the locator viewBox is ~5.24 wide, so
  // 0.1 units ≈ 6 px at 300 px output — below that the polygon is
  // invisible and the dot is what readers actually see.
  const MIN_VISIBLE_DIM = 0.1;
  let mapDataUrl;
  if (isStateAgency) {
    mapDataUrl = baseMapDataUrl;
  } else {
    const jurisdiction = jurisdictionBySlug.get(agency.agency_slug);
    const centroid = centroidByslug.get(agency.agency_slug);
    const jurisdictionVisible = jurisdiction && jurisdiction.maxDim >= MIN_VISIBLE_DIM;
    if (jurisdictionVisible) {
      mapDataUrl = renderMapPng({ mode: "jurisdiction", path: jurisdiction.d }, 300);
    } else if (centroid) {
      mapDataUrl = renderMapPng({ mode: "dots", dots: [centroid] }, 300);
    } else if (jurisdiction) {
      // Polygon exists but is sub-pixel and there's no centroid — render
      // it anyway rather than dropping the highlight entirely.
      mapDataUrl = renderMapPng({ mode: "jurisdiction", path: jurisdiction.d }, 300);
    } else {
      mapDataUrl = baseMapDataUrl;
    }
  }

  const png = await renderToPng(
    card({
      eyebrow: "Missouri Vehicle Stops",
      title: name,
      subtitle,
      stat: stops > 0 ? formatStops(stops) : null,
      statLabel: stops > 0
        ? `stops${latestYear ? ` in ${latestYear}` : ""}`
        : null,
      mapDataUrl,
    }),
  );
  await writePng(`agency/${agency.agency_slug}.png`, png);
};

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
  console.log(`Baking ${agencies.length} agency cards…`);
  const t0 = Date.now();
  let done = 0;
  // resvg-js releases the JS thread during native rasterization, so
  // Promise.all'd renderers actually run on separate cores. Per card
  // we do one satori call (pure JS, queued on the single event loop)
  // plus two resvg calls (each grabs a core). Steady state we want
  // enough in flight that there's always one in satori plus most cores
  // busy in resvg — cpus + a small slack is the sweet spot. More than
  // that just buys queueing and memory pressure with no extra throughput.
  // Override with BAKE_OG_CONCURRENCY for one-off tuning.
  const envConcurrency = Number(process.env.BAKE_OG_CONCURRENCY);
  const CONCURRENCY = Number.isFinite(envConcurrency) && envConcurrency > 0
    ? Math.floor(envConcurrency)
    : Math.max(4, os.cpus().length + 4);
  console.log(`  concurrency: ${CONCURRENCY}`);
  const queue = [...agencies];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const a = queue.shift();
        await buildAgency(a);
        done += 1;
        if (done % 25 === 0 || done === agencies.length) {
          process.stdout.write(`  ${done}/${agencies.length}\r`);
        }
      }
    }),
  );
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
if (only === "agencies" || !only) {
  await buildAllAgencies();
}

console.log(`\nOutput: ${OUT_DIR}`);
// resvg-js holds a worker thread that doesn't release on its own;
// force-exit so the script returns promptly.
process.exit(0);
