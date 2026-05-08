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
  export let height = 165;
  export let strokeWidth = 2.25;
  /**
   * Y-domain min. Race-rate charts force 0; pass null to derive from data min.
   */
  export let minDomain: number | null = 0;
  export let yLabelGutter = 56;
  export let endLabelGutter = 64;
  export let axisBelow = 16;

  const RACES: readonly Race[] = ["White", "Black", "Hispanic"] as const;
  const AXIS_COLOR = "#cbd5e1"; // slate-300
  const AXIS_LABEL_COLOR = "#64748b"; // slate-500
  const PAD_Y = 10;

  $: cleanedByRace = (() => {
    const out = {} as Record<Race, Array<{ year: number; value: number }>>;
    for (const race of RACES) {
      const arr = seriesByRace[race] ?? [];
      out[race] = arr.filter(
        (p) => typeof p.value === "number" && Number.isFinite(p.value as number),
      ) as Array<{ year: number; value: number }>;
    }
    return out;
  })();

  $: refCleaned = (referenceSeries ?? []).filter(
    (p) => typeof p.value === "number" && Number.isFinite(p.value as number),
  ) as Array<{ year: number; value: number }>;

  $: years = (() => {
    const set = new Set<number>();
    for (const race of RACES) for (const p of cleanedByRace[race]) set.add(p.year);
    for (const p of refCleaned) set.add(p.year);
    return Array.from(set).sort((a, b) => a - b);
  })();

  $: yDomain = (() => {
    const all: number[] = [];
    for (const race of RACES) for (const p of cleanedByRace[race]) all.push(p.value);
    for (const p of refCleaned) all.push(p.value);
    if (!all.length) return { min: 0, max: 1 };
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (minDomain !== null) min = Math.min(min, minDomain);
    if (min === max) return { min: min - 0.5, max: max + 0.5 };
    const span = max - min;
    return { min, max: max + span * 0.1 };
  })();

  /**
   * Y-tick labels: anchor at 0 (or domain min) and the data max.
   * Race-start labels handle the rest of the y-axis context.
   */
  $: yTicks = (() => {
    const all: number[] = [];
    for (const race of RACES) for (const p of cleanedByRace[race]) all.push(p.value);
    if (!all.length) return null;
    const dataMax = Math.max(...all);
    const tickMin = minDomain !== null ? minDomain : Math.min(...all);
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
    return PAD_Y + (1 - t) * (height - PAD_Y * 2);
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
    const minSpacing = 16;
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
    const minSpacing = 16;
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

  /** Where the x-axis baseline draws — at the actual zero (or domain min) position. */
  $: zeroY = yScale(yDomain.min);
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
          class="pointer-events-none absolute right-1.5 text-[10px] tabular-nums leading-none"
          style="top: {(maxY / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
        >
          {formatValue(yTicks.max)}
        </div>
      {/if}
      {#if !minClash}
        <div
          class="pointer-events-none absolute right-1.5 text-[10px] tabular-nums leading-none"
          style="top: {(minY / height) * 100}%; transform: translateY(-50%); color: {AXIS_LABEL_COLOR};"
        >
          {formatValue(yTicks.min)}
        </div>
      {/if}
    {/if}
    {#each startLabels as label}
      <div
        class="absolute right-1.5 whitespace-nowrap text-right text-[10px] leading-tight tabular-nums"
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
            style="left:{xPct(p.year)}%;top:{yPct(p.value)}%;background:{raceColors[race]}"
          ></span>
        {/each}
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
    {#each endLabels as label}
      <div
        class="absolute left-1.5 whitespace-nowrap text-left text-[10px] leading-tight tabular-nums"
        style="top: {label.y}px; transform: translateY(-50%); color: {raceColors[label.race]};"
      >
        <span class="font-semibold">{labelsByRace[label.race]}</span>
        <span class="ml-0.5">{formatValue(label.value)}</span>
      </div>
    {/each}
  </div>
</div>
