<script>
  import ChartTooltip from "./ChartTooltip.svelte";

  // Agencies filing a report each year. Just the absolute count per year — the
  // story is the 2024 dip and the 2025 rebound. Every bar is the site's dark
  // brand green; the anomalous 2024 year (and that year alone) is a brighter
  // amber so the dip pops. A light y-axis (a few gridlines) gives the bars a
  // scale to read against; the 2024/2025 bars carry their counts.
  //
  // Mobile-first: a compact viewBox keeps the type legible when the SVG scales
  // down on a phone.
  export let data; // AgencyReportingPoint[]: { year, total_filed, ... }
  export let dipYear = 2024; // the anomalous low year, highlighted on its own
  export let countYears = [2024, 2025]; // bars that always carry a count label
  export let desktopCountYears = [2023]; // count label shown only on wider screens
  export let note = "About 110 agencies dropped out in 2024 — and nearly all came back in 2025";

  const DARK = "#25784c"; // chart brand green (matches the app's chart palette) — baseline bars
  const DIP = "#fbbf24"; // warm amber — the 2024 reporting artifact (caution; amber is the app's note/caution hue)
  const DIP_STROKE = "#f59e0b";

  const W = 400;
  const H = 300;
  const pad = { top: 72, right: 12, bottom: 26, left: 30 };
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
  $: yOf = (v) => baseY - (v / yMax) * plotH;
  // A few horizontal gridlines so the bars read against a scale.
  $: yTicks = Array.from({ length: Math.floor(yMax / 200) + 1 }, (_, i) => i * 200);

  const hasCount = (yr) => countYears.includes(yr);
  const hasDesktopCount = (yr) => desktopCountYears.includes(yr);
  $: dipIdx = data.findIndex((d) => d.year === dipYear);
  // The note reads as two lines, split on its em dash.
  $: noteLines = note ? note.split(" — ") : [];

  // Floating tooltip — positioned relative to the .tip-host wrapper.
  let tip = null;
  const showTip = (e, payload) => {
    const host = e.currentTarget.closest(".tip-host");
    if (!host) return;
    const r = host.getBoundingClientRect();
    tip = {
      x: Math.max(70, Math.min(r.width - 70, e.clientX - r.left)),
      y: e.clientY - r.top,
      ...payload,
    };
  };
  const hideTip = () => (tip = null);
</script>

{#if !data.length}
  <div class="flex h-40 items-center justify-center rounded-md bg-slate-50 text-sm text-slate-400">
    Chart data not yet published.
  </div>
{:else}
<div class="tip-host relative mx-auto max-w-xl">
<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <!-- y gridlines + labels (a light scale to read the bars against) -->
  {#each yTicks as t}
    <line x1={pad.left} y1={yOf(t)} x2={pad.left + plotW} y2={yOf(t)} stroke="#e2e8f0" stroke-width="1" />
    <text x={pad.left - 6} y={yOf(t) + 3.5} text-anchor="end" font-size="10" fill="#94a3b8">{t}</text>
  {/each}

  <!-- dip note, top-right, with a connector down to the 2024 bar -->
  {#if noteLines.length && dipIdx >= 0}
    {@const dipTop = baseY - barH(total(data[dipIdx]))}
    {#each noteLines as line, li}
      <text x={W - pad.right} y={14 + li * 15} text-anchor="end" font-size="11" font-weight="700" fill={DARK}>{line}</text>
    {/each}
    <line x1={xCenter(dipIdx)} y1={14 + noteLines.length * 15 - 4} x2={xCenter(dipIdx)} y2={dipTop - 20}
          stroke={DARK} stroke-width="1" stroke-dasharray="3 2" />
  {/if}

  {#each data as d, i}
    {@const dip = d.year === dipYear}
    {@const h = barH(total(d))}
    {@const y = baseY - h}
    <rect x={xCenter(i) - barW / 2} y={y} width={barW} height={h} rx="1.5"
          fill={dip ? DIP : DARK} stroke={dip ? DIP_STROKE : "none"} stroke-width="1"
          on:pointermove={(e) => showTip(e, { title: d.year, rows: [{ label: "Agencies reported", value: total(d), color: dip ? DIP : DARK }] })}
          on:pointerleave={hideTip} />
    <!-- wider invisible hit area so the thin/short bars are easy to hover -->
    <rect x={xCenter(i) - bandW / 2} y={pad.top} width={bandW} height={plotH} fill="transparent"
          on:pointermove={(e) => showTip(e, { title: d.year, rows: [{ label: "Agencies reported", value: total(d), color: dip ? DIP : DARK }] })}
          on:pointerleave={hideTip} />
    {#if hasCount(d.year) || hasDesktopCount(d.year)}
      <text x={xCenter(i)} y={y - 6} text-anchor="middle" font-size="13" font-weight="700" fill={DARK}
            class={hasDesktopCount(d.year) ? "sm-up" : ""}>{total(d)}</text>
    {/if}
    <text x={xCenter(i)} y={baseY + 16} text-anchor="middle" font-size="11" fill="#64748b">{d.year}</text>
  {/each}

  <!-- baseline -->
  <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#94a3b8" stroke-width="1" />
</svg>
<ChartTooltip {tip} />
</div>
{/if}

<style>
  /* The 2023 bar count is context — show it only on wider screens to keep the
     mobile chart uncluttered. */
  .sm-up {
    display: none;
  }
  @media (min-width: 640px) {
    .sm-up {
      display: inline;
    }
  }
</style>
