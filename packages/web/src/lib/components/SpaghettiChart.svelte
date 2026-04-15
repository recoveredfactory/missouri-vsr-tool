<script>
  import { scaleLinear, scalePow } from "d3-scale";

  /**
   * Pure SVG spaghetti chart.
   * All filtering happens upstream; this component just draws what it receives.
   *
   * greySeries / selectedSeries: { agency: string, data: { year, value|null }[] }
   * yMax: null → auto-range from visible series; non-null → use this (rate metrics)
   * useSqrt: apply sqrt (pow 0.5) scale for wide-range count data;
   *          automatically falls back to linear when domainMax < 1 000
   */

  export let greySeries = [];
  export let selectedSeries = null;
  export let allYears = [];
  export let yMax = null;
  export let useSqrt = false;
  export let isRateMetric = false;
  export let color = "#64748b";
  export let agencyName = "";
  export let height = 250;

  const PAD = { left: 50, right: 8, top: 8, bottom: 28 };

  let containerWidth = 0;
  $: w = containerWidth;
  $: iw = Math.max(0, w - PAD.left - PAD.right);
  $: ih = Math.max(0, height - PAD.top - PAD.bottom);

  $: minYear = allYears[0] ?? 2000;
  $: maxYear = allYears[allYears.length - 1] ?? 2024;

  // Count metrics (yMax = null): auto-range from visible data only.
  $: domainMax = (() => {
    if (yMax != null) return yMax;
    let max = 0;
    for (const s of greySeries) {
      for (const pt of s.data) {
        if (pt.value != null && pt.value > max) max = pt.value;
      }
    }
    if (selectedSeries) {
      for (const pt of selectedSeries.data) {
        if (pt.value != null && pt.value > max) max = pt.value;
      }
    }
    return max > 0 ? max : 1;
  })();

  // Only apply sqrt when data spans a wide range — linear is cleaner for small ranges.
  $: applySqrt = useSqrt && !isRateMetric && domainMax >= 1000;

  $: xSc = scaleLinear().domain([minYear, maxYear]).range([0, iw]);
  $: ySc = (applySqrt ? scalePow().exponent(0.5) : scaleLinear())
    .domain([0, domainMax])
    .range([ih, 0])
    .nice();

  $: yTicks = ySc.ticks(5);
  $: xTickValues = (() => {
    if (allYears.length <= 6) return allYears;
    const step = Math.ceil((allYears.length - 1) / 4);
    const ticks = [];
    for (let i = 0; i < allYears.length; i += step) ticks.push(allYears[i]);
    const last = allYears[allYears.length - 1];
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks;
  })();

  const rateFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const formatCount = (v) => {
    if (!Number.isFinite(v) || v < 0) return "";
    if (v === 0) return "0";
    if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
    if (v >= 10_000) return `${Math.round(v / 1_000)}K`;
    if (v >= 1_000) return `${+(v / 1_000).toFixed(1)}K`;
    return String(Math.round(v));
  };
  $: formatY = isRateMetric ? (v) => rateFormatter.format(v) : formatCount;

  // Build path string; breaks line at nulls and clips beyond yMax (rate metrics).
  const buildPath = (data, xFn, yFn, clipMax) => {
    let d = "";
    let pen = false;
    for (const pt of data) {
      if (pt.value == null || (clipMax != null && pt.value > clipMax * 1.1)) {
        pen = false;
        continue;
      }
      const x = xFn(pt.year);
      const y = yFn(pt.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
      d += pen ? `L${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  $: clip = yMax;
  $: greyPaths = greySeries.map((s) => buildPath(s.data, xSc, ySc, clip));
  $: selectedPath = selectedSeries ? buildPath(selectedSeries.data, xSc, ySc, clip) : null;

  // Last visible point of the selected series — anchor for the inline label.
  $: selectedLastPoint = (() => {
    if (!selectedSeries) return null;
    for (let i = selectedSeries.data.length - 1; i >= 0; i--) {
      const pt = selectedSeries.data[i];
      if (pt.value == null) continue;
      if (clip != null && pt.value > clip * 1.1) continue;
      return pt;
    }
    return null;
  })();
  $: selectedLabel = agencyName || selectedSeries?.agency || "";

  // ── Tooltip ────────────────────────────────────────────────────────────────

  let hoverYear = null;

  function handleMouseMove(event) {
    if (!iw || !allYears.length) { hoverYear = null; return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = event.clientX - rect.left - PAD.left;
    if (svgX < 0 || svgX > iw) { hoverYear = null; return; }
    const rawYear = xSc.invert(svgX);
    hoverYear = allYears.reduce((best, y) =>
      Math.abs(y - rawYear) < Math.abs(best - rawYear) ? y : best,
      allYears[0]
    );
  }

  function handleMouseLeave() { hoverYear = null; }

  $: hoveredPoint = hoverYear != null && selectedSeries
    ? (selectedSeries.data.find((p) => p.year === hoverYear) ?? null)
    : null;
  $: hoveredValue = hoveredPoint?.value ?? null;
  $: hoveredX = hoverYear != null ? xSc(hoverYear) : null;
  $: hoveredY = hoveredValue != null ? ySc(hoveredValue) : null;
</script>

<div class="h-full w-full" bind:clientWidth={containerWidth}>
  {#if w > 0}
    <svg
      width={w} {height} aria-hidden="true" overflow="visible"
      on:mousemove={handleMouseMove}
      on:mouseleave={handleMouseLeave}
    >
      <g transform="translate({PAD.left},{PAD.top})">

        <!-- Y gridlines + tick labels -->
        {#each yTicks as tick}
          {@const ty = ySc(tick)}
          <line x1={0} x2={iw} y1={ty} y2={ty} stroke="#e2e8f0" stroke-width="1" />
          <text
            x={-7} y={ty}
            text-anchor="end" dominant-baseline="middle"
            fill="#64748b" font-size="13" font-family="inherit" font-weight="500"
          >{formatY(tick)}</text>
        {/each}

        <!-- Y axis rule -->
        <line x1={0} x2={0} y1={0} y2={ih} stroke="#cbd5e1" stroke-width="1.5" />

        <!-- Grey background series -->
        {#each greyPaths as d}
          {#if d}
            <path {d} fill="none" stroke="#cbd5e1" stroke-width="0.9" />
          {/if}
        {/each}

        <!-- Selected agency series -->
        {#if selectedPath}
          <path
            d={selectedPath}
            fill="none"
            stroke={color}
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          {#each selectedSeries.data as pt}
            {#if pt.value != null}
              <circle
                cx={xSc(pt.year).toFixed(1)} cy={ySc(pt.value).toFixed(1)}
                r={4.5} fill={color} stroke="white" stroke-width="1.5"
                pointer-events="none"
              />
            {/if}
          {/each}
          {#if selectedLastPoint && selectedLabel}
            {@const lx = xSc(selectedLastPoint.year)}
            {@const ly = ySc(selectedLastPoint.value)}
            {@const labelRight = lx < iw - 60}
            <text
              x={(labelRight ? lx + 7 : lx - 7).toFixed(1)}
              y={(ly - 7).toFixed(1)}
              text-anchor={labelRight ? "start" : "end"}
              fill={color}
              font-size="10" font-weight="700" font-family="inherit"
              pointer-events="none"
              paint-order="stroke"
              stroke="white" stroke-width="3" stroke-linejoin="round"
            >{selectedLabel}</text>
          {/if}
        {/if}

        <!-- X axis rule -->
        <line x1={0} x2={iw} y1={ih} y2={ih} stroke="#cbd5e1" stroke-width="1.5" />

        <!-- X tick labels -->
        {#each xTickValues as tick}
          <text
            x={xSc(tick)} y={ih + 18}
            text-anchor="middle"
            fill="#64748b" font-size="13" font-family="inherit" font-weight="500"
          >{tick}</text>
        {/each}

        <!-- Hover crosshair + tooltip -->
        {#if hoverYear != null && hoveredX != null}
          <line
            x1={hoveredX.toFixed(1)} x2={hoveredX.toFixed(1)}
            y1={0} y2={ih}
            stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3"
            pointer-events="none"
          />
          {#if hoveredY != null}
            {@const tipRight = hoveredX < iw / 2}
            {@const tipX = tipRight ? hoveredX + 10 : hoveredX - 10}
            {@const tipAnchor = tipRight ? "start" : "end"}
            {@const tipY = Math.max(16, Math.min(ih - 8, hoveredY - 8))}
            <circle
              cx={hoveredX.toFixed(1)} cy={hoveredY.toFixed(1)}
              r={4.5} fill={color} stroke="white" stroke-width="2"
              pointer-events="none"
            />
            <text
              x={tipX.toFixed(1)} y={tipY.toFixed(1)}
              text-anchor={tipAnchor}
              fill={color}
              font-size="12" font-family="inherit" font-weight="700"
              pointer-events="none"
            >{hoverYear}: {formatY(hoveredValue)}</text>
          {/if}
        {/if}

      </g>
    </svg>
  {/if}
</div>
