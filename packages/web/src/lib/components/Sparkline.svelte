<script lang="ts">
  export let values: Array<number | null | undefined> = [];
  export let width = 96;
  export let height = 32;
  export let stroke = "#0f172a";
  export let strokeWidth = 1.25;
  export let baselineColor = "#cbd5e1";

  $: points = (() => {
    if (!Array.isArray(values) || values.length === 0) return [];
    const valid = values.map((v, i) => ({ v: typeof v === "number" && Number.isFinite(v) ? v : null, i }));
    const numericValues = valid.filter((p) => p.v !== null).map((p) => p.v as number);
    if (!numericValues.length) return [];
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const range = max - min || 1;
    const xStep = values.length > 1 ? width / (values.length - 1) : 0;
    return valid
      .filter((p) => p.v !== null)
      .map(({ v, i }) => ({
        x: xStep * i,
        y: height - ((v as number - min) / range) * height,
      }));
  })();

  $: pathD = points.length
    ? "M" + points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")
    : "";

  $: lastPoint = points.length ? points[points.length - 1] : null;
</script>

<svg
  {width}
  {height}
  viewBox={`0 0 ${width} ${height}`}
  class="block overflow-visible"
  aria-hidden="true"
>
  <line
    x1="0"
    x2={width}
    y1={height - 0.5}
    y2={height - 0.5}
    stroke={baselineColor}
    stroke-width="0.5"
  />
  {#if pathD}
    <path
      d={pathD}
      fill="none"
      stroke={stroke}
      stroke-width={strokeWidth}
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  {/if}
  {#if lastPoint}
    <circle cx={lastPoint.x} cy={lastPoint.y} r="1.75" fill={stroke} />
  {/if}
</svg>
