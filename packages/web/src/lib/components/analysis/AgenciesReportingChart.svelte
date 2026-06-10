<script>
  // Graphic 5 — agencies reporting per year over the last decade, broken into
  // who they are: agencies that reported the year before ("consistent"), ones
  // returning after a gap, brand-new ones, and agencies that filed but recorded
  // zero stops. The point of the chart is the 2025 "returning" surge: most of
  // the rebound from 2024 is agencies coming back, not new reporting.
  export let data; // AgencyReportingPoint[]: { year, consistent, returning, new, zero_stop_filers, total_filed }
  export let highlightYear = 2024;
  export let labels = {
    annotation: "Most 2025 agencies are returnees, not new",
    yAxis: "Agencies that filed a report",
  };

  // Stack order, bottom -> top. "Returning" is the accountability segment, so it
  // gets the strong color; the consistent base is neutral.
  const SEGMENTS = [
    { key: "consistent", label: "Reported the prior year", fill: "#94a3b8" },
    { key: "returning", label: "Returned after a gap", fill: "#dc2626" },
    { key: "new", label: "First-time reporter", fill: "#2563eb" },
    { key: "zero_stop_filers", label: "Filed, but zero stops", fill: "#e2e8f0" },
  ];

  const W = 720;
  const H = 360;
  const pad = { top: 44, right: 20, bottom: 52, left: 20 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const segVal = (d, k) => Number(d[k] ?? 0);
  const total = (d) =>
    d.total_filed ?? SEGMENTS.reduce((s, seg) => s + segVal(d, seg.key), 0);

  $: n = data.length;
  $: yMax = Math.ceil(Math.max(...data.map(total), 1) / 100) * 100;
  $: bandW = plotW / n;
  $: barW = bandW * 0.62;
  const xCenter = (i) => pad.left + bandW * (i + 0.5);
  $: barH = (v) => (v / yMax) * plotH;

  // Precompute stacked rects per bar.
  $: stacks = data.map((d, i) => {
    let acc = 0;
    const segs = SEGMENTS.map((seg) => {
      const v = segVal(d, seg.key);
      const y0 = acc;
      acc += v;
      return { ...seg, v, y0, y1: acc };
    }).filter((s) => s.v > 0);
    return { d, i, segs, tot: total(d) };
  });

  $: highlightIdx = data.findIndex((d) => d.year === highlightYear);
  // x for the annotation (last bar). Computed here because {@const} can't be a
  // direct child of <svg> — only of block tags like {#if}/{#each}.
  $: annotationX = xCenter(n - 1);
</script>

{#if !data.length}
  <div class="flex h-40 items-center justify-center rounded-md bg-slate-50 text-sm text-slate-400">
    Chart data not yet published.
  </div>
{:else}
<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <text x={pad.left} y="16" font-size="10" fill="#64748b" font-weight="600">{labels.yAxis}</text>

  <!-- annotation pointed at the 2025 returning surge -->
  <text x={Math.min(annotationX + 4, W - pad.right)} y="30" text-anchor="end" font-size="12" font-weight="700" fill="#b91c1c">
    {labels.annotation}
  </text>

  {#each stacks as { d, i, segs, tot }}
    {@const isHi = d.year === highlightYear}
    {@const bx = xCenter(i) - barW / 2}
    {#each segs as s}
      {@const h = barH(s.v)}
      {@const y = pad.top + plotH - barH(s.y1)}
      <rect x={bx} y={y} width={barW} height={h} fill={s.fill}
            stroke={s.key === "zero_stop_filers" ? "#cbd5e1" : "none"} stroke-width="0.75" />
    {/each}
    <!-- total filed, above the bar -->
    <text x={xCenter(i)} y={pad.top + plotH - barH(tot) - 6} text-anchor="middle" font-size="11" font-weight="600" fill="#475569">{tot}</text>
    <!-- year label -->
    <text x={xCenter(i)} y={pad.top + plotH + 18} text-anchor="middle" font-size="11" font-weight={isHi ? "700" : "400"} fill={isHi ? "#b91c1c" : "#64748b"}>{d.year}</text>
  {/each}

  <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#cbd5e1" stroke-width="1" />

  <!-- legend -->
  {#each SEGMENTS as seg, li}
    {@const lx = pad.left + li * (plotW / SEGMENTS.length)}
    {@const ly = H - 14}
    <rect x={lx} y={ly - 9} width="11" height="11" rx="2" fill={seg.fill}
          stroke={seg.key === "zero_stop_filers" ? "#cbd5e1" : "none"} stroke-width="0.75" />
    <text x={lx + 16} y={ly} font-size="10.5" fill="#475569">{seg.label}</text>
  {/each}
</svg>
{/if}
