<script lang="ts">
  type Series = Array<{ year: number; value: number | null }>;

  export let series: Series = [];
  export let stroke = "#0f172a";
  export let formatValue: (value: number) => string = (v) => String(v);
  export let width = 220;
  export let height = 220;
  export let strokeWidth = 3;
  export let minDomain: number | null = null;
  /** Reserve bottom band to show a "0" reference with a break indicator. */
  export let showZeroBreak = false;
  export let yLabelGutter = 44;
  export let endLabelGutter = 64;
  export let axisBelow = 20;
  /** Optional unit suffix shown after the value in the hover tooltip (e.g. "stops"). */
  export let unitLabel = "";

  const AXIS_COLOR = "#cbd5e1"; // slate-300
  const AXIS_LABEL_COLOR = "#64748b"; // slate-500
  const BREAK_BAND = 22;
  const PAD_Y = 10;

  $: cleaned = series.filter(
    (p) => typeof p.value === "number" && Number.isFinite(p.value as number),
  ) as Array<{ year: number; value: number }>;

  $: years = cleaned.map((p) => p.year);

  $: dataMin = cleaned.length ? Math.min(...cleaned.map((p) => p.value)) : 0;
  $: dataMax = cleaned.length ? Math.max(...cleaned.map((p) => p.value)) : 0;
  /**
   * Break whenever cropping actually buys something — i.e. when the data
   * floor is far enough above zero that a zero-anchored axis would waste
   * half the chart. When the floor is already close to zero, the break
   * looks fussy, so anchor at zero in that case.
   *
   * 5 is in chart-data units (per-100 rates, raw stop counts, etc.). For
   * stops, dataMin is virtually always >5; for race rates, dataMin must
   * exceed 5% before we crop.
   */
  const ZERO_BREAK_FLOOR = 5;
  $: doBreak =
    showZeroBreak && cleaned.length > 0 && dataMin >= ZERO_BREAK_FLOOR;

  $: yDomain = (() => {
    if (!cleaned.length) return { min: 0, max: 1 };
    let min = dataMin;
    let max = dataMax;
    if (minDomain !== null) min = Math.min(min, minDomain);
    // Low-floor data with showZeroBreak on: anchor at 0 instead of breaking.
    if (showZeroBreak && !doBreak) min = Math.min(min, 0);
    if (min === max) return { min: min - 0.5, max: max + 0.5 };
    const span = max - min;
    return { min, max: max + span * 0.1 };
  })();

  /** Vertical span available to plot data — full height minus break band when active. */
  $: plotH = doBreak ? height - BREAK_BAND : height;

  $: xScale = (year: number) => {
    if (years.length === 0) return 0;
    if (years.length === 1) return width / 2;
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const t = (year - minYear) / (maxYear - minYear);
    return t * width;
  };

  $: yScale = (value: number) => {
    const { min, max } = yDomain;
    const t = (value - min) / (max - min);
    return PAD_Y + (1 - t) * (plotH - PAD_Y * 2);
  };

  $: xPct = (year: number) => +((xScale(year) / width) * 100).toFixed(1);
  $: yPct = (value: number) => +((yScale(value) / height) * 100).toFixed(1);

  $: path = cleaned.length
    ? "M" +
      cleaned
        .map((p) => `${xScale(p.year).toFixed(1)},${yScale(p.value).toFixed(1)}`)
        .join(" L")
    : "";

  $: lastPoint = cleaned[cleaned.length - 1] ?? null;

  $: yTicks = (() => {
    if (!cleaned.length) return null;
    const values = cleaned.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return null;
    return { min, max };
  })();

  $: clampLabelY = (y: number) => Math.max(12, Math.min(plotH - 12, y));
  $: startYear = years[0] ?? null;
  $: endYear = years[years.length - 1] ?? null;

  /** Where the x-axis baseline draws — at the actual zero reference, even when broken. */
  $: zeroY = doBreak ? height - 4 : plotH - 0.5;

  let hoverIdx: number | null = null;
  let chartContainer: HTMLDivElement | undefined;

  const handleHoverMove = (e: MouseEvent | TouchEvent) => {
    if (!cleaned.length || !chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();
    const clientX =
      "touches" in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
    if (clientX === undefined) return;
    const xRatio = (clientX - rect.left) / rect.width;
    const targetX = xRatio * width;
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < cleaned.length; i += 1) {
      const dx = Math.abs(xScale(cleaned[i].year) - targetX);
      if (dx < bestD) {
        bestD = dx;
        bestI = i;
      }
    }
    hoverIdx = bestI;
  };
  const handleHoverLeave = () => {
    hoverIdx = null;
  };

  $: hoverPoint =
    hoverIdx !== null && hoverIdx < cleaned.length ? cleaned[hoverIdx] : null;
</script>

<div
  class="flex w-full items-start"
  style="--y-label-w: {yLabelGutter}px; --end-label-w: {endLabelGutter}px; --data-h: {height}px;"
