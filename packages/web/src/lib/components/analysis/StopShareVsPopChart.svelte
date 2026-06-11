<script>
  import { raceColor } from "./colors";

  // Graphic 1 — small multiple, one panel per race. Each panel compares a
  // race's SHARE OF STOPS (solid, race color) against its share of the
  // driving-age (16+) population (dashed grey). Where the stop-share line sits
  // above the population line, that group is over-represented in stops.
  //
  // Each panel carries a header (race name) and a one-line readout of the
  // percentage-point change in each line over the window, so a reader can
  // directly compare how stop-share moved against population-share — the
  // whole point of the graphic. (The prose carries the relative framing.)
  //
  // Y-AXIS: each panel frames its OWN data (independent y-range), so a line
  // fills its panel instead of hugging one edge. The trade-off — slopes are NOT
  // comparable across panels — is called out in the figure caption.
  export let metric; // race -> year -> { share_pct, pop_pct_16plus }
  export let years; // number[] available in the bundle
  export let races = ["White", "Black", "Hispanic"];
  export let startYear = 0; // 0 = show every year the bundle carries (~10 years)

  $: yrs = years.filter((y) => y >= startYear);

  // Wider-than-tall panels read better and stack shorter on mobile.
  const W = 304;
  const H = 180;
  const pad = { top: 16, right: 84, bottom: 26, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  $: n = yrs.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Pick a "nice" rounding step that suits each panel's magnitude — coarse for
  // the big White share (steps of 5 → 70–85%), fine for the small Hispanic
  // share (steps of 1 → 1–5%) — so every panel hugs its own data instead of
  // snapping out to a common coarse grid.
  // Integer steps only: keeps axis labels short (e.g. "74%", not "72.5%") so
  // they don't overflow the narrow left margin and get clipped.
  const STEPS = [1, 2, 5, 10, 20, 50];
  const niceBounds = (lo, hi) => {
    const rawSpan = Math.max(hi - lo, 0.1);
    const padAmt = Math.max(rawSpan * 0.15, 0.3);
    const loP = lo - padAmt;
    const hiP = hi + padAmt;
    const span = hiP - loP;
    let step = STEPS[0];
    for (const s of STEPS) if (span / s >= 1.8) step = s;
    let yMin = Math.floor(loP / step) * step;
    let yMax = Math.ceil(hiP / step) * step;
    if (yMin < 0) yMin = 0;
    if (yMax <= yMin) yMax = yMin + step;
    return { yMin, yMax };
  };

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

  // Percentage-POINT change from first to last non-null value in a series (e.g.
  // a stop share that goes 2.2% → 3.8% returns +1.6). Null when uncomputable.
  const ptsChange = (vals) => {
    const first = vals.find((v) => v != null);
    const last = [...vals].reverse().find((v) => v != null);
    return first == null || last == null ? null : last - first;
  };
  const fmtPts = (v) =>
    v == null ? "—" : `${v >= 0 ? "↑ up" : "↓ down"} ${Math.abs(v).toFixed(1)} pts`;

  // Each panel frames its own data: pad the group's range and snap to SNAP.
  const buildPanel = (race) => {
    const stops = yrs.map((y) => metric?.[race]?.[y]?.share_pct ?? null);
    const pop = yrs.map((y) => metric?.[race]?.[y]?.pop_pct_16plus ?? null);
    const { lo, hi } = rangeFor(race);
    const change = { stops: ptsChange(stops), pop: ptsChange(pop) };
    if (!isFinite(lo)) return { race, stops, pop, change, yMin: 0, yMax: 5 };
    return { race, stops, pop, change, ...niceBounds(lo, hi) };
  };
  $: panels = races.map((race) => buildPanel(race));

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
      <div class="text-center text-[0.95rem] font-bold" style="color:{c}">{p.race}</div>
      <div class="mb-1 text-center text-[0.8rem] leading-tight text-slate-500">
        stops: <span class="font-bold" style="color:{c}">{fmtPts(p.change.stops)}</span>
        <span class="px-1 text-slate-300">|</span>
        pop: <span class="font-bold text-slate-600">{fmtPts(p.change.pop)}</span>
      </div>
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

        <!-- end-of-line value labels (race carried by the panel header) -->
        {#if p.stops[n - 1] != null && p.pop[n - 1] != null}
          {@const ys = endpointLabelYs(p.stops[n - 1], p.pop[n - 1], p)}
          <text x={x(n - 1) + 7} y={ys[0]} font-size="11" font-weight="700" fill={c}>{p.stops[n - 1].toFixed(1)}% stops</text>
          <text x={x(n - 1) + 7} y={ys[1]} font-size="11" font-weight="600" fill="#64748b">{p.pop[n - 1].toFixed(1)}% pop.</text>
        {/if}
      </svg>
    </div>
  {/each}
</div>
