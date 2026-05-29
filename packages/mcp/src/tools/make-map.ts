import { Resvg } from "@resvg/resvg-js";
import { z } from "zod";

import {
  buildColorScale,
  colorScaleSwatches,
  type Palette,
} from "../colormap.js";
import { getLocatorSvg } from "../db.js";
import { errorResult, inputSchemaFromZod, registerTool, type ToolResult } from "./registry.js";

// Rendered PNG width in pixels. The Missouri locator SVG renders cleanly at
// this size; ~1400px gives readable agency dots without bloating the base64
// payload past the MCP image content limits typical chat clients enforce.
const PNG_WIDTH = 1400;

const cssEscape = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, "");

const MakeMapInput = z.object({
  values: z
    .record(z.string().min(1), z.number())
    .describe(
      "Map of agency_slug -> numeric value. Each matching <path id=\"agency-{slug}\"> in the locator SVG gets filled with the value's mapped color. Agencies not in this dict are rendered as a faint base layer.",
    ),
  title: z
    .string()
    .min(1)
    .max(140)
    .describe("Title rendered above the map. One short line."),
  palette: z
    .enum(["sequential", "diverging"])
    .optional()
    .describe(
      "Sequential (viridis-ish) for 'more is more' metrics like stop counts or shares. Diverging (red↔blue, centered on zero) for trend slopes or above/below-baseline ratios. Default sequential.",
    ),
  legend_label: z
    .string()
    .max(80)
    .optional()
    .describe("Optional unit label below the legend (e.g. 'percent', 'stops per year')."),
});

type MakeMapArgs = z.infer<typeof MakeMapInput>;

const formatLegendValue = (v: number) => {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(3);
};

const buildLegendSvg = (
  swatches: Array<{ value: number; color: string }>,
  label: string | undefined,
  domain: [number, number],
) => {
  // Legend is laid out in the SVG's existing coordinate system (Missouri-scaled,
  // negative-Y up because lat/lng). We compute reasonable absolute sizes by
  // sampling the viewBox dimensions at the call site, but for simplicity here
  // we render legend in a foreignObject overlay using viewBox-relative units.
  const swatchWidth = 24;
  const swatchHeight = 8;
  const totalWidth = swatchWidth * swatches.length;
  const gap = 2;
  const items = swatches
    .map(
      (s, i) =>
        `<rect x="${i * (swatchWidth + gap)}" y="0" width="${swatchWidth}" height="${swatchHeight}" fill="${s.color}" />`,
    )
    .join("");
  const ticks = `
    <text x="0" y="${swatchHeight + 12}" font-size="9" fill="#1f2937" text-anchor="start" font-family="Inter, ui-sans-serif, system-ui, sans-serif">${formatLegendValue(domain[0])}</text>
    <text x="${totalWidth}" y="${swatchHeight + 12}" font-size="9" fill="#1f2937" text-anchor="end" font-family="Inter, ui-sans-serif, system-ui, sans-serif">${formatLegendValue(domain[1])}</text>
  `;
  const labelLine = label
    ? `<text x="${totalWidth / 2}" y="${swatchHeight + 24}" font-size="8" fill="#475569" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif">${label}</text>`
    : "";
  return { width: totalWidth, height: swatchHeight + 28, svg: items + ticks + labelLine };
};

