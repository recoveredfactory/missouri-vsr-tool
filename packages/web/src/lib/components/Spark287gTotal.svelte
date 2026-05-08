<script lang="ts">
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  type Series = Array<{ year: number; value: number | null }>;

  export let series: Series = [];
  export let stroke = "#0f172a";
  export let formatValue: (value: number) => string = (v) => String(v);
  export let width = 220;
  export let height = 165;
  export let strokeWidth = 2.75;
  export let minDomain: number | null = null;
  /** Reserve bottom band to show a "0" reference with a break indicator. */
  export let showZeroBreak = false;
  export let yLabelGutter = 36;
  export let endLabelGutter = 56;
  export let axisBelow = 16;
  /** Duration of value→value animation when series content changes (ms). */
  export let animateMs = 380;

  /**
   * Pair points by year so animation morphs values rather than redraws.
   * Falls back to copy on shape change (different years / lengths).
   */
  const interpolateSeries = (a: Series, b: Series) => {
    const sameShape =
      a.length === b.length && a.every((p, i) => p?.year === b[i]?.year);
    if (!sameShape) return (_t: number) => b;
    return (t: number) =>
      b.map((bp, i) => {
        const av = a[i]?.value;
        const bv = bp.value;
        if (typeof av !== "number" || typeof bv !== "number") {
          return { year: bp.year, value: bv };
        }
        return { year: bp.year, value: av + (bv - av) * t };
      });
  };

  const seriesTween = tweened<Series>([], {
    duration: animateMs,
    easing: cubicOut,
    interpolate: interpolateSeries,
  });
  $: seriesTween.set(series);
  $: tweenedSeries = $seriesTween;

  const AXIS_COLOR = "#cbd5e1"; // slate-300
  const AXIS_LABEL_COLOR = "#64748b"; // slate-500
  const BREAK_BAND = 22;
  const PAD_Y = 10;

  $: cleaned = tweenedSeries.filter(
    (p) => typeof p.value === "number" && Number.isFinite(p.value as number),
  ) as Array<{ year: number; value: number }>;

  $: years = cleaned.map((p) => p.year);

  $: yDomain = (() => {
    if (!cleaned.length) return { min: 0, max: 1 };
    const values = cleaned.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (minDomain !== null) min = Math.min(min, minDomain);
    if (min === max) return { min: min - 0.5, max: max + 0.5 };
    const span = max - min;
    return { min, max: max + span * 0.1 };
  })();

  $: dataMin = cleaned.length ? Math.min(...cleaned.map((p) => p.value)) : 0;
  $: doBreak = showZeroBreak && cleaned.length > 0 && dataMin > 0;

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
</script>

<div
  class="flex w-full items-start"
  style="--y-label-w: {yLabelGutter}px; --end-label-w: {endLabelGutter}px; --data-h: {height}px;"
>
  <!-- y-axis label gutter (outside left of spine) -->
  <div class="relative shrink-0" style="width: var(--y-label-w); height: var(--data-h);">
    {#if yTicks}
      <div
        class="pointer-events-none absolute right-1.5 text-[10px] tabular-nums leading-none"
        style="top: {(yScale(yTicks.max) / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
      >
        {formatValue(yTicks.max)}
      </div>
      <div
        class="pointer-events-none absolute right-1.5 text-[10px] tabular-nums leading-none"
        style="top: {(yScale(yTicks.min) / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
      >
        {formatValue(yTicks.min)}
      </div>
    {/if}
    {#if doBreak}
      <div
        class="pointer-events-none absolute right-1.5 text-[10px] tabular-nums leading-none"
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
      {#each cleaned as p}
        <span
          class="spark287-dot spark287-dot--total"
          style="left:{xPct(p.year)}%;top:{yPct(p.value)}%;background:{stroke}"
        ></span>
      {/each}

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
          class="absolute text-[9px] tabular-nums leading-none"
          style="left: 0; top: 4px; transform: translateX(-50%); color: {AXIS_LABEL_COLOR};"
        >
          {startYear}
        </span>
      {/if}
      {#if endYear !== null && endYear !== startYear}
        <span
          class="absolute text-[9px] tabular-nums leading-none"
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
        class="absolute left-1.5 whitespace-nowrap text-left text-[11px] leading-tight"
        style="top: {clampLabelY(yScale(lastPoint.value))}px; transform: translateY(-50%);"
      >
        <div class="font-semibold tabular-nums" style="color: {stroke};">
          {formatValue(lastPoint.value)}
        </div>
      </div>
    {/if}
  </div>
</div>
