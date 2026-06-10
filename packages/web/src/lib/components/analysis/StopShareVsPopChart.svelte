<script>
  import { raceColor } from "./colors";

  // Graphic 1 — small multiple, one panel per race. Each panel compares a
  // race's SHARE OF STOPS against its share of the driving-age (16+)
  // population. Where the stop-share line sits above the population line, that
  // group is over-represented in stops.
  //
  // Every panel uses the SAME y-span (interval size) but a different offset —
  // e.g. 0–10, 10–20, 70–80 — so a one-point change looks identical in every
  // panel (apples-to-apples slope) while each line still fills its own panel.
  // Per-panel min/max labels keep the absolute level legible.
  //
  // NOTE: the analysis bundle currently carries only the years with an official
  // ACS population denominator (2023 and 2025), so this renders as a two-point
  // slopegraph. It upgrades to a full trend line the moment more years land.
  export let metric; // race -> year -> { share_pct, pop_pct_16plus }
  export let years; // number[] (e.g. [2023, 2025])
  export let races = ["White", "Black", "Hispanic"];
  export let labels = {
    stops: "Share of stops",
    pop: "Share of population (16+)",
  };

  const W = 240;
  const H = 220;
  const pad = { top: 22, right: 64, bottom: 30, left: 34 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  $: n = years.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Bounds snap to multiples of SNAP so axis labels stay clean; small padding
  // keeps lines off the panel edges.
  const SNAP = 5;
  const PAD_FRAC = 0.06;

  const rangeFor = (race) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const y of years) {
      const c = metric?.[race]?.[y];
      for (const v of [c?.share_pct, c?.pop_pct_16plus]) {
        if (v != null) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
    }
    return { lo, hi };
  };

  // One shared span across panels (apples-to-apples slope), tightened to the
  // data: the widest group's range + padding, rounded up to a multiple of SNAP.
  $: span = (() => {
    let maxRange = 0;
    for (const race of races) {
      const { lo, hi } = rangeFor(race);
      if (isFinite(lo)) maxRange = Math.max(maxRange, hi - lo);
    }
    const padded = maxRange * (1 + PAD_FRAC * 2);
    return Math.max(SNAP, Math.ceil(padded / SNAP) * SNAP);
  })();

  const buildPanel = (race, span) => {
    const stops = years.map((y) => metric?.[race]?.[y]?.share_pct ?? null);
    const pop = years.map((y) => metric?.[race]?.[y]?.pop_pct_16plus ?? null);
    const { lo, hi } = rangeFor(race);
    if (!isFinite(lo)) return { race, stops, pop, yMin: 0, yMax: span };
    const mid = (lo + hi) / 2;
    let yMin = Math.floor((mid - span / 2) / SNAP) * SNAP;
    if (hi > yMin + span) yMin = Math.ceil((hi - span) / SNAP) * SNAP; // ensure data fits
    if (yMin < 0) yMin = 0;
    return { race, stops, pop, yMin, yMax: yMin + span };
  };
  $: panels = races.map((race) => buildPanel(race, span));

  const yOf = (v, p) => pad.top + (1 - (v - p.yMin) / (p.yMax - p.yMin)) * plotH;
  const linePts = (vals, p) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${yOf(v, p)}`)).filter(Boolean).join(" ");

  // Endpoint labels can nearly overlap within a narrow band; nudge them apart.
  const MIN_GAP = 13;
  const endpointLabelYs = (stopV, popV, p) => {
    const sy = yOf(stopV, p) + 4;
    const py = yOf(popV, p) + 4;
    if (Math.abs(sy - py) >= MIN_GAP) return [sy, py];
    const mid = (sy + py) / 2;
    const half = MIN_GAP / 2;
    return sy <= py ? [mid - half, mid + half] : [mid + half, mid - half];
  };
</script>

<div class="grid gap-4 sm:grid-cols-3">
  {#each panels as p}
    {@const c = raceColor(p.race)}
    <div>
      <div class="mb-1 text-center text-sm font-bold" style="color:{c}">{p.race}</div>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- light y-axis: faint spine, bound ticks + labels (no gridlines) -->
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#e2e8f0" stroke-width="1" />
        <line x1={pad.left - 3} y1={pad.top} x2={pad.left} y2={pad.top} stroke="#cbd5e1" stroke-width="1" />
        <line x1={pad.left - 3} y1={pad.top + plotH} x2={pad.left} y2={pad.top + plotH} stroke="#cbd5e1" stroke-width="1" />
        <text x={pad.left - 6} y={pad.top + 4} text-anchor="end" font-size="10" fill="#94a3b8">{p.yMax}%</text>
        <text x={pad.left - 6} y={pad.top + plotH} text-anchor="end" font-size="10" fill="#94a3b8">{p.yMin}%</text>

        <!-- year ticks: first + last only (panels are narrow) -->
        {#each years as yr, i}
          {#if i === 0 || i === n - 1}
            <text x={x(i)} y={pad.top + plotH + 16} text-anchor={i === 0 ? "start" : "end"} font-size="11" fill="#94a3b8">{yr}</text>
          {/if}
        {/each}

        <!-- population line (dashed) -->
        <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" points={linePts(p.pop, p)} />
        <!-- stop-share line (solid, race color) -->
        <polyline fill="none" stroke={c} stroke-width="2.5" points={linePts(p.stops, p)} />

        {#each years as yr, i}
          {#if p.stops[i] != null}
            <circle cx={x(i)} cy={yOf(p.stops[i], p)} r="3.5" fill={c} />
          {/if}
          {#if p.pop[i] != null}
            <circle cx={x(i)} cy={yOf(p.pop[i], p)} r="3" fill="#94a3b8" />
          {/if}
        {/each}

        <!-- right-edge endpoint labels (nudged apart when they collide) -->
        {#if p.stops[n - 1] != null && p.pop[n - 1] != null}
          {@const ys = endpointLabelYs(p.stops[n - 1], p.pop[n - 1], p)}
          <text x={x(n - 1) + 6} y={ys[0]} font-size="11" font-weight="700" fill={c}>{p.stops[n - 1].toFixed(1)}%</text>
          <text x={x(n - 1) + 6} y={ys[1]} font-size="11" font-weight="600" fill="#64748b">{p.pop[n - 1].toFixed(1)}%</text>
        {/if}
      </svg>
    </div>
  {/each}
</div>

<div class="mt-2 flex justify-center gap-6 text-xs text-slate-500">
  <span class="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#475569" stroke-width="2.5" /></svg>{labels.stops}</span>
  <span class="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" /></svg>{labels.pop}</span>
</div>
