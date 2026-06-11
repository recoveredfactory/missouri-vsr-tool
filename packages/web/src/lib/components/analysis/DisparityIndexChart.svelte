<script>
  import { raceColor } from "./colors";

  // Graphic 2 — small multiple, one panel per outcome (stops / searches /
  // arrests). Within each panel, the disparity index for White / Black /
  // Hispanic drivers. A value of 1.0× is parity (the group is
  // stopped/searched/arrested exactly in proportion to its 16+ population);
  // 1.9× means 1.9 times as often as its population share would predict.
  export let byMetric; // { stops, searches, arrests } -> race -> year -> { disparity_index }
  export let years;
  export let races = ["White", "Black", "Hispanic"];
  export let startYear = 2018; // anchor the window with the rest of the article
  export let metrics = [
    { key: "stops", label: "Stops" },
    { key: "searches", label: "Searches" },
    { key: "arrests", label: "Arrests" },
  ];
  export let parityLabel = "parity";

  $: yrs = years.filter((y) => y >= startYear);

  const W = 252;
  const H = 230;
  const pad = { top: 20, right: 96, bottom: 30, left: 34 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  $: n = yrs.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Shared y-domain (from 0) across panels so panels are comparable.
  $: yMax = (() => {
    let max = 1.2;
    for (const mtr of metrics)
      for (const r of races)
        for (const y of yrs) {
          const v = byMetric?.[mtr.key]?.[r]?.[y]?.disparity_index;
          if (v != null) max = Math.max(max, v);
        }
    return Math.ceil(max * 1.1 * 10) / 10;
  })();
  const yOf = (v) => pad.top + (1 - v / yMax) * plotH;
  const linePts = (vals) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${yOf(v)}`)).filter(Boolean).join(" ");

  const seriesFor = (metricKey, race) =>
    yrs.map((y) => byMetric?.[metricKey]?.[race]?.[y]?.disparity_index ?? null);

  // Whole-number axis ticks (0×, 1×, 2× …) up to the domain max.
  $: yTicks = Array.from({ length: Math.floor(yMax) + 1 }, (_, i) => i);
</script>

<div class="grid gap-4 sm:grid-cols-3">
  {#each metrics as mtr}
    <div>
      <div class="mb-1 text-center text-sm font-bold text-slate-900">{mtr.label}</div>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- axes: y spine + bottom x line (a touch more present than gridlines) -->
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
        <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
        {#each yTicks as t}
          <line x1={pad.left - 3} y1={yOf(t)} x2={pad.left} y2={yOf(t)} stroke="#94a3b8" stroke-width="1" />
          <text x={pad.left - 6} y={yOf(t) + 3.5} text-anchor="end" font-size="9.5" fill="#64748b">{t}×</text>
        {/each}

        <!-- parity line at 1.0× -->
        <line x1={pad.left} y1={yOf(1)} x2={pad.left + plotW} y2={yOf(1)} stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />
        <text x={pad.left + 3} y={yOf(1) - 4} font-size="9.5" fill="#64748b" font-style="italic">{parityLabel}</text>

        <!-- year ticks: first + last only -->
        {#each yrs as yr, i}
          {#if i === 0 || i === n - 1}
            <text x={x(i)} y={baseY + 16} text-anchor={i === 0 ? "start" : "end"} font-size="11" fill="#64748b">{yr}</text>
          {/if}
        {/each}

        {#each races as race}
          {@const c = raceColor(race)}
          {@const s = seriesFor(mtr.key, race)}
          <polyline fill="none" stroke={c} stroke-width="2.5" points={linePts(s)} />
          {#if s[n - 1] != null}
            <circle cx={x(n - 1)} cy={yOf(s[n - 1])} r="3" fill={c} />
            <text x={x(n - 1) + 6} y={yOf(s[n - 1]) + 3} font-size="10.5" font-weight="700" fill={c}>{race} {s[n - 1].toFixed(1)}×</text>
          {/if}
        {/each}
      </svg>
    </div>
  {/each}
</div>
