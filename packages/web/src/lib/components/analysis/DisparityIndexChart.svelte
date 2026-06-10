<script>
  import { raceColor } from "./colors";

  // Graphic 2 — small multiple, one panel per outcome (stops / searches /
  // arrests). Within each panel, the disparity index for White / Black /
  // Hispanic drivers, with a horizontal line at 1.0 marking parity (a group
  // stopped/searched/arrested exactly in proportion to its 16+ population).
  //
  // NOTE: official population denominators exist only for 2023 and 2025 in the
  // current bundle, so each line is a two-point slope. More years -> trend.
  export let byMetric; // { stops, searches, arrests } -> race -> year -> { disparity_index }
  export let years;
  export let races = ["White", "Black", "Hispanic"];
  export let metrics = [
    { key: "stops", label: "Stops" },
    { key: "searches", label: "Searches" },
    { key: "arrests", label: "Arrests" },
  ];
  export let parityLabel = "parity";

  const W = 240;
  const H = 230;
  const pad = { top: 20, right: 70, bottom: 30, left: 32 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  $: n = years.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Shared y-domain across panels so panels are comparable.
  $: yMax = (() => {
    let max = 1.2;
    for (const mtr of metrics)
      for (const r of races)
        for (const y of years) {
          const v = byMetric?.[mtr.key]?.[r]?.[y]?.disparity_index;
          if (v != null) max = Math.max(max, v);
        }
    return Math.ceil(max * 1.1 * 10) / 10;
  })();
  const yOf = (v) => pad.top + (1 - v / yMax) * plotH;
  const linePts = (vals) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${yOf(v)}`)).filter(Boolean).join(" ");

  const seriesFor = (metricKey, race) =>
    years.map((y) => byMetric?.[metricKey]?.[race]?.[y]?.disparity_index ?? null);
</script>

<div class="grid gap-4 sm:grid-cols-3">
  {#each metrics as mtr}
    <div>
      <div class="mb-1 text-center text-sm font-bold text-slate-900">{mtr.label}</div>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- parity line -->
        <line x1={pad.left} y1={yOf(1)} x2={pad.left + plotW} y2={yOf(1)} stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />
        <text x={pad.left} y={yOf(1) - 4} font-size="9.5" fill="#64748b" font-style="italic">{parityLabel} (1.0)</text>

        {#each years as yr, i}
          <text x={x(i)} y={pad.top + plotH + 16} text-anchor="middle" font-size="11" fill="#94a3b8">{yr}</text>
        {/each}

        {#each races as race}
          {@const c = raceColor(race)}
          {@const s = seriesFor(mtr.key, race)}
          <polyline fill="none" stroke={c} stroke-width="2.5" points={linePts(s)} />
          {#each s as v, i}
            {#if v != null}<circle cx={x(i)} cy={yOf(v)} r="3" fill={c} />{/if}
          {/each}
          {#if s[n - 1] != null}
            <text x={x(n - 1) + 6} y={yOf(s[n - 1]) + 3} font-size="10.5" font-weight="700" fill={c}>{race} {s[n - 1].toFixed(2)}</text>
          {/if}
        {/each}
      </svg>
    </div>
  {/each}
</div>
