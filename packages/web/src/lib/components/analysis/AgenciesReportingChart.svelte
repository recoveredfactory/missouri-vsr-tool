<script>
  // Agencies filing a report each year. Just the absolute count per year — the
  // story is the 2024 dip and the 2025 rebound. Every bar is the site's dark
  // brand green; the anomalous 2024 year (and that year alone) is a brighter,
  // paler green so the dip pops. There's no y-axis: one bar is labeled in full
  // ("606 agencies reported in 2017") to establish the unit, and the 2024/2025
  // bars carry their counts.
  //
  // Mobile-first: a compact viewBox keeps the type legible when the SVG scales
  // down on a phone.
  export let data; // AgencyReportingPoint[]: { year, total_filed, ... }
  export let dipYear = 2024; // the anomalous low year, highlighted on its own
  export let countYears = [2024, 2025]; // bars that carry a count label
  export let keyYear = 2017; // bar annotated with the unit
  export let note = "About 110 agencies dropped out in 2024 — and nearly all came back in 2025";

  const DARK = "#1f6f43"; // site brand green — the baseline bars
  const DIP = "#fbbf24"; // warm amber — the 2024 reporting artifact (caution)
  const DIP_STROKE = "#f59e0b";

  const W = 400;
  const H = 300;
  const pad = { top: 72, right: 8, bottom: 26, left: 4 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  const total = (d) => Number(d.total_filed ?? 0);
  $: n = data.length;
  $: yMax = Math.ceil(Math.max(...data.map(total), 1) / 100) * 100;
  $: bandW = plotW / n;
  $: barW = bandW * 0.64;
  const xCenter = (i) => pad.left + bandW * (i + 0.5);
  $: barH = (v) => (v / yMax) * plotH;

  const hasCount = (yr) => countYears.includes(yr);
  $: dipIdx = data.findIndex((d) => d.year === dipYear);
  $: keyIdx = data.findIndex((d) => d.year === keyYear);
  $: keyLabel = keyIdx >= 0 ? `${total(data[keyIdx])} agencies reported in ${keyYear}` : "";
  // The note reads as two lines, split on its em dash.
  $: noteLines = note ? note.split(" — ") : [];
</script>

{#if !data.length}
  <div class="flex h-40 items-center justify-center rounded-md bg-slate-50 text-sm text-slate-400">
    Chart data not yet published.
  </div>
{:else}
<div class="mx-auto max-w-xl">
<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <!-- dip note, top-right, with a connector down to the 2024 bar -->
  {#if noteLines.length && dipIdx >= 0}
    {@const dipTop = baseY - barH(total(data[dipIdx]))}
    {#each noteLines as line, li}
      <text x={W - pad.right} y={16 + li * 15} text-anchor="end" font-size="11.5" font-weight="700" fill={DARK}>{line}</text>
    {/each}
    <line x1={xCenter(dipIdx)} y1={16 + noteLines.length * 15 - 4} x2={xCenter(dipIdx)} y2={dipTop - 20}
          stroke={DARK} stroke-width="1" stroke-dasharray="3 2" />
  {/if}

  {#each data as d, i}
    {@const dip = d.year === dipYear}
    {@const h = barH(total(d))}
    {@const y = baseY - h}
    <rect x={xCenter(i) - barW / 2} y={y} width={barW} height={h} rx="1.5"
          fill={dip ? DIP : DARK} stroke={dip ? DIP_STROKE : "none"} stroke-width="1" />
    {#if hasCount(d.year)}
      <text x={xCenter(i)} y={y - 6} text-anchor="middle" font-size="13" font-weight="700" fill={DARK}>{total(d)}</text>
    {/if}
    <text x={xCenter(i)} y={baseY + 16} text-anchor="middle" font-size="11.5"
          font-weight={hasCount(d.year) ? "700" : "400"} fill={hasCount(d.year) ? DARK : "#94a3b8"}>{d.year}</text>
  {/each}

  <!-- unit label on the key bar -->
  {#if keyIdx >= 0}
    {@const keyTop = baseY - barH(total(data[keyIdx]))}
    <line x1={xCenter(keyIdx)} y1={keyTop - 8} x2={xCenter(keyIdx)} y2={keyTop} stroke="#64748b" stroke-width="1" />
    <text x={xCenter(keyIdx)} y={keyTop - 12} text-anchor="start" font-size="12" font-weight="600" fill="#475569">{keyLabel}</text>
  {/if}

  <!-- baseline -->
  <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
</svg>
</div>
{/if}
