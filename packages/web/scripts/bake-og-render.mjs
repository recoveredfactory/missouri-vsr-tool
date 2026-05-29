// Render factory used by both the main bake script and worker threads.
//
// Given a bundle of shared, pre-loaded state (fonts, brand image, locator
// data, pre-rasterized base maps), returns a `buildAgency(agency)` that
// renders one per-agency Open Graph card and writes it to disk.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { html as htmlToVnode } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

export function createAgencyBuilder({
  fonts,
  brandPng,
  viewbox,
  baseRasters,
  baseDataUrls,
  jurisdictionEntries,
  centroidEntries,
  outDir,
  size,
}) {
  const VIEWBOX = viewbox;
  const SIZE = size;
  const OUT_DIR = outDir;
  const jurisdictionBySlug = new Map(jurisdictionEntries);
  const centroidByslug = new Map(centroidEntries);

  const baseMapDataUrl = baseDataUrls[300];

  const formatStops = (n) => {
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-US").format(Math.round(n));
  };

  const escapeHtml = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const titleSize = (s) => {
    const n = s.length;
    if (n <= 16) return 82;
    if (n <= 22) return 66;
    if (n <= 30) return 56;
    if (n <= 40) return 48;
    if (n <= 50) return 42;
    return 36;
  };

  const card = ({ eyebrow, title, subtitle, stat, statLabel, mapDataUrl }) => `
<div style="
  display: flex;
  width: 1200px;
  height: 630px;
  padding: 65px 105px;
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

  const renderMapPng = async (opts, pxSize = 300) => {
    const { mode = "none", dots = [], path: hlPath = null } = opts ?? {};

    let highlight = "";
    if (mode === "jurisdiction" && hlPath) {
      highlight = `<path d="${hlPath}" fill="#047857" stroke="#065f46" stroke-width="0.025" stroke-linejoin="round" opacity="0.9" />`;
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
    }
    if (!highlight) return baseDataUrls[pxSize];

    const base = baseRasters[pxSize];
    const overlaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">
  ${highlight}
</svg>`;
    const overlay = new Resvg(overlaySvg, {
      fitTo: { mode: "width", value: pxSize },
    }).render();

    const composed = await sharp(base.pixels, {
      raw: { width: base.width, height: base.height, channels: 4 },
    })
      .composite([
        {
          input: Buffer.from(overlay.pixels),
          raw: { width: overlay.width, height: overlay.height, channels: 4 },
          blend: "over",
        },
      ])
      .png()
      .toBuffer();
    return `data:image/png;base64,${composed.toString("base64")}`;
  };

  const renderToPng = async (htmlString) => {
    const vnode = htmlToVnode(htmlString);
    const svg = await satori(vnode, { ...SIZE, fonts });
    const cardImg = new Resvg(svg, {
      fitTo: { mode: "width", value: SIZE.width },
    }).render();
    return sharp(brandPng)
      .composite([
        {
          input: Buffer.from(cardImg.pixels),
          raw: { width: cardImg.width, height: cardImg.height, channels: 4 },
          blend: "over",
        },
      ])
      .png()
      .toBuffer();
  };

  const writePng = async (relPath, buffer) => {
    const out = path.join(OUT_DIR, relPath);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, buffer);
  };

  const buildAgency = async (agency) => {
    const name = agency.canonical_name || agency.agency_slug;
    const isStateAgency = agency.agency_type === "State Agency";

    const subtitle = isStateAgency ? null : agency.county || null;

    const stops = Number(agency.stops ?? agency.all_stops_total ?? 0);
    const latestYear =
      Array.isArray(agency.years_with_data) && agency.years_with_data.length
        ? Math.max(...agency.years_with_data.map(Number).filter(Number.isFinite))
        : null;

    const MIN_VISIBLE_DIM = 0.1;
    let mapDataUrl;
    if (isStateAgency) {
      mapDataUrl = baseMapDataUrl;
    } else {
      const jurisdiction = jurisdictionBySlug.get(agency.agency_slug);
      const centroid = centroidByslug.get(agency.agency_slug);
      const jurisdictionVisible = jurisdiction && jurisdiction.maxDim >= MIN_VISIBLE_DIM;
      if (jurisdictionVisible) {
        mapDataUrl = await renderMapPng({ mode: "jurisdiction", path: jurisdiction.d }, 300);
      } else if (centroid) {
        mapDataUrl = await renderMapPng({ mode: "dots", dots: [centroid] }, 300);
      } else if (jurisdiction) {
        mapDataUrl = await renderMapPng({ mode: "jurisdiction", path: jurisdiction.d }, 300);
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

  return { buildAgency, renderMapPng, renderToPng, card, writePng, formatStops };
}
