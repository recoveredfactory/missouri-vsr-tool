<script>
  import { scaleLinear } from "d3-scale";

  /**
   * Two-line comparison chart for rate metrics.
   * Shows statewide line (grey dashed) vs. selected agency line (solid color).
   *
   * statewideSeries: { data: { year, value }[] }
   * selectedSeries:  { agency: string, data: { year, value|null }[] }
   * yMax: null → auto-range; non-null → use this (sharedRateYMax from modal)
   */

  export let statewideSeries = { data: [] };
  export let selectedSeries = null;
  export let allYears = [];
  export let yMax = null;
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

  $: domainMax = (() => {
    if (yMax != null) return yMax;
    let max = 0;
    for (const pt of statewideSeries.data) {
      if (pt.value != null && pt.value > max) max = pt.value;
    }
    if (selectedSeries) {
      for (const pt of selectedSeries.data) {
        if (pt.value != null && pt.value > max) max = pt.value;
      }
    }
    return max > 0 ? Math.min(max * 1.1, 100) : 1;
  })();

  $: xSc = scaleLinear().domain([minYear, maxYear]).range([0, iw]);
  $: ySc = scaleLinear().domain([0, domainMax]).range([ih, 0]).nice();

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
  const formatY = (v) => rateFormatter.format(v);

  const buildPath = (data, xFn, yFn) => {
    let d = "";
    let pen = false;
    for (const pt of data) {
      if (pt.value == null) { pen = false; continue; }
      const x = xFn(pt.year);
      const y = yFn(pt.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
      d += pen ? `L${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  $: statewideClipped = statewideSeries.data.filter((pt) => pt.year >= minYear && pt.year <= maxYear);
  $: statewidePath = buildPath(statewideClipped, xSc, ySc);
  $: selectedPath = selectedSeries ? buildPath(selectedSeries.data, xSc, ySc) : null;

  const lastPoint = (data) => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i]?.value != null) return data[i];
    }
    return null;
  };
  $: selectedLabel = agencyName || selectedSeries?.agency || "";

  // Anchor each label to the extremum where the two series naturally separate:
  // the higher-average line labels at its max (above), the lower at its min
  // (below). Pulls labels apart along the axis of greatest divergence.
  const seriesAvg = (data) => {
    let sum = 0, n = 0;
    for (const p of data) if (p?.value != null) { sum += p.value; n++; }
    return n ? sum / n : 0;
  };
  const seriesExtremum = (data, type) => {
    let best = null;
    for (const p of data) {
      if (p?.value == null) continue;
      if (!best || (type === "max" ? p.value > best.value : p.value < best.value)) best = p;
    }
    return best;
  };

  $: agencyHigher = selectedSeries
    ? seriesAvg(selectedSeries.data) >= seriesAvg(statewideClipped)
    : false;

  // If a series' min is 0 (or rounds to 0), labeling below it would crash the
  // chart floor and clip the text. Fall back to the max in that case.
  const pickAnchor = (data, preferred) => {
    if (preferred === "max") return seriesExtremum(data, "max");
    const min = seriesExtremum(data, "min");
    if (min && min.value <= 0.05) return seriesExtremum(data, "max");
    return min;
  };
  $: selectedPreferred = agencyHigher ? "max" : "min";
  $: statewidePreferred = agencyHigher ? "min" : "max";
  $: selectedAnchor = selectedSeries ? pickAnchor(selectedSeries.data, selectedPreferred) : null;
  $: statewideAnchor = pickAnchor(statewideClipped, statewidePreferred);
  // Side derives from the actual anchor used (not the preferred), so a min→max
  // fallback flips the label to "above".
  $: selDy = (selectedAnchor && selectedSeries
    && selectedAnchor === seriesExtremum(selectedSeries.data, "max")) ? -12 : 16;
  $: moDy = (statewideAnchor
    && statewideAnchor === seriesExtremum(statewideClipped, "max")) ? -12 : 16;
  // text-anchor: keep label inside chart (end if anchor is in right half).
  $: selTextAnchor = selectedAnchor && xSc(selectedAnchor.year) > iw / 2 ? "end" : "start";
  $: moTextAnchor = statewideAnchor && xSc(statewideAnchor.year) > iw / 2 ? "end" : "start";
  $: selDx = selTextAnchor === "end" ? -4 : 4;
  $: moDx = moTextAnchor === "end" ? -4 : 4;

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

  $: hoveredX = hoverYear != null ? xSc(hoverYear) : null;

  $: hoveredAgencyPt = hoverYear != null && selectedSeries
    ? (selectedSeries.data.find((p) => p.year === hoverYear) ?? null)
    : null;
  $: hoveredAgencyValue = hoveredAgencyPt?.value ?? null;
  $: hoveredAgencyY = hoveredAgencyValue != null ? ySc(hoveredAgencyValue) : null;

  $: hoveredStatewidePt = hoverYear != null
    ? (statewideSeries.data.find((p) => p.year === hoverYear) ?? null)
    : null;
  $: hoveredStatewideValue = hoveredStatewidePt?.value ?? null;
  $: hoveredStatewideY = hoveredStatewideValue != null ? ySc(hoveredStatewideValue) : null;
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

        <!-- Statewide line (grey dashed) — drawn first so agency line renders on top -->
        {#if statewidePath}
          <path
            d={statewidePath}
            fill="none"
            stroke="#94a3b8"
            stroke-width="1.5"
            stroke-dasharray="6,3"
          />
          {#each statewideSeries.data.filter((pt) => pt.year >= minYear && pt.year <= maxYear) as pt}
            {#if pt.value != null}
              <circle
                cx={xSc(pt.year).toFixed(1)} cy={ySc(pt.value).toFixed(1)}
                r={3.5} fill="#94a3b8" stroke="white" stroke-width="1.5"
                pointer-events="none"
              />
            {/if}
          {/each}
        {/if}

        <!-- Selected agency line (solid colored) -->
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
        {/if}

        <!-- Inline line labels — anchored at each series' extremum so the
             agency and MO labels sit on opposite sides of the divergence. -->
        {#if statewideAnchor}
          <text
            x={(xSc(statewideAnchor.year) + moDx).toFixed(1)}
            y={(ySc(statewideAnchor.value) + moDy).toFixed(1)}
            text-anchor={moTextAnchor}
            fill="#64748b"
            font-size="10" font-weight="700" font-family="inherit"
            pointer-events="none"
            paint-order="stroke"
            stroke="white" stroke-width="3" stroke-linejoin="round"
          >MO</text>
        {/if}
        {#if selectedAnchor && selectedLabel}
          <text
            x={(xSc(selectedAnchor.year) + selDx).toFixed(1)}
            y={(ySc(selectedAnchor.value) + selDy).toFixed(1)}
            text-anchor={selTextAnchor}
            fill={color}
            font-size="10" font-weight="700" font-family="inherit"
            pointer-events="none"
            paint-order="stroke"
            stroke="white" stroke-width="3" stroke-linejoin="round"
          >{selectedLabel}</text>
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

          {#if hoveredStatewideY != null}
            <circle
              cx={hoveredX.toFixed(1)} cy={hoveredStatewideY.toFixed(1)}
              r={4} fill="#94a3b8" stroke="white" stroke-width="2"
              pointer-events="none"
            />
          {/if}

          {#if hoveredAgencyY != null}
            <circle
              cx={hoveredX.toFixed(1)} cy={hoveredAgencyY.toFixed(1)}
              r={4.5} fill={color} stroke="white" stroke-width="2"
              pointer-events="none"
            />
          {/if}

          {#if hoveredAgencyValue != null || hoveredStatewideValue != null}
            {@const tipRight = hoveredX < iw / 2}
            {@const tipX = tipRight ? hoveredX + 10 : hoveredX - 10}
            {@const tipAnchor = tipRight ? "start" : "end"}
            {@const refY = hoveredAgencyY ?? hoveredStatewideY ?? ih / 2}
            {@const tipY = Math.max(28, Math.min(ih - 16, refY - 8))}
            {#if hoveredAgencyValue != null}
              <text
                x={tipX.toFixed(1)} y={tipY.toFixed(1)}
                text-anchor={tipAnchor}
                fill={color}
                font-size="12" font-family="inherit" font-weight="700"
                pointer-events="none"
              >{hoverYear}: {formatY(hoveredAgencyValue)}</text>
            {/if}
            {#if hoveredStatewideValue != null}
              <text
                x={tipX.toFixed(1)} y={(tipY + 16).toFixed(1)}
                text-anchor={tipAnchor}
                fill="#94a3b8"
                font-size="12" font-family="inherit" font-weight="600"
                pointer-events="none"
              >MO: {formatY(hoveredStatewideValue)}</text>
            {/if}
          {/if}
        {/if}

      </g>
    </svg>
  {/if}
</div>
