<script lang="ts">
  import { tweened } from "svelte/motion";
  import { cubicInOut } from "svelte/easing";
  import { onMount } from "svelte";

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
  /** Optional statewide reference rendered as a dashed grey line. */
  export let referenceSeries: Series | null = null;
  export let referenceStroke = "#94a3b8";
  export let referenceLabel = "Statewide";
  /** Inline tag rendered next to the reference line's start point (e.g. "MO").
   *  When set, the reference line also gets numeric labels at both endpoints. */
  export let referenceTag = "";

  const AXIS_COLOR = "#cbd5e1"; // slate-300
  const AXIS_LABEL_COLOR = "#64748b"; // slate-500
  /**
   * When the axis is broken, the band below the data takes ~1/3 of the chart
   * height. This signals "we're far from zero" without exaggerating the data
   * range — the data line keeps about 2/3 of the vertical real estate.
   */
  $: BREAK_BAND = Math.round(height / 3);
  /** Fixed visual height of the diagonal break indicator regardless of band size. */
  const BREAK_INDICATOR_H = 16;
  const PAD_Y = 10;

  // === Tween infrastructure ===
  // Tween only the y-values; years stay fixed. NaN marks "no data" — the
  // default array interpolator snaps NaN ↔ number transitions instantly,
  // so missing-data points don't propagate NaN through the animation.
  let mounted = false;
  /**
   * Charts off-screen snap to their target instead of animating. With ~12
   * agencies × multiple charts each, rolling-avg toggles otherwise kick off
   * dozens of simultaneous tweens, most invisible.
   */
  let inView = false;
  const seriesValuesTween = tweened<number[]>([], {
    duration: 500,
    easing: cubicInOut,
  });
  const refValuesTween = tweened<number[]>([], {
    duration: 500,
    easing: cubicInOut,
  });
  $: tweenOpts = inView ? undefined : { duration: 0 };
  $: targetSeriesValues = series.map((p) =>
    typeof p.value === "number" && Number.isFinite(p.value as number)
      ? (p.value as number)
      : NaN,
  );
  $: targetRefValues = (referenceSeries ?? []).map((p) =>
    typeof p.value === "number" && Number.isFinite(p.value as number)
      ? (p.value as number)
      : NaN,
  );
  onMount(() => {
    // Seed tweens at duration 0 so the first animated set has a same-length
    // starting array — otherwise svelte/motion throws "Cannot interpolate
    // values of different type" when interpolating from [] to a populated
    // target (a[i] is undefined, b[i] is a number).
    seriesValuesTween.set(targetSeriesValues, { duration: 0 });
    refValuesTween.set(targetRefValues, { duration: 0 });
    mounted = true;

    if (typeof IntersectionObserver === "undefined" || !chartContainer) {
      inView = true;
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(chartContainer);
    return () => io.disconnect();
  });
  $: if (mounted) seriesValuesTween.set(targetSeriesValues, tweenOpts);
  $: if (mounted) refValuesTween.set(targetRefValues, tweenOpts);
  $: liveSeriesValues = mounted ? $seriesValuesTween : targetSeriesValues;
  $: liveRefValues = mounted ? $refValuesTween : targetRefValues;

  $: cleaned = series
    .map((p, i) => ({ year: p.year, value: liveSeriesValues[i] }))
    .filter(
      (p) => typeof p.value === "number" && Number.isFinite(p.value),
    ) as Array<{ year: number; value: number }>;

  $: refCleaned = (referenceSeries ?? [])
    .map((p, i) => ({ year: p.year, value: liveRefValues[i] }))
    .filter(
      (p) => typeof p.value === "number" && Number.isFinite(p.value),
    ) as Array<{ year: number; value: number }>;

  /** Union of years across the main series and reference, sorted. */
  $: years = (() => {
    const set = new Set<number>();
    for (const p of cleaned) set.add(p.year);
    for (const p of refCleaned) set.add(p.year);
    return Array.from(set).sort((a, b) => a - b);
  })();

  /** Values across both series — drives y-domain so reference stays in view. */
  $: allValues = (() => {
    const arr: number[] = [];
    for (const p of cleaned) arr.push(p.value);
    for (const p of refCleaned) arr.push(p.value);
    return arr;
  })();
  $: dataMin = allValues.length ? Math.min(...allValues) : 0;
  $: dataMax = allValues.length ? Math.max(...allValues) : 0;
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

  $: pathFor = (points: Array<{ year: number; value: number }>) =>
    points.length
      ? "M" +
        points
          .map((p) => `${xScale(p.year).toFixed(1)},${yScale(p.value).toFixed(1)}`)
          .join(" L")
      : "";
  $: path = pathFor(cleaned);
  $: referencePath = pathFor(refCleaned);

  $: lastPoint = cleaned[cleaned.length - 1] ?? null;
  $: refStartPoint = refCleaned[0] ?? null;
  $: refEndPoint = refCleaned[refCleaned.length - 1] ?? null;

  $: yTicks = (() => {
    // Tick labels reflect the displayed extent — agency + reference combined —
    // so a reference line that stretches the y-domain still gets honest ticks.
    if (!allValues.length) return null;
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
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
  $: hoverRefValue =
    hoverPoint !== null
      ? refCleaned.find((q) => q.year === hoverPoint.year)?.value ?? null
      : null;
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
        <!-- Centered vertically within the break band so the gap reads as
             empty compressed space on either side of the slash. -->
        {@const breakTop = plotH + Math.round((BREAK_BAND - BREAK_INDICATOR_H) / 2)}
        <!-- white-out a slice of the spine just where the indicator sits -->
        <div
          class="pointer-events-none absolute"
          style="left: -1px; top: {breakTop}px; width: 3px; height: {BREAK_INDICATOR_H}px; background: white;"
        ></div>
        <svg
          class="pointer-events-none absolute"
          style="left: -6px; top: {breakTop}px; width: 14px; height: {BREAK_INDICATOR_H}px;"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="10"
            x2="14"
            y2="2"
            stroke={AXIS_COLOR}
            stroke-width="1.25"
            vector-effect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1="16"
            x2="14"
            y2="8"
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
        {#if referencePath}
          <path
            d={referencePath}
            fill="none"
            stroke={referenceStroke}
            stroke-width="1.25"
            stroke-dasharray="3 3"
            vector-effect="non-scaling-stroke"
          />
        {/if}
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

      <!-- Reference-line endpoint annotations (e.g. "MO 12.3%" at the start
           and "11.7%" at the end). Only rendered when a referenceTag is set. -->
      {#if referenceTag && refStartPoint}
        <span
          class="pointer-events-none absolute z-10 whitespace-nowrap text-[11px] font-medium leading-none"
          style="left: {xPct(refStartPoint.year)}%; top: {yPct(refStartPoint.value)}%; transform: translate(2px, calc(-100% - 4px)); color: {referenceStroke};"
        >
          {referenceTag} {formatValue(refStartPoint.value)}
        </span>
      {/if}
      {#if referenceTag && refEndPoint && refEndPoint !== refStartPoint}
        <span
          class="pointer-events-none absolute z-10 whitespace-nowrap text-[11px] leading-none"
          style="left: {xPct(refEndPoint.year)}%; top: {yPct(refEndPoint.value)}%; transform: translate(calc(-100% - 2px), calc(-100% - 4px)); color: {referenceStroke};"
        >
          {formatValue(refEndPoint.value)}
        </span>
      {/if}

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
          {#if hoverRefValue !== null}
            <div class="mt-0.5 text-xs tabular-nums text-slate-500">
              {referenceLabel}: <span class="text-slate-700"
                >{formatValue(hoverRefValue)}{unitLabel ? ` ${unitLabel}` : ""}</span
              >
            </div>
          {/if}
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
