<script>
  // Agencies filing a report each year. Just the absolute count per year — the
  // story is the 2024 dip and the 2025 rebound, so we highlight those two bars
  // in the site's brand green and let the rest sit back in a neutral tint.
  // (Earlier versions split each bar into consistent/returning/new segments;
  // the single count reads cleaner and the prose carries the composition.)
  export let data; // AgencyReportingPoint[]: { year, total_filed, ... }
  export let highlightYears = [2024, 2025];
  export let note = "About 110 agencies dropped out in 2024 — and nearly all came back in 2025";
  export let yAxisLabel = "Agencies filing a report";

  const BRAND = "#1f6f43"; // site brand green
  const BASE = "#dde5e0"; // muted green-grey for the baseline years
  const BASE_STROKE = "#c4d2c9";

  const W = 580;
  const H = 300;
  const pad = { top: 58, right: 14, bottom: 28, left: 14 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const total = (d) => Number(d.total_filed ?? 0);
  $: n = data.length;
  $: yMax = Math.ceil(Math.max(...data.map(total), 1) / 100) * 100;
  $: bandW = plotW / n;
  $: barW = bandW * 0.62;
  const xCenter = (i) => pad.left + bandW * (i + 0.5);
  $: barH = (v) => (v / yMax) * plotH;
  const baseY = pad.top + plotH;

  const isHi = (yr) => highlightYears.includes(yr);
  // Index of the dip (first highlighted year) — the note points here.
  $: dipIdx = data.findIndex((d) => d.year === highlightYears[0]);
</script>

{#if !data.length}
  <div class="flex h-40 items-center justify-center rounded-md bg-slate-50 text-sm text-slate-400">
    Chart data not yet published.
  </div>
{:else}
<div class="mx-auto max-w-2xl">
<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <text x={pad.left} y="14" font-size="11" fill="#64748b" font-weight="600">{yAxisLabel}</text>

  <!-- note, tied to the dip with a short connector -->
  {#if note}
    <text x={W - pad.right} y="34" text-anchor="end" font-size="12.5" font-weight="700" fill={BRAND}>{note}</text>
    {#if dipIdx >= 0}
      {@const dipTop = baseY - barH(total(data[dipIdx]))}
      <line x1={xCenter(dipIdx)} y1={42} x2={xCenter(dipIdx)} y2={dipTop - 18} stroke={BRAND} stroke-width="1" stroke-dasharray="3 2" />
    {/if}
  {/if}

  {#each data as d, i}
    {@const hi = isHi(d.year)}
    {@const h = barH(total(d))}
    {@const y = baseY - h}
    <rect x={xCenter(i) - barW / 2} y={y} width={barW} height={h} rx="1.5"
          fill={hi ? BRAND : BASE} stroke={hi ? "none" : BASE_STROKE} stroke-width="1" />
    <!-- count above the bar -->
    <text x={xCenter(i)} y={y - 6} text-anchor="middle" font-size="10.5"
          font-weight={hi ? "700" : "500"} fill={hi ? BRAND : "#64748b"}>{total(d)}</text>
    <!-- year label -->
    <text x={xCenter(i)} y={baseY + 16} text-anchor="middle" font-size="10.5"
          font-weight={hi ? "700" : "400"} fill={hi ? BRAND : "#94a3b8"}>{d.year}</text>
  {/each}

  <!-- baseline -->
  <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
</svg>
</div>
{/if}