const makeMapHandler = async (raw: unknown): Promise<ToolResult> => {
  const parsed = MakeMapInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: MakeMapArgs = parsed.data;
  const palette: Palette = args.palette ?? "sequential";

  const entries = Object.entries(args.values).filter(([, v]) =>
    Number.isFinite(v),
  );
  if (entries.length === 0) {
    return errorResult(
      "No finite values provided. make_map needs at least one agency_slug → number mapping.",
    );
  }

  const scale = buildColorScale(
    entries.map(([, v]) => v),
    palette,
  );

  const cssRules: string[] = [
    // Base layer: faint fill for every agency polygon so unmapped areas still
    // read as part of the map.
    `.agency { fill: #f3f4f6; stroke: #ffffff; stroke-width: 0.002; }`,
    `.state { fill: none; stroke: #1f2937; stroke-width: 0.005; }`,
    `.road.interstate { stroke: #94a3b8; stroke-width: 0.004; fill: none; opacity: 0.55; }`,
    `.road.us-highway { stroke: #cbd5e1; stroke-width: 0.003; fill: none; opacity: 0.45; }`,
    `.road.state-highway { stroke: #e2e8f0; stroke-width: 0.002; fill: none; opacity: 0.35; }`,
    // Unhighlighted centroids: dim and small so highlighted agencies pop.
    // Many jurisdictions are too small for the boundary polygon to read at
    // this scale, so the centroid dot is the only signal a viewer can see.
    `.centroid { fill: #94a3b8; r: 0.008; opacity: 0.55; }`,
  ];
  const highlightSlugs = new Set<string>();
  for (const [slug, value] of entries) {
    const color = scale.colorFor(value);
    if (!color) continue;
    const safe = cssEscape(slug);
    cssRules.push(
      // Boundary polygon — colored fill + white outline for separation.
      `#agency-${safe} { fill: ${color}; stroke: #ffffff; stroke-width: 0.003; }`,
      // Matching centroid dot — same color, larger radius, dark outline so
      // it's visible whether the boundary is tiny or large.
      `circle.centroid[data-slug="${slug}"] { fill: ${color}; r: 0.022; stroke: #0f172a; stroke-width: 0.003; opacity: 1; }`,
    );
    highlightSlugs.add(slug);
  }

  const styleBlock = `<style type="text/css"><![CDATA[\n${cssRules.join("\n")}\n]]></style>`;

  let svg = await getLocatorSvg();

  // Inject style block right after the opening <svg ...> tag.
  svg = svg.replace(/(<svg\b[^>]*>)/, `$1\n${styleBlock}\n`);

  // resvg's CSS engine is reliable for class + id selectors but the
  // attribute selector `[data-slug="..."]` is fragile across versions. As a
  // belt-and-suspenders fallback, also inject inline style attributes on
  // each highlighted centroid so it renders even if the CSS rule above
  // doesn't bind.
  if (highlightSlugs.size > 0) {
    svg = svg.replace(
      /<circle\b([^>]*?)\bdata-slug="([^"]+)"([^>]*)\/>/g,
      (match, before: string, slug: string, after: string) => {
        if (!highlightSlugs.has(slug)) return match;
        const color = scale.colorFor(
          args.values[slug] as number,
        );
        if (!color) return match;
        // Strip the existing r= attribute since we want to override it.
        const cleanedBefore = before.replace(/\sr="[^"]*"/g, "");
        const cleanedAfter = after.replace(/\sr="[^"]*"/g, "");
        const inline = ` r="0.022" style="fill:${color};stroke:#0f172a;stroke-width:0.003;opacity:1;"`;
        return `<circle${cleanedBefore}data-slug="${slug}"${cleanedAfter}${inline}/>`;
      },
    );
  }

  // Build the title and legend as a foreignObject overlay positioned at the
  // top of the rendered SVG. We use the SVG's viewBox dimensions to size
  // and place the overlay.
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    return errorResult("Locator SVG missing viewBox attribute.");
  }
  const [vbX, vbY, vbW, vbH] = viewBoxMatch[1]
    .split(/\s+/)
    .map((s) => Number.parseFloat(s));
  if ([vbX, vbY, vbW, vbH].some((n) => !Number.isFinite(n))) {
    return errorResult("Locator SVG viewBox could not be parsed.");
  }

  // Reserve a band at the top for title + legend by expanding the viewBox
  // upward. New top edge sits above the existing one by a fraction of the
  // current height; everything inside the SVG keeps its coordinates.
  const titleBandHeight = vbH * 0.18;
  const newY = vbY - titleBandHeight;
  const newH = vbH + titleBandHeight;
  svg = svg.replace(
    /viewBox="[^"]+"/,
    `viewBox="${vbX} ${newY} ${vbW} ${newH}"`,
  );

  // Render the title and legend as native SVG inside the new top band so the
  // output stays a single self-contained SVG (no foreignObject, which not
  // every renderer handles well).
  const titleY = newY + titleBandHeight * 0.35;
  const swatches = colorScaleSwatches(scale, 7);

  const legend = buildLegendSvg(swatches, args.legend_label, scale.domain);
  const legendScale = (vbW * 0.5) / legend.width;
  const legendX = vbX + (vbW - legend.width * legendScale) / 2;
  const legendY = titleY + titleBandHeight * 0.15;

  const titleAndLegend = `
<g class="mcp-overlay">
  <text x="${vbX + vbW / 2}" y="${titleY}" text-anchor="middle"
        font-size="${titleBandHeight * 0.22}" font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        fill="#0f172a" font-weight="700">${escapeXml(args.title)}</text>
  <g transform="translate(${legendX} ${legendY}) scale(${legendScale})">
    ${legend.svg}
  </g>
</g>
`;
  svg = svg.replace(/(<\/svg>\s*)$/, `${titleAndLegend}$1`);

  // Rasterize the styled SVG to PNG. Most chat clients (Claude Desktop,
  // claude.ai) will not display SVG image content from MCP — only raster
  // formats — so we ship PNG as the primary image content and keep the
  // underlying SVG referenced in the text summary for callers that want to
  // save the vector original.
  let pngBase64: string;
  try {
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: PNG_WIDTH },
      background: "#ffffff",
      // resvg needs a real font to draw the title and legend ticks. Lambda's
      // Amazon Linux runtime ships DejaVu via fontconfig at /usr/share/fonts;
      // loadSystemFonts pulls those in. We do not list a default family
      // because the SVG itself names Inter / ui-sans-serif / system-ui /
      // sans-serif, and resvg falls through to the first one it can find.
      font: { loadSystemFonts: true },
    });
    pngBase64 = resvg.render().asPng().toString("base64");
  } catch (err) {
    return errorResult(
      `Failed to rasterize map SVG to PNG: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const summary = {
    map_format: "image/png",
    width_px: PNG_WIDTH,
    title: args.title,
    palette,
    legend_label: args.legend_label ?? null,
    domain: scale.domain,
    n_agencies_colored: entries.length,
    note: "Rasterized from the project's mo_locator.svg with CSS fill rules injected for each requested agency_slug. Unmapped agencies render as a faint base layer. PNG is returned as the image content; the underlying vector is regenerated on each call from the same data.",
  };

  return {
    content: [
      {
        type: "image",
        data: pngBase64,
        mimeType: "image/png",
      },
      {
        type: "text",
        text: JSON.stringify(summary, null, 2),
      },
    ],
  };
};

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });

registerTool({
  name: "make_map",
  description:
    "Renders a styled Missouri locator map highlighting the agencies you pass in. Takes a {agency_slug: numeric_value} dict plus a title; returns the project's mo_locator.svg with CSS fill rules injected for each matching <path id=\"agency-{slug}\">. Sequential palette for magnitude metrics (stop counts, shares), diverging palette for above/below-baseline metrics (trend slopes, ratios). Returns both the SVG itself (as image content) and a small text summary describing the legend domain.",
  inputSchema: inputSchemaFromZod(MakeMapInput),
  handler: makeMapHandler,
});
