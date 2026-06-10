<script>
  import { raceColor } from "./colors";

  // Graphic 1 — small multiple, one panel per race. Each panel compares a
  // race's SHARE OF STOPS against its share of the driving-age (16+)
  // population. Where the stop-share line sits above the population line, that
  // group is over-represented in stops.
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
  const pad = { top: 24, right: 64, bottom: 32, left: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  $: n = years.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  const panelFor = (race) => {
    const stops = years.map((y) => metric?.[race]?.[y]?.share_pct ?? null);
    const pop = years.map((y) => metric?.[race]?.[y]?.pop_pct_16plus ?? null);
    const all = [...stops, ...pop].filter((v) => v != null);
    const yMax = Math.ceil(Math.max(...all, 1) / 5) * 5;
    return { race, stops, pop, yMax };
  };
  $: panels = races.map(panelFor);

  const yOf = (v, yMax) => pad.top + (1 - v / yMax) * plotH;
  const linePts = (vals, yMax) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${yOf(v, yMax)}`)).filter(Boolean).join(" ");
</script>

<div class="grid gap-4 sm:grid-cols-3">
  {#each panels as p}
    {@const c = raceColor(p.race)}
    <div>
      <div class="mb-1 text-center text-sm font-bold" style="color:{c}">{p.race}</div>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- year ticks -->
        {#each years as yr, i}
          <text x={x(i)} y={pad.top + plotH + 16} text-anchor="middle" font-size="11" fill="#94a3b8">{yr}</text>
        {/each}

        <!-- population line (dashed) -->
        <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" points={linePts(p.pop, p.yMax)} />
        <!-- stop-share line (solid, race color) -->
        <polyline fill="none" stroke={c} stroke-width="2.5" points={linePts(p.stops, p.yMax)} />

        {#each years as yr, i}
          {#if p.stops[i] != null}
            <circle cx={x(i)} cy={yOf(p.stops[i], p.yMax)} r="3.5" fill={c} />
          {/if}
          {#if p.pop[i] != null}
            <circle cx={x(i)} cy={yOf(p.pop[i], p.yMax)} r="3" fill="#94a3b8" />
          {/if}
        {/each}

        <!-- right-edge endpoint labels -->
        {#if p.stops[n - 1] != null}
          <text x={x(n - 1) + 6} y={yOf(p.stops[n - 1], p.yMax) + 4} font-size="11" font-weight="700" fill={c}>{p.stops[n - 1].toFixed(1)}%</text>
        {/if}
        {#if p.pop[n - 1] != null}
          <text x={x(n - 1) + 6} y={yOf(p.pop[n - 1], p.yMax) + 4} font-size="11" font-weight="600" fill="#64748b">{p.pop[n - 1].toFixed(1)}%</text>
        {/if}
      </svg>
    </div>
  {/each}
</div>

<div class="mt-2 flex justify-center gap-6 text-xs text-slate-500">
  <span class="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#475569" stroke-width="2.5" /></svg>{labels.stops}</span>
  <span class="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" /></svg>{labels.pop}</span>
</div>
