#!/usr/bin/env node
// Bake per-page Open Graph images.
//
// Usage:
//   pnpm bake:og                 # all agencies + 287g + home
//   pnpm bake:og --only 287g     # just that template
//   pnpm bake:og --only home
//   pnpm bake:og --only agencies
//   pnpm bake:og --slug st-louis-metropolitan-police-dept
//
// Output:
//   packages/web/static/og/home.png
//   packages/web/static/og/287g.png
//   packages/web/static/og/agency/{slug}.png
//
// Output is gitignored. Re-run when data changes meaningfully or template
// changes — these don't need to update on every deploy.

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

// ---------- shared template chrome ----------

const formatStops = (n) => {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
};

// Inline-style HTML templates. satori-html parses the HTML and satori
// renders it to SVG. Only flexbox layout is supported — no grid, no
// floats, no overflow tricks. Tailwind doesn't work; use style="...".
const card = ({ eyebrow, title, subtitle, stat, statLabel }) => `
<div style="
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #ffffff;
  font-family: 'Inter';
  padding: 64px 72px;
  color: #0f172a;
">
  <div style="
    display: flex;
    align-items: center;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #047857;
    text-transform: uppercase;
  ">
    ${eyebrow}
  </div>

  <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center; padding-top: 32px;">
    <div style="
      display: flex;
      font-size: ${title.length > 36 ? 64 : title.length > 22 ? 76 : 88}px;
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
            margin-top: 18px;
            font-size: 30px;
            font-weight: 500;
            color: #475569;
          ">${escapeHtml(subtitle)}</div>`
        : ""
    }
  </div>

  <div style="display: flex; align-items: flex-end; justify-content: space-between;">
    <div style="display: flex; flex-direction: column;">
      ${
        stat
          ? `<div style="display: flex; font-size: 56px; font-weight: 900; color: #047857; letter-spacing: -0.02em;">${escapeHtml(stat)}</div>`
          : ""
      }
      ${
        statLabel
          ? `<div style="display: flex; font-size: 22px; color: #475569; margin-top: 4px;">${escapeHtml(statLabel)}</div>`
          : ""
      }
    </div>
    <div style="display: flex; font-size: 22px; font-weight: 600; color: #94a3b8;">
      vsr.recoveredfactory.net
    </div>
  </div>
</div>
`;

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ---------- render pipeline ----------

const renderToPng = async (htmlString) => {
  const vnode = htmlToVnode(htmlString);
  const svg = await satori(vnode, { ...SIZE, fonts });
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: SIZE.width },
  }).render().asPng();
  return png;
};

const writePng = async (relPath, buffer) => {
  const out = path.join(OUT_DIR, relPath);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, buffer);
};

// ---------- per-page builders ----------

const buildHome = async () => {
  const png = await renderToPng(
    card({
      eyebrow: "Missouri Vehicle Stops",
      title: "Who gets stopped. Why. What happens next.",
      subtitle: "Traffic-stop data for every Missouri police agency.",
      stat: null,
      statLabel: null,
    }),
  );
  await writePng("home.png", png);
  console.log("✓ home.png");
};

const build287g = async () => {
  // Pull the participant count straight from the data the page already
  // ships with — keeps the image honest if MOAs change.
  let participantCount = null;
  try {
    const res = await fetch(`${CDN_BASE}${RELEASE_PATH}/dist/287g_program.json`);
    if (res.ok) {
      const data = await res.json();
      participantCount = Array.isArray(data?.participants) ? data.participants.length : null;
    }
  } catch {
    // best-effort; fall through with null
  }

  const png = await renderToPng(
    card({
      eyebrow: "287(g) in Missouri",
      title: "How participating agencies stop Missourians",
      subtitle: "Stop volume, search and arrest rates, demographic breakdowns.",
      stat: participantCount !== null ? String(participantCount) : null,
      statLabel: participantCount !== null ? "agencies in the program" : null,
    }),
  );
  await writePng("287g.png", png);
  console.log("✓ 287g.png");
};

const buildAgency = async (agency) => {
  const name = agency.canonical_name || agency.agency_slug;
  const locationParts = [agency.city, agency.county].filter(Boolean);
  const location = locationParts.length ? locationParts.join(" · ") : "Missouri";
  const stops = Number(agency.stops ?? agency.all_stops_total ?? 0);
  const latestYear = Array.isArray(agency.years_with_data) && agency.years_with_data.length
    ? Math.max(...agency.years_with_data.map(Number).filter(Number.isFinite))
    : null;

  const png = await renderToPng(
    card({
      eyebrow: "Missouri Vehicle Stops",
      title: name,
      subtitle: location,
      stat: stops > 0 ? formatStops(stops) : null,
      statLabel: stops > 0
        ? `stops${latestYear ? ` in ${latestYear}` : ""}`
        : null,
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
  // Run a few in parallel — satori is CPU-bound so going wider helps
  // multi-core machines without overwhelming memory.
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
