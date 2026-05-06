<script lang="ts">
  type Series = Array<{ year: number; value: number | null }>;

  export let series: Series = [];
  /** Optional reference series rendered as a dashed grey line. Should use the same year axis. */
  export let referenceSeries: Series | null = null;
  export let stroke = "#0f172a";
  export let referenceStroke = "#94a3b8";
  /** Format the inline number labels (e.g. "1,234" or "12.4%"). */
  export let formatValue: (value: number) => string = (v) => String(v);
  /** SVG drawing area only — labels render outside via CSS. */
  export let width = 220;
  export let height = 56;
  export let strokeWidth = 1.75;

  $: cleaned = series.filter(
    (p) => typeof p.value === "number" && Number.isFinite(p.value as number),
  ) as Array<{ year: number; value: number }>;

  $: refCleaned = (referenceSeries ?? []).filter(
    (p) => typeof p.value === "number" && Number.isFinite(p.value as number),
  ) as Array<{ year: number; value: number }>;

  // x-domain: union of years in primary + reference series
  $: years = (() => {
    const set = new Set<number>();
    for (const p of cleaned) set.add(p.year);
    for (const p of refCleaned) set.add(p.year);
    return Array.from(set).sort((a, b) => a - b);
  })();

  $: yDomain = (() => {
    const all: number[] = [];
    for (const p of cleaned) all.push(p.value);
    for (const p of refCleaned) all.push(p.value);
    if (!all.length) return { min: 0, max: 1 };
    const min = Math.min(...all);
    const max = Math.max(...all);
    if (min === max) return { min: min - 0.5, max: max + 0.5 };
    return { min, max };
  })();

  const PAD = 4;

  $: xScale = (year: number) => {
    if (years.length === 0) return PAD;
    if (years.length === 1) return width / 2;
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const t = (year - minYear) / (maxYear - minYear);
    return PAD + t * (width - PAD * 2);
  };

  $: yScale = (value: number) => {
    const { min, max } = yDomain;
    const t = (value - min) / (max - min);
    return PAD + (1 - t) * (height - PAD * 2);
  };

  $: pathFor = (points: Array<{ year: number; value: number }>) =>
    points.length
      ? "M" +
        points
          .map((p) => `${xScale(p.year).toFixed(1)},${yScale(p.value).toFixed(1)}`)
          .join(" L")
      : "";

  $: primaryPath = pathFor(cleaned);
  $: referencePath = pathFor(refCleaned);
  $: firstPoint = cleaned[0] ?? null;
  $: lastPoint = cleaned[cleaned.length - 1] ?? null;
</script>

<div class="flex w-full items-stretch gap-2">
  <div class="flex flex-col items-end justify-center text-right text-[11px] leading-tight">
    {#if firstPoint}
      <span class="font-semibold text-slate-900 tabular-nums">{formatValue(firstPoint.value)}</span>
      <span class="text-[10px] text-slate-400 tabular-nums">{firstPoint.year}</span>
    {:else}
      <span class="text-slate-300">—</span>
    {/if}
  </div>
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    class="block h-auto min-w-0 flex-1 overflow-visible"
    aria-hidden="true"
  >
    <line
      x1="0"
      x2={width}
      y1={height - 0.5}
      y2={height - 0.5}
      stroke="#e2e8f0"
      stroke-width="0.5"
    />
    {#if referencePath}
      <path
        d={referencePath}
        fill="none"
        stroke={referenceStroke}
        stroke-width="1"
        stroke-dasharray="3 3"
      />
    {/if}
    {#if primaryPath}
      <path
        d={primaryPath}
        fill="none"
        stroke={stroke}
        stroke-width={strokeWidth}
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      {#each cleaned as p}
        <circle cx={xScale(p.year)} cy={yScale(p.value)} r="2" fill={stroke} />
      {/each}
    {/if}
  </svg>
  <div class="flex flex-col items-start justify-center text-left text-[11px] leading-tight">
    {#if lastPoint}
      <span class="font-semibold text-slate-900 tabular-nums">{formatValue(lastPoint.value)}</span>
      <span class="text-[10px] text-slate-400 tabular-nums">{lastPoint.year}</span>
    {:else}
      <span class="text-slate-300">—</span>
    {/if}
  </div>
</div>
