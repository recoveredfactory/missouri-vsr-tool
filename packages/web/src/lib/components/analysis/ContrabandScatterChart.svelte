<script>
  import { raceColor } from "./colors";

  // Graphic 4 — the outcome test, drawn abstractly. The axes are directional,
  // not numeric: rightward = more searches, upward = more contraband found.
  // Each race is one bubble (area ∝ total stops); the story is the descending
  // diagonal — the more a group is searched, the *less* often those searches
  // turn up contraband. Exact magnitudes ride in each bubble's own label.
  export let races; // RaceSummaryPoint[] (White / Black / Hispanic)
  export let labels = {
    x: "More searches",
    y: "More contraband found",
    bubbleNote: "Bubble size ∝ total stops",
  };

  const W = 660;
  const H = 440;
  const pad = { top: 48, right: 120, bottom: 58, left: 70 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  // Constrain BOTH axes to the data (with padding) rather than anchoring at 0,
  // so the three bubbles spread into a clean diagonal. The numbers that matter
  // are in the labels; the axes only carry direction.
  const PADX = 0.6;
  const PADY = 2.4;
  $: xMin = Math.min(...races.map((r) => r.search_rate)) - PADX;
  $: xMax = Math.max(...races.map((r) => r.search_rate)) + PADX;
  $: yMin = Math.max(0, Math.min(...races.map((r) => r.contraband_hit_rate)) - PADY);
  $: yMax = Math.max(...races.map((r) => r.contraband_hit_rate)) + PADY;

  const x = (v) => pad.left + ((v - xMin) / (xMax - xMin)) * plotW;
  $: y = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  $: maxStops = Math.max(...races.map((r) => r.total_stops));
  $: r = (stops) => 12 + Math.sqrt(stops / maxStops) * 30;

  // Label placement: push each label into the empty space around the diagonal
  // so they never collide. [dx, dy] are unit directions scaled by radius.
  const PLACE = {
    White: { anchor: "middle", dir: [0, -1] }, // above (top-left point)
    Black: { anchor: "end", dir: [-0.7, 1] }, // below-left (middle point)
    Hispanic: { anchor: "start", dir: [1, 0.15] }, // right (bottom-right point)
  };
  const place = (race) => PLACE[race] ?? { anchor: "middle", dir: [0, -1] };
</script>

<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <defs>
    <marker id="cb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
    </marker>
  </defs>

  <!-- directional axes (no numeric ticks) -->
  <line x1={pad.left} y1={baseY} x2={pad.left + plotW + 6} y2={baseY} stroke="#94a3b8" stroke-width="1.25" marker-end="url(#cb-arrow)" />
  <line x1={pad.left} y1={baseY} x2={pad.left} y2={pad.top - 6} stroke="#94a3b8" stroke-width="1.25" marker-end="url(#cb-arrow)" />

  <text x={pad.left + plotW / 2} y={H - 14} text-anchor="middle" font-size="13" font-weight="700" fill="#475569">{labels.x} →</text>
  <text transform="rotate(-90)" x={-(pad.top + plotH / 2)} y="18" text-anchor="middle" font-size="13" font-weight="700" fill="#475569">{labels.y} →</text>

  <text x={pad.left + plotW + 6} y={pad.top - 14} text-anchor="end" font-size="10" fill="#94a3b8" font-style="italic">{labels.bubbleNote}</text>

  <!-- bubbles + labels pushed into open space -->
  {#each races as d}
    {@const cx = x(d.search_rate)}
    {@const cy = y(d.contraband_hit_rate)}
    {@const c = raceColor(d.race)}
    {@const rad = r(d.total_stops)}
    {@const p = place(d.race)}
    {@const lx = cx + p.dir[0] * (rad + 12)}
    {@const ly = cy + p.dir[1] * (rad + 12)}
    <circle {cx} {cy} r={rad} fill={c} fill-opacity="0.16" stroke={c} stroke-width="2" />
    <text x={lx} y={ly} text-anchor={p.anchor} font-size="14.5" font-weight="700" fill={c}>{d.race}</text>
    <text x={lx} y={ly + 15} text-anchor={p.anchor} font-size="10.5" fill="#64748b">
      {d.search_rate.toFixed(1)} searches / 100 · {d.contraband_hit_rate.toFixed(0)}% found
    </text>
  {/each}
</svg>