>
  <!-- y-axis label gutter (outside left of spine) -->
  <div class="relative shrink-0" style="width: var(--y-label-w); height: var(--data-h);">
    {#if yTicks}
      <div
        class="pointer-events-none absolute right-1.5 text-xs tabular-nums leading-none"
        style="top: {(yScale(yTicks.max) / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
      >
        {formatValue(yTicks.max)}
      </div>
      <div
        class="pointer-events-none absolute right-1.5 text-xs tabular-nums leading-none"
        style="top: {(yScale(yTicks.min) / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
      >
        {formatValue(yTicks.min)}
      </div>
    {/if}
    {#if doBreak}
      <div
        class="pointer-events-none absolute right-1.5 text-xs tabular-nums leading-none"
        style="top: {zeroY}px; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
      >
        0
      </div>
    {/if}
  </div>

  <div class="flex min-w-0 flex-1 flex-col">
    <div class="relative" style="height: var(--data-h);">
      <!-- y-axis spine (full height) -->
      <div
        class="pointer-events-none absolute left-0 top-0 w-px"
        style="height: 100%; background: {AXIS_COLOR};"
      ></div>

      <!-- y-axis tick marks (extending right into chart) -->
      {#if yTicks}
        <div
          class="pointer-events-none absolute h-px"
          style="left: 0; width: 4px; top: {(yScale(yTicks.max) / height) * 100}%; transform: translateY(-50%); background: {AXIS_COLOR};"
        ></div>
        <div
          class="pointer-events-none absolute h-px"
          style="left: 0; width: 4px; top: {(yScale(yTicks.min) / height) * 100}%; transform: translateY(-50%); background: {AXIS_COLOR};"
        ></div>
      {/if}

      <!-- axis-break indicator + 0 tick -->
      {#if doBreak}
        <!-- white-out a slice of the spine to make the break visually obvious -->
        <div
          class="pointer-events-none absolute"
          style="left: -1px; top: {plotH + 1}px; width: 3px; height: {height - plotH - 6}px; background: white;"
        ></div>
        <svg
          class="pointer-events-none absolute"
          style="left: -6px; top: {plotH + 1}px; width: 14px; height: {height - plotH - 6}px;"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1={height - plotH - 12}
            x2="14"
            y2={2}
            stroke={AXIS_COLOR}
            stroke-width="1.25"
            vector-effect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1={height - plotH - 6}
            x2="14"
            y2={8}
            stroke={AXIS_COLOR}
            stroke-width="1.25"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <!-- 0 tick mark at the actual zero baseline -->
        <div
          class="pointer-events-none absolute h-px"
          style="left: 0; width: 4px; top: {zeroY}px; transform: translateY(-50%); background: {AXIS_COLOR};"
        ></div>
      {/if}

      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        class="block w-full"
        style="height: var(--data-h);"
        aria-hidden="true"
      >
        <!-- x-axis baseline at the zero reference (in break band when present) -->
        <line
          x1="0"
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke={AXIS_COLOR}
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
        {#if path}
          <path
            d={path}
            fill="none"
            {stroke}
            stroke-width={strokeWidth}
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />
        {/if}
      </svg>
      {#each cleaned as p, i}
        <span
          class="spark287-dot spark287-dot--total"
          class:spark287-dot--hover={hoverIdx === i}
          style="left:{xPct(p.year)}%;top:{yPct(p.value)}%;background:{stroke}"
        ></span>
      {/each}

      <!-- Hover crosshair -->
      {#if hoverPoint}
        <div
          class="pointer-events-none absolute top-0 z-20 w-px bg-slate-400/70"
          style="left: {xPct(hoverPoint.year)}%; height: {plotH}px;"
        ></div>
      {/if}

      <!-- Pointer-capture overlay for hover tracking -->
      <div
        bind:this={chartContainer}
        class="absolute inset-0 z-10"
        on:mousemove={handleHoverMove}
        on:mouseleave={handleHoverLeave}
        on:touchstart|passive={handleHoverMove}
        on:touchmove|passive={handleHoverMove}
        on:touchend={handleHoverLeave}
        role="presentation"
      ></div>

      <!-- Tooltip -->
      {#if hoverPoint}
        <div
          class="pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-tight shadow-md"
          style="left: clamp(0%, {xPct(hoverPoint.year)}%, 100%); top: 0; transform: translate(-50%, calc(-100% - 6px));"
        >
          <div class="tabular-nums text-slate-500">{hoverPoint.year}</div>
          <div class="text-sm font-semibold tabular-nums" style="color: {stroke};">
            {formatValue(hoverPoint.value)}{unitLabel ? ` ${unitLabel}` : ""}
          </div>
        </div>
      {/if}

      <!-- x-axis tick marks at endpoints (anchored to the zero baseline) -->
      {#if startYear !== null}
        <div
          class="pointer-events-none absolute w-px"
          style="left: 0; top: {zeroY}px; height: 4px; background: {AXIS_COLOR};"
        ></div>
      {/if}
      {#if endYear !== null && endYear !== startYear}
        <div
          class="pointer-events-none absolute w-px"
          style="right: 0; top: {zeroY}px; height: 4px; background: {AXIS_COLOR};"
        ></div>
      {/if}
    </div>

    <div class="relative" style="height: {axisBelow}px;">
      {#if startYear !== null}
        <span
          class="absolute text-[11px] tabular-nums leading-none"
          style="left: 0; top: 4px; transform: translateX(-50%); color: {AXIS_LABEL_COLOR};"
        >
          {startYear}
        </span>
      {/if}
      {#if endYear !== null && endYear !== startYear}
        <span
          class="absolute text-[11px] tabular-nums leading-none"
          style="right: 0; top: 4px; transform: translateX(50%); color: {AXIS_LABEL_COLOR};"
        >
          {endYear}
        </span>
      {/if}
    </div>
  </div>

  <div class="relative shrink-0" style="width: var(--end-label-w); height: var(--data-h);">
    {#if lastPoint}
      <div
        class="absolute left-1.5 whitespace-nowrap text-left text-sm leading-tight"
        style="top: {clampLabelY(yScale(lastPoint.value))}px; transform: translateY(-50%);"
      >
        <div class="font-semibold tabular-nums" style="color: {stroke};">
          {formatValue(lastPoint.value)}
        </div>
      </div>
    {/if}
  </div>
</div>
