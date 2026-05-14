<script lang="ts">
  import { raceColors } from "$lib/colors.js";

  type Race = "White" | "Black" | "Hispanic";
  type Series = Array<{ year: number; value: number | null }>;

  export let seriesByRace: Record<Race, Series>;
  /** Optional statewide reference rendered as a dashed grey line. */
  export let referenceSeries: Series | null = null;
  export let referenceStroke = "#94a3b8";
  export let labelsByRace: Record<Race, string> = { White: "Wh.", Black: "Bl.", Hispanic: "Hsp." };
  export let formatValue: (value: number) => string = (v) => String(v);
  export let width = 220;
  export let height = 220;
  export let strokeWidth = 2.5;
  /**
   * Y-domain min when `showZeroBreak` is false. Set to null to derive from
   * the data. With `showZeroBreak` on, this is ignored — the axis crops to
   * the data range and the break is drawn at the bottom.
   */
  export let minDomain: number | null = 0;
  /** Crop axis to data range and signal it with a break at the bottom. */
  export let showZeroBreak = false;
  export let yLabelGutter = 64;
  export let endLabelGutter = 72;
  export let axisBelow = 20;
  /** Optional unit suffix shown after the value in the hover tooltip. */
  export let unitLabel = "";
  /** Label for the statewide reference row in the tooltip. */
  export let referenceLabel = "Statewide";

  const RACES: readonly Race[] = ["White", "Black", "Hispanic"] as const;
  const AXIS_COLOR = "#cbd5e1"; // slate-300
  const AXIS_LABEL_COLOR = "#64748b"; // slate-500
  const PAD_Y = 10;
  /**
   * When the axis is broken, the band below the data takes ~1/3 of the chart
   * height. This signals "we're far from zero" without exaggerating the data
   * range — the data line keeps about 2/3 of the vertical real estate.
   */
  $: BREAK_BAND = Math.round(height / 3);
  /** Fixed visual height of the diagonal break indicator regardless of band size. */
  const BREAK_INDICATOR_H = 16;

  // Render the supplied series directly — no tween. The rolling-avg toggle
  // updates a lot of charts at once and animating them all was janky on
  // phones. The race-selector animation in ShareChart287g is the only place
  // we tween charts on this page.
  $: cleanedByRace = (() => {
    const out = {} as Record<Race, Array<{ year: number; value: number }>>;
    for (const race of RACES) {
      out[race] = (seriesByRace[race] ?? []).filter(
        (p) => typeof p.value === "number" && Number.isFinite(p.value as number),
      ) as Array<{ year: number; value: number }>;
    }
    return out;
  })();

  $: refCleaned = (referenceSeries ?? [])
    .filter(
      (p) => typeof p.value === "number" && Number.isFinite(p.value),
    ) as Array<{ year: number; value: number }>;

  $: years = (() => {
    const set = new Set<number>();
    for (const race of RACES) for (const p of cleanedByRace[race]) set.add(p.year);
    for (const p of refCleaned) set.add(p.year);
    return Array.from(set).sort((a, b) => a - b);
  })();

  $: dataValues = (() => {
    const all: number[] = [];
    for (const race of RACES) for (const p of cleanedByRace[race]) all.push(p.value);
    for (const p of refCleaned) all.push(p.value);
    return all;
  })();
  $: dataMin = dataValues.length ? Math.min(...dataValues) : 0;
  $: dataMax = dataValues.length ? Math.max(...dataValues) : 0;
  /**
   * Crop & break only when the floor is meaningfully above zero (>= 5 in
   * data units). Matches Spark287gTotal's convention so every chart on the
   * page treats the y-axis the same way.
   */
  const ZERO_BREAK_FLOOR = 5;
  $: doBreak =
    showZeroBreak && dataValues.length > 0 && dataMin >= ZERO_BREAK_FLOOR;

  $: yDomain = (() => {
    if (!dataValues.length) return { min: 0, max: 1 };
    let min = dataMin;
    let max = dataMax;
    // Anchor at minDomain (e.g. 0) only when we're NOT cropping to data.
    if (!doBreak && minDomain !== null) min = Math.min(min, minDomain);
    if (min === max) return { min: min - 0.5, max: max + 0.5 };
    const span = max - min;
    return { min, max: max + span * 0.1 };
  })();

  /** Vertical span available to plot data — full height minus break band when active. */
  $: plotH = doBreak ? height - BREAK_BAND : height;

  /**
   * Y-tick labels: bottom = data min when broken, otherwise minDomain (or
   * data min). Top = data max.
   */
  $: yTicks = (() => {
    if (!dataValues.length) return null;
    const tickMin = doBreak
      ? dataMin
      : minDomain !== null
        ? minDomain
        : dataMin;
    if (tickMin === dataMax) return null;
    return { min: tickMin, max: dataMax };
  })();

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

  $: referencePath = pathFor(refCleaned);

  type EndLabel = { race: Race; year: number; value: number; y: number };
  $: endLabels = (() => {
    const items: EndLabel[] = [];
    for (const race of RACES) {
      const arr = cleanedByRace[race];
      const last = arr[arr.length - 1];
      if (!last) continue;
      items.push({ race, year: last.year, value: last.value, y: yScale(last.value) });
    }
    items.sort((a, b) => a.y - b.y);
    const minSpacing = 18;
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].y - items[i - 1].y < minSpacing) {
        items[i].y = items[i - 1].y + minSpacing;
      }
    }
    return items.map((it) => ({
      ...it,
      y: Math.max(8, Math.min(height - 8, it.y)),
    }));
  })();

  /** Race-start labels in the LEFT gutter — mirror of endLabels. */
  $: startLabels = (() => {
    const items: EndLabel[] = [];
    for (const race of RACES) {
      const arr = cleanedByRace[race];
      const first = arr[0];
      if (!first) continue;
      items.push({ race, year: first.year, value: first.value, y: yScale(first.value) });
    }
    items.sort((a, b) => a.y - b.y);
    const minSpacing = 18;
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].y - items[i - 1].y < minSpacing) {
        items[i].y = items[i - 1].y + minSpacing;
      }
    }
    return items.map((it) => ({
      ...it,
      y: Math.max(8, Math.min(height - 8, it.y)),
    }));
  })();

  $: startYear = years[0] ?? null;
  $: endYear = years[years.length - 1] ?? null;

  /**
   * Where the x-axis baseline draws — at the actual zero reference. When the
   * axis is broken, the baseline sits inside the break band at the bottom
   * (matching Spark287gTotal's `height - 4` placement).
   */
  $: zeroY = doBreak ? height - 4 : yScale(yDomain.min);

  let hoverYear: number | null = null;
  let chartContainer: HTMLDivElement | undefined;

  const handleHoverMove = (e: MouseEvent) => {
    if (!years.length || !chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const targetX = xRatio * width;
    let bestY = years[0];
    let bestD = Infinity;
    for (const y of years) {
      const d = Math.abs(xScale(y) - targetX);
      if (d < bestD) {
        bestD = d;
        bestY = y;
      }
    }
    hoverYear = bestY;
  };
  const handleHoverLeave = () => {
    hoverYear = null;
  };

  /** Per-race + reference value at the hovered year, for the tooltip. */
  $: hoverValues = (() => {
    if (hoverYear === null) return null;
    const out = {} as Record<Race, number | null> & { ref: number | null };
    for (const r of RACES) {
      const p = cleanedByRace[r].find((q) => q.year === hoverYear);
      out[r] = p ? p.value : null;
    }
    out.ref = refCleaned.find((q) => q.year === hoverYear)?.value ?? null;
    return out;
  })();
</script>

<div
  class="flex w-full items-start"
  style="--y-label-w: {yLabelGutter}px; --end-label-w: {endLabelGutter}px; --data-h: {height}px;"
>
  <!-- y-axis label gutter (outside left of spine) -->
  <div class="relative shrink-0" style="width: var(--y-label-w); height: var(--data-h);">
    {#if yTicks}
      {@const minY = yScale(yTicks.min)}
      {@const maxY = yScale(yTicks.max)}
      {@const startYs = startLabels.map((l) => l.y)}
      {@const minClash = startYs.some((y) => Math.abs(y - minY) < 12)}
      {@const maxClash = startYs.some((y) => Math.abs(y - maxY) < 12)}
      {#if !maxClash}
        <div
          class="pointer-events-none absolute right-1.5 text-xs tabular-nums leading-none"
          style="top: {(maxY / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
        >
          {formatValue(yTicks.max)}
        </div>
      {/if}
      {#if !minClash}
        <div
          class="pointer-events-none absolute right-1.5 text-xs tabular-nums leading-none"
          style="top: {(minY / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
        >
          {formatValue(yTicks.min)}
        </div>
      {/if}
    {/if}
    {#if doBreak}
      <div
        class="pointer-events-none absolute right-1.5 text-xs tabular-nums leading-none"
        style="top: {zeroY}px; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
      >
        0
      </div>
    {/if}
    {#each startLabels as label}
      <div
        class="absolute right-1.5 whitespace-nowrap text-right text-xs leading-tight tabular-nums"
        style="top: {label.y}px; transform: translateY(-50%); color: {raceColors[label.race]};"
      >
        <span class="font-semibold">{labelsByRace[label.race]}</span>
        <span class="ml-0.5">{formatValue(label.value)}</span>
      </div>
    {/each}
  </div>

  <div class="flex min-w-0 flex-1 flex-col">
    <div class="relative" style="height: var(--data-h);">
      <!-- y-axis spine -->
      <div
        class="pointer-events-none absolute left-0 top-0 w-px"
        style="height: 100%; background: {AXIS_COLOR};"
      ></div>

      <!-- y-axis tick marks at data min/max (axis-colored, in chart) -->
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

      <!-- Axis-break indicator + 0 tick (mirrors Spark287gTotal). -->
      {#if doBreak}
        {@const breakTop = plotH + Math.round((BREAK_BAND - BREAK_INDICATOR_H) / 2)}
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
        {#each RACES as race}
          {@const path = pathFor(cleanedByRace[race])}
          {#if path}
            <path
              d={path}
              fill="none"
              stroke={raceColors[race]}
              stroke-width={strokeWidth}
              stroke-linejoin="round"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          {/if}
        {/each}
      </svg>
      {#each RACES as race}
        {#each cleanedByRace[race] as p}
          <span
            class="spark287-dot"
            class:spark287-dot--hover={hoverYear === p.year}
            style="left:{xPct(p.year)}%;top:{yPct(p.value)}%;background:{raceColors[race]}"
          ></span>
        {/each}
      {/each}

      <!-- Hover crosshair -->
      {#if hoverYear !== null}
        <div
          class="pointer-events-none absolute top-0 z-20 w-px bg-slate-400/70"
          style="left: {xPct(hoverYear)}%; height: 100%;"
        ></div>
      {/if}

      <!-- Pointer-capture overlay -->
      <div
        bind:this={chartContainer}
        class="absolute inset-0 z-10"
        on:mousemove={handleHoverMove}
        on:mouseleave={handleHoverLeave}
        role="presentation"
      ></div>

      <!-- Tooltip -->
      {#if hoverYear !== null && hoverValues}
        <div
          class="pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-tight shadow-md"
          style="left: clamp(0%, {xPct(hoverYear)}%, 100%); top: 0; transform: translate(-50%, calc(-100% - 6px));"
        >
          <div class="mb-1 tabular-nums text-slate-500">{hoverYear}</div>
          <div class="grid grid-cols-[max-content_max-content] gap-x-3 gap-y-0.5 text-sm tabular-nums">
            {#each RACES as race}
              <span class="font-semibold" style="color: {raceColors[race]};"
                >{labelsByRace[race]}</span
              >
              <span class="text-right text-slate-900">
                {hoverValues[race] !== null
                  ? `${formatValue(hoverValues[race] as number)}${unitLabel ? ` ${unitLabel}` : ""}`
                  : "—"}
              </span>
            {/each}
            {#if hoverValues.ref !== null}
              <span class="text-slate-500">{referenceLabel}</span>
              <span class="text-right text-slate-900">
                {formatValue(hoverValues.ref)}{unitLabel ? ` ${unitLabel}` : ""}
              </span>
            {/if}
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
    {#each endLabels as label}
      <div
        class="absolute left-1.5 whitespace-nowrap text-left text-xs leading-tight tabular-nums"
        style="top: {label.y}px; transform: translateY(-50%); color: {raceColors[label.race]};"
      >
        <span class="font-semibold">{labelsByRace[label.race]}</span>
        <span class="ml-0.5">{formatValue(label.value)}</span>
      </div>
    {/each}
  </div>
</div>
