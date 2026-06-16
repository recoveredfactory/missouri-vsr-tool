<script>
  import { raceColor } from "./colors";
  import ChartTooltip from "./ChartTooltip.svelte";

  // Graphic 1 — small multiple, one panel per race. Each panel compares a
  // race's SHARE OF STOPS (solid, race color) against its share of the
  // driving-age (16+) population (dashed grey). Where the stop-share line sits
  // above the population line, that group is over-represented in stops.
  //
  // Y-AXIS: defaults to a SHARED range across panels (slopes are comparable;
  // the big White share and the tiny Hispanic share are drawn at true relative
  // scale, so the small lines look flat and the change readout does the work).
  // A selector switches to a per-panel "fit" range, where each line fills its
  // own panel but slopes are no longer comparable across panels.
  export let metric; // race -> year -> { share_pct, pop_pct_16plus }
  export let years; // number[] available in the bundle
  export let races = ["White", "Black", "Hispanic"];
  export let startYear = 0; // 0 = show every year the bundle carries (~10 years)

  let sharedScale = true; // default: one comparable scale across all panels

  $: yrs = years.filter((y) => y >= startYear);

  // Taller-than-before panels (more vertical room on desktop). Generous right
  // margin keeps the end-of-line labels inside the viewBox on a phone.
  const W = 326;
  const H = 212;
  const pad = { top: 16, right: 106, bottom: 28, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  $: n = yrs.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Per-panel "fit": pick a nice integer step suited to the panel's magnitude
  // so each line hugs its own data instead of snapping to a common coarse grid.
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

  // Shared scale = one common SPAN (the same number of points per panel), each
  // window centered on that race's own band. Slopes are directly comparable
  // across panels, but the lines still fill their panel (a 1-point move looks
  // the same size everywhere) instead of being flattened onto a 0–90% axis.
  $: sharedSpan = (() => {
    let maxRange = 0;
    for (const race of races) {
      const r = rangeFor(race);
      if (isFinite(r.lo)) maxRange = Math.max(maxRange, r.hi - r.lo);
    }
    return Math.max(2, Math.ceil((maxRange * 1.3) / 2) * 2); // headroom, snapped even
  })();
  const sharedWindow = (lo, hi, span) => {
    let yMin = Math.floor((lo + hi) / 2 - span / 2);
    if (yMin < 0) yMin = 0;
    return { yMin, yMax: yMin + span };
  };

  // Relative change from first to last non-null value in a series.
  const pctChange = (vals) => {
    const first = vals.find((v) => v != null);
    const last = [...vals].reverse().find((v) => v != null);
    return first == null || last == null || first === 0 ? null : ((last - first) / first) * 100;
  };
  // Sentence-style change readout that reads like talk: "up 72%" / "down 5%" /
  // "flat" — slotted into "Stops up 72% and pop. up 41% since 2016".
  const fmtPct = (v) =>
    v == null ? "—" : Math.round(Math.abs(v)) === 0 ? "flat" : `${v >= 0 ? "up" : "down"} ${Math.round(Math.abs(v))}%`;

  const buildPanel = (race, shared, span) => {
    const stops = yrs.map((y) => metric?.[race]?.[y]?.share_pct ?? null);
    const pop = yrs.map((y) => metric?.[race]?.[y]?.pop_pct_16plus ?? null);
    const { lo, hi } = rangeFor(race);
    const change = { stops: pctChange(stops), pop: pctChange(pop) };
    const bounds = !isFinite(lo)
      ? { yMin: 0, yMax: 5 }
      : shared
        ? sharedWindow(lo, hi, span)
        : niceBounds(lo, hi);
    return { race, stops, pop, change, ...bounds };
  };
  // sharedScale + sharedSpan referenced here so the toggle recomputes panels.
  $: panels = races.map((race) => buildPanel(race, sharedScale, sharedSpan));

  const yOf = (v, p) => pad.top + (1 - (v - p.yMin) / (p.yMax - p.yMin)) * plotH;
  const linePts = (vals, p) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${yOf(v, p)}`)).filter(Boolean).join(" ");

  // End labels share the same column; nudge them apart if they'd collide.
  const MIN_GAP = 14;
  const endYs = (stopV, popV, p) => {
    const sy = yOf(stopV, p) + 4;
    const py = yOf(popV, p) + 4;
    if (Math.abs(sy - py) >= MIN_GAP) return [sy, py];
    const mid = (sy + py) / 2;
    const half = MIN_GAP / 2;
    return sy <= py ? [mid - half, mid + half] : [mid + half, mid - half];
  };
  // Start labels: when the lines sit far enough apart, the POPULATION label
  // rides on the OUTER side (away from the stop-share line) and the stop-share
  // label tucks toward it — so the Black stop-share label sits below its line
  // (stops on top) and the White stop-share label sits above its line (stops
  // below). When the lines crowd together, spread the pair outward so the two
  // never collide. Returns [stopY, popY].
  const startYs = (stopV, popV, p) => {
    const s = yOf(stopV, p);
    const q = yOf(popV, p);
    const stopsUpper = s < q;
    if (Math.abs(s - q) >= 30) {
      const stopY = stopsUpper ? s + 13 : s - 6; // toward population
      const popY = stopsUpper ? q + 13 : q - 6; // away from stops
      return [stopY, popY];
    }
    const stopY = stopsUpper ? s - 6 : s + 13;
    const popY = stopsUpper ? q + 13 : q - 6;
    return [stopY, popY];
  };

  // Floating tooltip + vertical locator, relative to the hovered panel.
  let tip = null;
  const showTip = (e, pi, payload) => {
    const host = e.currentTarget.closest(".tip-host");
    if (!host) return;
    const r = host.getBoundingClientRect();
    tip = {
      pi,
      x: Math.max(72, Math.min(r.width - 72, e.clientX - r.left)),
      y: e.clientY - r.top,
      ...payload,
    };
  };
  const hideTip = () => (tip = null);
  const tipRows = (p, i) => [
    { label: "Share of stops", value: p.stops[i] != null ? `${p.stops[i].toFixed(1)}%` : "—", color: raceColor(p.race) },
    { label: "Share of population", value: p.pop[i] != null ? `${p.pop[i].toFixed(1)}%` : "—", color: "#94a3b8" },
  ];

  $: yearTick = (yr, i) => i === 0 || i === n - 1 || yr % 3 === 0;
</script>

<div class="not-prose mb-3 flex items-center justify-end gap-2 text-xs">
  <span class="font-medium uppercase tracking-wide text-slate-400">Vertical scale</span>
  <div class="inline-flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Vertical scale">
    <button type="button" class="px-2.5 py-1 font-semibold transition-colors {sharedScale ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}"
            aria-pressed={sharedScale} on:click={() => (sharedScale = true)}>Same scale</button>
    <button type="button" class="px-2.5 py-1 font-semibold transition-colors {!sharedScale ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}"
            aria-pressed={!sharedScale} on:click={() => (sharedScale = false)}>Fit each</button>
  </div>
</div>

<div class="grid gap-6 sm:grid-cols-3 sm:gap-5">
  {#each panels as p, pi}
    {@const c = raceColor(p.race)}
    <div class="tip-host relative {pi > 0 ? 'border-t border-slate-200 pt-6 sm:border-0 sm:pt-0' : ''}">
      <div class="text-center text-[1.05rem] font-bold" style="color:{c}">{p.race}</div>
      <div class="mb-1 text-center text-[0.875rem] leading-tight text-slate-500">
        Stops <span class="font-bold" style="color:{c}">{fmtPct(p.change.stops)}</span>
        and pop. <span class="font-bold text-slate-600">{fmtPct(p.change.pop)}</span>
        since {yrs[0]}
      </div>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- vertical locator (behind the data) -->
        {#if tip && tip.pi === pi && tip.lx != null}
          <line x1={tip.lx} y1={pad.top} x2={tip.lx} y2={baseY} stroke="#94a3b8" stroke-width="1" opacity="0.55" />
        {/if}

        <!-- axes: y spine + bottom x line, with bound ticks -->
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={baseY} stroke="#94a3b8" stroke-width="1" />
        <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#94a3b8" stroke-width="1" />
        <text x={pad.left - 6} y={pad.top + 4} text-anchor="end" font-size="9.5" fill="#64748b">{p.yMax}%</text>
        <text x={pad.left - 6} y={baseY} text-anchor="end" font-size="9.5" fill="#64748b">{p.yMin}%</text>

        <!-- year ticks: first, last, and a few in between -->
        {#each yrs as yr, i}
          {#if yearTick(yr, i)}
            <text x={x(i)} y={baseY + 16} text-anchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} font-size="11" fill="#64748b">{yr}</text>
          {/if}
        {/each}

        <!-- population line (dashed grey) -->
        <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" points={linePts(p.pop, p)} />
        <!-- stop-share line (solid, race color) -->
        <polyline fill="none" stroke={c} stroke-width="2.5" points={linePts(p.stops, p)} />

        <!-- first dots -->
        {#if p.stops[0] != null}
          <circle cx={x(0)} cy={yOf(p.stops[0], p)} r="3" fill={c} />
        {/if}
        {#if p.pop[0] != null}
          <circle cx={x(0)} cy={yOf(p.pop[0], p)} r="2.5" fill="#94a3b8" />
        {/if}
        <!-- last dots -->
        {#if p.stops[n - 1] != null}
          <circle cx={x(n - 1)} cy={yOf(p.stops[n - 1], p)} r="3.5" fill={c} />
        {/if}
        {#if p.pop[n - 1] != null}
          <circle cx={x(n - 1)} cy={yOf(p.pop[n - 1], p)} r="3" fill="#94a3b8" />
        {/if}

        <!-- start-of-line value labels, spread outward from the opening dots -->
        {#if p.stops[0] != null && p.pop[0] != null}
          {@const sy = startYs(p.stops[0], p.pop[0], p)}
          <text x={x(0) + 5} y={sy[0]} font-size="11" font-weight="700" fill={c}>{p.stops[0].toFixed(1)}%</text>
          <text x={x(0) + 5} y={sy[1]} font-size="11" font-weight="600" fill="#64748b">{p.pop[0].toFixed(1)}%</text>
        {/if}

        <!-- end-of-line value labels (race carried by the panel header) -->
        {#if p.stops[n - 1] != null && p.pop[n - 1] != null}
          {@const ys = endYs(p.stops[n - 1], p.pop[n - 1], p)}
          <text x={x(n - 1) + 7} y={ys[0]} font-size="11.5" font-weight="700" fill={c}>{p.stops[n - 1].toFixed(1)}% stops</text>
          <text x={x(n - 1) + 7} y={ys[1]} font-size="11.5" font-weight="600" fill="#64748b">{p.pop[n - 1].toFixed(1)}% pop.</text>
        {/if}

        <!-- per-year hover columns drive the floating tooltip + locator -->
        {#each yrs as yr, i}
          {@const bw = n > 1 ? plotW / (n - 1) : plotW}
          <rect x={x(i) - bw / 2} y={pad.top} width={bw} height={plotH} fill="transparent"
                on:pointermove={(e) => showTip(e, pi, { title: yr, lx: x(i), rows: tipRows(p, i) })}
                on:pointerleave={hideTip} />
        {/each}
      </svg>
      <ChartTooltip tip={tip && tip.pi === pi ? tip : null} />
    </div>
  {/each}
</div>
