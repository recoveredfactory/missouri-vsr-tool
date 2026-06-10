<script>
  import { raceColor } from "./colors";

  // Graphic 4 — outcome test. x = search rate (searches per 100 stops),
  // y = contraband hit rate (% of searches finding contraband). One bubble per
  // race, area sqrt-scaled to total stops. Each bubble is labeled directly.
  //
  // The story: White drivers are searched least but found with contraband most
  // often; Hispanic drivers are searched most yet found with contraband least.
  export let races; // RaceSummaryPoint[] (White/Black/Hispanic)
  export let labels = {
    x: "Searches per 100 stops",
    y: "Contraband found (% of searches)",
    bubbleNote: "Bubble area ∝ total stops",
  };

  const W = 640;
  const H = 420;
  const pad = { top: 28, right: 40, bottom: 52, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const nice = (v, step) => Math.ceil(v / step) * step;
  $: xMax = nice(Math.max(...races.map((r) => r.search_rate)) * 1.15, 1);
  $: yMaxRaw = Math.max(...races.map((r) => r.contraband_hit_rate));
  $: yMin = Math.max(0, Math.floor(Math.min(...races.map((r) => r.contraband_hit_rate)) / 5) * 5 - 5);
  $: yMax = nice(yMaxRaw + 2, 5);

  const x = (v) => pad.left + (v / xMax) * plotW;
  $: y = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // sqrt-area radius: largest bubble ~ 46px.
  $: maxStops = Math.max(...races.map((r) => r.total_stops));
  $: r = (stops) => 14 + (Math.sqrt(stops / maxStops)) * 32;

  $: xTicks = Array.from({ length: xMax + 1 }, (_, i) => i);
  $: yTicks = (() => {
    const out = [];
    for (let v = yMin; v <= yMax; v += 5) out.push(v);
    return out;
  })();
</script>

<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <!-- grid -->
  {#each yTicks as t}
    <line x1={pad.left} y1={y(t)} x2={pad.left + plotW} y2={y(t)} stroke="#eef2f6" stroke-width="1" />
    <text x={pad.left - 8} y={y(t) + 3} text-anchor="end" font-size="11" fill="#94a3b8">{t}%</text>
  {/each}
  {#each xTicks as t}
    <text x={x(t)} y={pad.top + plotH + 18} text-anchor="middle" font-size="11" fill="#94a3b8">{t}</text>
  {/each}

  <!-- axis titles -->
  <text x={pad.left + plotW / 2} y={H - 12} text-anchor="middle" font-size="12" fill="#475569" font-weight="600">{labels.x}</text>
  <text transform="rotate(-90)" x={-(pad.top + plotH / 2)} y="16" text-anchor="middle" font-size="12" fill="#475569" font-weight="600">{labels.y}</text>

  <!-- bubbles + direct labels -->
  {#each races as d}
    {@const cx = x(d.search_rate)}
    {@const cy = y(d.contraband_hit_rate)}
    {@const c = raceColor(d.race)}
    <circle {cx} {cy} r={r(d.total_stops)} fill={c} fill-opacity="0.18" stroke={c} stroke-width="2" />
    <circle {cx} {cy} r="3" fill={c} />
    <text x={cx} y={cy - r(d.total_stops) - 8} text-anchor="middle" font-size="14" font-weight="700" fill={c}>{d.race}</text>
    <text x={cx} y={cy - r(d.total_stops) + 6} text-anchor="middle" font-size="10.5" fill="#475569">
      {d.search_rate.toFixed(1)} / 100 · {d.contraband_hit_rate.toFixed(0)}% hit
    </text>
  {/each}

  <text x={pad.left + plotW} y={pad.top - 12} text-anchor="end" font-size="10" fill="#94a3b8" font-style="italic">{labels.bubbleNote}</text>
</svg>
