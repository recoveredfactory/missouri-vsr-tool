<script>
  // Graphic 5 — number of agencies reporting per year over the last decade.
  // 2024 dipped sharply, then rebounded in 2025; we highlight 2024 and label
  // every bar directly (no y-axis reading required).
  export let data; // AgencyReportingPoint[]: { year, count }
  export let highlightYear = 2024;
  export let labels = {
    annotation: "Dozens fewer agencies reported in 2024",
    yAxis: "Agencies reporting",
  };

  const W = 720;
  const H = 320;
  const pad = { top: 40, right: 20, bottom: 36, left: 20 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  $: n = data.length;
  $: yMax = Math.ceil(Math.max(...data.map((d) => d.count), 1) / 100) * 100;
  $: bandW = plotW / n;
  $: barW = bandW * 0.62;
  const xCenter = (i) => pad.left + bandW * (i + 0.5);
  $: barH = (v) => (v / yMax) * plotH;

  $: highlightIdx = data.findIndex((d) => d.year === highlightYear);
</script>

<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <text x={pad.left} y="16" font-size="10" fill="#64748b" font-weight="600">{labels.yAxis}</text>

  <!-- annotation over the highlighted bar -->
  {#if highlightIdx >= 0}
    {@const hx = xCenter(highlightIdx)}
    <text x={Math.min(hx + 4, W - pad.right)} y="30" text-anchor={highlightIdx > n / 2 ? "end" : "start"} font-size="12" font-weight="700" fill="#b91c1c">
      {labels.annotation}
    </text>
  {/if}

  {#each data as d, i}
    {@const isHi = d.year === highlightYear}
    {@const h = barH(d.count)}
    {@const bx = xCenter(i) - barW / 2}
    {@const by = pad.top + plotH - h}
    <rect x={bx} y={by} width={barW} height={h} rx="2" fill={isHi ? "#dc2626" : "#94a3b8"} />
    <text x={xCenter(i)} y={by - 6} text-anchor="middle" font-size="11" font-weight={isHi ? "700" : "600"} fill={isHi ? "#b91c1c" : "#475569"}>{d.count}</text>
    <text x={xCenter(i)} y={pad.top + plotH + 18} text-anchor="middle" font-size="11" font-weight={isHi ? "700" : "400"} fill={isHi ? "#b91c1c" : "#64748b"}>{d.year}</text>
  {/each}

  <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#cbd5e1" stroke-width="1" />
</svg>
