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

// Pull the state outline path and the viewBox from the source SVG.
const viewBoxMatch = locatorSvg.match(/viewBox="([^"]+)"/);
const statePathMatch = locatorSvg.match(/<path class="state" d="([^"]+)"/);
if (!viewBoxMatch || !statePathMatch) {
  throw new Error("Failed to parse mo_locator.svg");
}
const VIEWBOX = viewBoxMatch[1];
const STATE_PATH = statePathMatch[1];

// Index centroid circles by slug. The SVG uses `data-slug` to tag them.
const centroidByslug = new Map();
const circleRe = /<circle[^>]*data-slug="([^"]+)"[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"/g;
let m;
while ((m = circleRe.exec(locatorSvg))) {
  centroidByslug.set(m[1], { cx: Number(m[2]), cy: Number(m[3]) });
}

// Build a small SVG showing just the state outline + an optional set of
// highlighted dots, then resvg-render to PNG and return a data URL.
const renderMapPng = (highlights = [], pxSize = 320) => {
  // Shrink dots when there are many so they breathe instead of merging
  // into a single blob. Single-agency highlight stays prominent.
  const n = highlights.length;
  const r = n <= 1 ? 0.18 : n <= 20 ? 0.13 : n <= 80 ? 0.1 : 0.08;
  const stroke = n <= 1 ? 0.05 : 0.025;
  const dots = highlights
    .map(
      ({ cx, cy }) => `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#047857" stroke="#ffffff" stroke-width="${stroke}" />
      `,
    )
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">
  <path d="${STATE_PATH}" fill="#f1f5f9" stroke="#0f172a" stroke-width="0.025" stroke-linejoin="round" />
  ${dots}
</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: pxSize } })
    .render()
    .asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
};

// Pre-render the no-highlight base map once — used for the home card and
// as a fallback when an agency isn't in the centroid index.
const baseMapDataUrl = renderMapPng([], 320);

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
  if (n <= 16) return 88;
  if (n <= 22) return 72;
  if (n <= 30) return 62;
  if (n <= 40) return 54;
  if (n <= 50) return 46;
  return 40;
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
  padding: 50px;
  background-image: url('${brandDataUrl}');
  background-size: 1200px 630px;
  font-family: 'Inter';
">
  <div style="
    display: flex;
    flex-direction: column;
    width: 1100px;
    height: 530px;
    background: #ffffff;
    border-radius: 28px;
    padding: 56px 64px;
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
      ">
        ${
          mapDataUrl
            ? `<img src="${mapDataUrl}" style="width: 280px; height: 280px;" />`
            : `<div style="display: flex; width: 280px; height: 280px;"></div>`
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
  const homeMapDataUrl = renderMapPng(allCentroids, 320);

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
  // Highlight every 287(g) participant on the inset map. Pulled from the
  // agency_index — agencies tagged as participants are flagged with a
  // truthy `agreement_287g_signed_date` or similar; fall back gracefully.
  let participantSlugs = [];
  try {
    const res = await fetch(`${CDN_BASE}${RELEASE_PATH}/dist/agency_index.json`);
    if (res.ok) {
      const agencies = await res.json();
      participantSlugs = agencies
        .filter((a) => a?.program_287g)
        .map((a) => a.agency_slug);
    }
  } catch {
    // best effort
  }
  const highlights = participantSlugs
    .map((slug) => centroidByslug.get(slug))
    .filter(Boolean);

  const mapDataUrl = highlights.length
    ? renderMapPng(highlights, 320)
    : baseMapDataUrl;

  const png = await renderToPng(
    card({
      eyebrow: "287(g) in Missouri",
      title: "How participating agencies stop Missourians",
      subtitle: "Stop volume, search and arrest rates, demographics.",
      stat: highlights.length ? String(highlights.length) : null,
      statLabel: highlights.length ? "agencies in the program" : null,
      mapDataUrl,
    }),
  );
  await writePng("287g.png", png);
  console.log(`✓ 287g.png (${highlights.length} participants mapped)`);
};

const buildAgency = async (agency) => {
  const name = agency.canonical_name || agency.agency_slug;
  const locationParts = [agency.city, agency.county].filter(Boolean);
  const location = locationParts.length ? locationParts.join(" · ") : "Missouri";
  const stops = Number(agency.stops ?? agency.all_stops_total ?? 0);
  const latestYear =
    Array.isArray(agency.years_with_data) && agency.years_with_data.length
      ? Math.max(...agency.years_with_data.map(Number).filter(Number.isFinite))
      : null;

  const centroid = centroidByslug.get(agency.agency_slug);
  const mapDataUrl = centroid
    ? renderMapPng([centroid], 320)
    : baseMapDataUrl;

  const png = await renderToPng(
    card({
      eyebrow: "Missouri Vehicle Stops",
      title: name,
      subtitle: location,
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
  const CONCURRENCY = 6;
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
