<script>
  import { raceColor } from "./colors";

  // Graphic 4 — the outcome test, drawn abstractly. The axes are directional:
  // rightward = more searches, upward = more contraband found. Each race is one
  // bubble (area ∝ total stops); the story is the descending diagonal — the
  // more a group is searched, the *less* often those searches find contraband.
  // A single max tick on each axis gives a scale anchor; the rest of the detail
  // rides in each bubble's label.
  export let races; // RaceSummaryPoint[] (White / Black / Hispanic)
  export let labels = {
    x: "More searches",
    y: "More contraband found",
    bubbleNote: "Bubble size ∝ total stops",
  };

  // Compact viewBox + full-width container: legible on a phone, fills the column.
  const W = 390;
  const H = 300;
  const pad = { top: 22, right: 16, bottom: 40, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  // Constrain both axes to the data (with padding) for a clean diagonal; round
  // the top end so the single max tick reads as a sensible number.
  const PADX_LO = 0.5;
  const PADX_HI = 0.85;
  const PADY = 2;
  $: xMin = Math.min(...races.map((r) => r.search_rate)) - PADX_LO;
  $: xMaxTick = Math.ceil(Math.max(...races.map((r) => r.search_rate)));
  $: xMax = Math.max(...races.map((r) => r.search_rate)) + PADX_HI;
  $: yMin = Math.max(0, Math.min(...races.map((r) => r.contraband_hit_rate)) - PADY);
  $: yMaxTick = Math.ceil(Math.max(...races.map((r) => r.contraband_hit_rate)) / 5) * 5;
  $: yMax = yMaxTick + 1;

  const x = (v) => pad.left + ((v - xMin) / (xMax - xMin)) * plotW;
  $: y = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  $: maxStops = Math.max(...races.map((r) => r.total_stops));
  $: r = (stops) => 10 + Math.sqrt(stops / maxStops) * 25;

  // Labels sit beside their dots along the diagonal: White and Black to the
  // right of theirs, Hispanic to the left of its — which keeps all three in the
  // open space around the descending diagonal without colliding.
  const place = (race, cx, cy, rad) => {
    if (race === "Hispanic") return { anchor: "end", bx: cx - rad - 8, name: cy - 14 };
    return { anchor: "start", bx: cx + rad + 8, name: cy - 14 };
  };
</script>

<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <defs>
    <marker id="cb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
    </marker>
  </defs>

  <!-- directional axes -->
  <line x1={pad.left} y1={baseY} x2={pad.left + plotW + 6} y2={baseY} stroke="#94a3b8" stroke-width="1.25" marker-end="url(#cb-arrow)" />
  <line x1={pad.left} y1={baseY} x2={pad.left} y2={pad.top - 6} stroke="#94a3b8" stroke-width="1.25" marker-end="url(#cb-arrow)" />

  <!-- single max tick on each axis as a scale anchor -->
  <line x1={pad.left - 4} y1={y(yMaxTick)} x2={pad.left} y2={y(yMaxTick)} stroke="#94a3b8" stroke-width="1" />
  <text x={pad.left - 7} y={y(yMaxTick) + 4} text-anchor="end" font-size="11" fill="#94a3b8">{yMaxTick}%</text>
  <line x1={x(xMaxTick)} y1={baseY} x2={x(xMaxTick)} y2={baseY + 4} stroke="#94a3b8" stroke-width="1" />
  <text x={x(xMaxTick)} y={baseY + 16} text-anchor="middle" font-size="11" fill="#94a3b8">{xMaxTick} / 100</text>

  <text x={pad.left + plotW / 2} y={H - 8} text-anchor="middle" font-size="13" font-weight="700" fill="#475569">{labels.x} →</text>
  <text transform="rotate(-90)" x={-(pad.top + plotH / 2)} y="15" text-anchor="middle" font-size="13" font-weight="700" fill="#475569">{labels.y} →</text>

  <text x={pad.left + plotW} y={pad.top - 8} text-anchor="end" font-size="10.5" fill="#94a3b8" font-style="italic">{labels.bubbleNote}</text>

  <!-- bubbles + labels -->
  {#each races as d}
    {@const cx = x(d.search_rate)}
    {@const cy = y(d.contraband_hit_rate)}
    {@const c = raceColor(d.race)}
    {@const rad = r(d.total_stops)}
    {@const p = place(d.race, cx, cy, rad)}
    <circle {cx} {cy} r={rad} fill={c} fill-opacity="0.16" stroke={c} stroke-width="2" />
    <text x={p.bx} y={p.name} text-anchor={p.anchor} font-size="13.5" font-weight="700" fill={c}>{d.race}</text>
    <text x={p.bx} y={p.name + 15} text-anchor={p.anchor} font-size="11.5" fill="#475569">{d.search_rate.toFixed(1)} searches / 100 stops</text>
    <text x={p.bx} y={p.name + 29} text-anchor={p.anchor} font-size="11.5" fill="#475569">Contraband found: {d.contraband_hit_rate.toFixed(0)}%</text>
  {/each}
</svg>
