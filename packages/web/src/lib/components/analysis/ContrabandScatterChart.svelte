<script>
  import { raceColor } from "./colors";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import ChartTooltip from "./ChartTooltip.svelte";

  // Graphic 4 — the outcome test, drawn abstractly. The axes are directional:
  // rightward = more searches, upward = more contraband found. Each race is one
  // bubble (area ∝ total stops); the story is the descending diagonal — the
  // more a group is searched, the *less* often those searches find contraband.
  // A single max tick on each axis gives a scale anchor; the rest of the detail
  // rides in each bubble's label.
  export let races; // RaceSummaryPoint[] (White / Black / Hispanic) — default set

  // Optional year toggle. When the article hands us >1 year of points, the
  // chart animates between them over a domain fixed across all years; labels
  // park at each race's mean position and leader-line to the moving dot, so
  // only the dots (and their readouts) change. Absent → static single year.
  export let byYear = null; // Record<number, RaceSummaryPoint[]>
  export let years = null; // number[]

  export let labels = {
    x: "More searches",
    y: "More contraband found",
    bubbleNote: "Bubble size ∝ total stops",
  };

  const RACE_ORDER = ["White", "Black", "Hispanic"];
  const orderPts = (pts) =>
    RACE_ORDER.map((race) => (pts ?? []).find((p) => p.race === race)).filter(Boolean);

  const sortedYears = years ? [...years].sort((a, b) => a - b) : [];
  const toggle = !!(byYear && sortedYears.length > 1);
  let selectedYear = toggle ? sortedYears[sortedYears.length - 1] : null;

  // Points whose meta (name, size, readout) the chart shows right now.
  $: activePts = orderPts(toggle ? byYear[selectedYear] : races);

  // Every point across every year fixes the domain, so bubbles move within a
  // stable frame instead of the axes rescaling under them.
  const allPts = toggle ? sortedYears.flatMap((yr) => orderPts(byYear[yr])) : orderPts(races);

  // Compact viewBox + full-width container: legible on a phone, fills the column.
  // Taller than wide so the three races — whose contraband rates sit close
  // together — get vertical room and their side labels don't cluster.
  const W = 390;
  const H = 345;
  const pad = { top: 22, right: 16, bottom: 40, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  // Constrain both axes to the data (with padding) for a clean diagonal; round
  // the top end so the single max tick reads as a sensible number.
  const PADX_LO = 0.5;
  const PADX_HI = 0.85;
  const PADY = 2;
  const xMin = Math.min(...allPts.map((r) => r.search_rate)) - PADX_LO;
  const xMaxTick = Math.ceil(Math.max(...allPts.map((r) => r.search_rate)));
  const xMax = Math.max(...allPts.map((r) => r.search_rate)) + PADX_HI;
  const yMin = Math.max(0, Math.min(...allPts.map((r) => r.contraband_hit_rate)) - PADY);
  // Anchor tick just above the top point rather than rounding to the next 5 —
  // rounding to 5 left ~a quarter of the vertical space empty and crammed the
  // labels together.
  const yMaxTick = Math.ceil(Math.max(...allPts.map((r) => r.contraband_hit_rate)));
  const yMax = yMaxTick + 1;

  const x = (v) => pad.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const y = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const maxStops = Math.max(...allPts.map((r) => r.total_stops));
  const r = (stops) => 10 + Math.sqrt(stops / maxStops) * 25;

  // Labels sit beside their dots along the diagonal: White and Black to the
  // right of theirs, Hispanic to the left of its — which keeps all three in the
  // open space around the descending diagonal without colliding.
  const place = (race, cx, cy, rad) => {
    if (race === "Hispanic") return { anchor: "end", bx: cx - rad - 8, name: cy - 14 };
    return { anchor: "start", bx: cx + rad + 8, name: cy - 14 };
  };

  // --- toggle mode: tweened positions + fixed leader-lined labels ----------
  const toMotion = (pts) =>
    orderPts(pts).map((p) => ({ sr: p.search_rate, chr: p.contraband_hit_rate }));
  const motion = tweened(toMotion(toggle ? byYear[selectedYear] : races), {
    duration: 650,
    easing: cubicOut,
  });
  $: if (toggle) motion.set(toMotion(byYear[selectedYear]));

  // Floating tooltip — positioned relative to the .tip-host wrapper.
  let tip = null;
  const showTip = (e, d) => {
    const host = e.currentTarget.closest(".tip-host");
    if (!host) return;
    const r = host.getBoundingClientRect();
    tip = {
      x: Math.max(90, Math.min(r.width - 90, e.clientX - r.left)),
      y: e.clientY - r.top,
      title: d.race,
      rows: [
        { label: "Searches / 100 stops", value: d.search_rate.toFixed(1), color: raceColor(d.race) },
        { label: "Contraband found", value: `${d.contraband_hit_rate.toFixed(0)}%` },
        { label: "Total stops", value: d.total_stops.toLocaleString() },
      ],
    };
  };
  const hideTip = () => (tip = null);
</script>

<div class="tip-host relative not-prose">
  {#if toggle}
    <div class="mb-1 flex items-center justify-end gap-2">
      <span class="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">Year</span>
      <div class="inline-flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Select year">
        {#each sortedYears as yr}
          <button
            type="button"
            class="px-3 py-1 text-sm font-semibold tabular-nums transition-colors {selectedYear === yr
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'}"
            aria-pressed={selectedYear === yr}
            on:click={() => (selectedYear = yr)}>{yr}</button>
        {/each}
      </div>
    </div>
  {/if}

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

    <!-- Bubbles + labels. Labels ride with their dots: in toggle mode the
         position comes from the tween, so the label stays glued to its bubble
         in every frame; the readout numbers snap to the selected year. -->
    {#each activePts as d, i}
      {@const cx = toggle ? x($motion[i].sr) : x(d.search_rate)}
      {@const cy = toggle ? y($motion[i].chr) : y(d.contraband_hit_rate)}
      {@const c = raceColor(d.race)}
      {@const rad = r(d.total_stops)}
      {@const p = place(d.race, cx, cy, rad)}
      <circle {cx} {cy} r={rad} fill={c} fill-opacity="0.16" stroke={c} stroke-width="2"
              on:pointermove={(e) => showTip(e, d)} on:pointerleave={hideTip} />
      <text x={p.bx} y={p.name} text-anchor={p.anchor} font-size="13.5" font-weight="700" fill={c}>{d.race}</text>
      <text x={p.bx} y={p.name + 15} text-anchor={p.anchor} font-size="11.5" fill="#475569">{d.search_rate.toFixed(1)} searches / 100 stops</text>
      <text x={p.bx} y={p.name + 29} text-anchor={p.anchor} font-size="11.5" fill="#475569">Contraband found: {d.contraband_hit_rate.toFixed(0)}%</text>
    {/each}
  </svg>
  <ChartTooltip {tip} />
</div>
