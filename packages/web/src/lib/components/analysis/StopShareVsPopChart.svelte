<script>
  import { raceColor } from "./colors";

  // Graphic 1 — small multiple, one panel per race. Each panel compares a
  // race's SHARE OF STOPS (solid, race color) against its share of the
  // driving-age (16+) population (dashed grey). Where the stop-share line sits
  // above the population line, that group is over-represented in stops.
  //
  // Every panel uses the SAME y-span (interval size) but a different offset, so
  // a one-point change looks identical in every panel (apples-to-apples slope)
  // while each line still fills its own panel.
  //
  // No top header: the race name rides at the end of its own (solid) line,
  // alongside the stops/pop end-of-line labels carried on every panel.
  export let metric; // race -> year -> { share_pct, pop_pct_16plus }
  export let years; // number[] available in the bundle
  export let races = ["White", "Black", "Hispanic"];
  export let startYear = 0; // 0 = show every year the bundle carries (~10 years)

  $: yrs = years.filter((y) => y >= startYear);

  // Wider-than-tall panels read better and stack shorter on mobile.
  const W = 304;
  const H = 180;
  const pad = { top: 16, right: 145, bottom: 26, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  $: n = yrs.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Bounds snap to multiples of SNAP so axis labels stay clean.
  const SNAP = 5;
  const PAD_FRAC = 0.06;

  const rangeFor = (race) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const y of yrs) {
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

  // One shared span across panels (apples-to-apples slope).
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
    const stops = yrs.map((y) => metric?.[race]?.[y]?.share_pct ?? null);
    const pop = yrs.map((y) => metric?.[race]?.[y]?.pop_pct_16plus ?? null);
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

  // Endpoint labels can collide within a narrow band; nudge them apart.
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

<div class="grid gap-6 sm:grid-cols-3 sm:gap-5">
  {#each panels as p, pi}
    {@const c = raceColor(p.race)}
    <div class={pi > 0 ? "border-t border-slate-200 pt-6 sm:border-0 sm:pt-0" : ""}>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- axes: y spine + bottom x line, with bound ticks -->
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
        <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
        <text x={pad.left - 6} y={pad.top + 4} text-anchor="end" font-size="9.5" fill="#64748b">{p.yMax}%</text>
        <text x={pad.left - 6} y={baseY} text-anchor="end" font-size="9.5" fill="#64748b">{p.yMin}%</text>

        <!-- year ticks: first + last -->
        {#each yrs as yr, i}
          {#if i === 0 || i === n - 1}
            <text x={x(i)} y={baseY + 16} text-anchor={i === 0 ? "start" : "end"} font-size="11" fill="#64748b">{yr}</text>
          {/if}
        {/each}

        <!-- population line (dashed grey) -->
        <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" points={linePts(p.pop, p)} />
        <!-- stop-share line (solid, race color) -->
        <polyline fill="none" stroke={c} stroke-width="2.5" points={linePts(p.stops, p)} />

        {#if p.stops[n - 1] != null}
          <circle cx={x(n - 1)} cy={yOf(p.stops[n - 1], p)} r="3.5" fill={c} />
        {/if}
        {#if p.pop[n - 1] != null}
          <circle cx={x(n - 1)} cy={yOf(p.pop[n - 1], p)} r="3" fill="#94a3b8" />
        {/if}

        <!-- end-of-line labels: race name + value on the stops line, value on
             the pop line — on every panel -->
        {#if p.stops[n - 1] != null && p.pop[n - 1] != null}
          {@const ys = endpointLabelYs(p.stops[n - 1], p.pop[n - 1], p)}
          <text x={x(n - 1) + 7} y={ys[0]} font-size="11" font-weight="700" fill={c}>{p.stops[n - 1].toFixed(1)}% {p.race} stops</text>
          <text x={x(n - 1) + 7} y={ys[1]} font-size="11" font-weight="600" fill="#64748b">{p.pop[n - 1].toFixed(1)}% {p.race} pop.</text>
        {/if}
      </svg>
    </div>
  {/each}
</div>
