<script lang="ts">
  import {
    Chart,
    Svg,
    Axis,
    Points,
    Rule,
    Tooltip,
    Highlight,
    Text,
  } from "layerchart";
  import { scaleLinear, scaleLog } from "d3-scale";

  type ScatterPoint = {
    agency: string;
    year: number;
    x: number;
    y: number;
    stops?: number;
    xCount?: number;
    yCount?: number;
  };

  export let points: ScatterPoint[] = [];
  export let domainPoints: ScatterPoint[] | null = null;
  export let activePoint: ScatterPoint | null = null;
  export let meanX: number | null = null;
  export let meanY: number | null = null;
  export let meanXLabel = "";
  export let meanYLabel = "";
  export let formatValue: (value: number | null | undefined) => string = (value) =>
    value === null || value === undefined ? "—" : String(value);
  export let formatCount: (value: number | null | undefined) => string = (value) =>
    value === null || value === undefined ? "—" : String(value);
  export let xLabel = "";
  export let yLabel = "";
  export let xCountLabel = "";
  export let yCountLabel = "";
  export let stopsLabel = "Total stops";
  export let sizeByStops = false;
  export let dotRadiusScale = 1;
  export let xScaleType: "linear" | "log" = "linear";
  export let yScaleType: "linear" | "log" = "linear";
  export let formatStops: (value: number | null | undefined) => string = (value) =>
    value === null || value === undefined ? "—" : String(value);

  const axisTickStyle = "fill: #0f172a; font-size: 11px; font-weight: 600;";
  const axisLabelStyle = "fill: #0f172a; font-size: 10px; font-weight: 600;";
  const topLabelStyle = "fill: #0f172a; font-size: 10px; font-weight: 600;";
  const gridLineMajorClass = "stroke-slate-300/80";
  const gridLineMinorClass = "stroke-slate-200/35";
  const meanLineClass = "stroke-emerald-500/70";
  const meanLabelStyle = "fill: #047857; font-size: 10px; font-weight: 600;";
  const xTickCount = 5;
  const yTickCount = 5;
  const baseRadius = 2.2;
  const minRadius = 0.8;
  const maxRadius = 18;
  const dotFill = "rgba(204, 209, 216, 0.58)";
  const dotStroke = "rgba(126, 139, 156, 0.9)";
  const dotStrokeWidth = 0.8;
  const scaledBaseRadius = baseRadius * dotRadiusScale;
  const activePointRadius = 5.5 * dotRadiusScale;
  const axisMotion = { type: "tween", duration: 240 };
  const topPadding = 22;
  const yLabelOffset = -12;
  const logMinorFactors = [2, 3, 4, 5, 6, 7, 8, 9];

  const isMajorLogTick = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return false;
    const logValue = Math.log10(value);
    return Math.abs(logValue - Math.round(logValue)) < 1e-6;
  };

  const getLogTickSets = (extent: { min: number; max: number }) => {
    const major: number[] = [];
    const minor: number[] = [];
    const minExp = Math.floor(Math.log10(extent.min));
    const maxExp = Math.ceil(Math.log10(extent.max));
    for (let exp = minExp; exp <= maxExp; exp += 1) {
      const base = Math.pow(10, exp);
      if (base >= extent.min && base <= extent.max) {
        major.push(base);
      }
      logMinorFactors.forEach((factor) => {
        const value = base * factor;
        if (value >= extent.min && value <= extent.max) {
          minor.push(value);
        }
      });
    }
    return {
      major,
      minor,
    };
  };

  const getPositiveExtent = (data: ScatterPoint[], key: "x" | "y") => {
    let min = Infinity;
    let max = -Infinity;
    data.forEach((point) => {
      const value = point[key];
      if (!Number.isFinite(value) || value <= 0) return;
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max };
  };

  $: domainSource =
    domainPoints && Array.isArray(domainPoints) && domainPoints.length
      ? domainPoints
      : points;
  $: xMax = domainSource.reduce(
    (max, point) => (Number.isFinite(point.x) && point.x > max ? point.x : max),
    0
  );
  $: yMax = domainSource.reduce(
    (max, point) => (Number.isFinite(point.y) && point.y > max ? point.y : max),
    0
  );
  $: xExtent = getPositiveExtent(domainSource, "x");
  $: yExtent = getPositiveExtent(domainSource, "y");
  $: xLogTicks =
    xScaleType === "log" && xExtent ? getLogTickSets(xExtent) : null;
  $: yLogTicks =
    yScaleType === "log" && yExtent ? getLogTickSets(yExtent) : null;
  $: resolvedXDomain =
    xScaleType === "log"
      ? [xExtent?.min ?? 1, xExtent?.max ?? 1]
      : [0, xMax || 0];
  $: resolvedYDomain =
    yScaleType === "log"
      ? [yExtent?.min ?? 1, yExtent?.max ?? 1]
      : [0, yMax || 0];
  $: xTicks = (() => {
    if (xScaleType === "log") {
      return xLogTicks?.major ?? [];
    }
    const scale = scaleLinear().domain([0, xMax]).nice();
    const ticks = scale.ticks(xTickCount);
    return ticks.length ? ticks : [0];
  })();
  $: yTicks = (() => {
    if (yScaleType === "log") {
      return yLogTicks?.major ?? [];
    }
    const scale = scaleLinear().domain([0, yMax]).nice();
    const ticks = scale.ticks(yTickCount);
    return ticks.length ? ticks : [0];
  })();
</script>

<Chart
  data={points}
  x="x"
  y="y"
  r={sizeByStops ? "stops" : undefined}
  rScale={sizeByStops ? scaleLog() : undefined}
  rRange={sizeByStops ? [minRadius, maxRadius] : undefined}
  xScale={xScaleType === "log" ? scaleLog() : scaleLinear()}
  yScale={yScaleType === "log" ? scaleLog() : scaleLinear()}
  xDomain={resolvedXDomain}
  yDomain={resolvedYDomain}
  yNice={yScaleType === "linear"}
  padding={{ left: 28, right: 10, bottom: 28, top: topPadding }}
  tooltip={{ mode: "quadtree" }}
>
  <Svg>
    {#if xScaleType === "log" && xLogTicks}
      {#each xLogTicks.minor as tick (tick)}
        <Rule x={tick} class={gridLineMinorClass} motion={axisMotion} />
      {/each}
      {#each xLogTicks.major as tick (tick)}
        <Rule x={tick} class={gridLineMajorClass} motion={axisMotion} />
      {/each}
    {/if}
    {#if yScaleType === "log" && yLogTicks}
      {#each yLogTicks.minor as tick (tick)}
        <Rule y={tick} class={gridLineMinorClass} motion={axisMotion} />
      {/each}
      {#each yLogTicks.major as tick (tick)}
        <Rule y={tick} class={gridLineMajorClass} motion={axisMotion} />
      {/each}
    {/if}
    <Axis
      placement="left"
      grid={yScaleType === "log" ? false : { class: gridLineMajorClass }}
      rule={{ class: "stroke-slate-400" }}
      tickLength={2}
      ticks={yTicks}
      motion={axisMotion}
      format={(value) =>
        yScaleType === "log" && !isMajorLogTick(value) ? "" : formatValue(value)
      }
      tickLabelProps={{
        style: axisTickStyle,
      }}
    />
    {#if yLabel}
      <Text
        x={6}
        y={yLabelOffset}
        value={yLabel}
        textAnchor="start"
        verticalAnchor="start"
        style={topLabelStyle}
      />
    {/if}
    <Axis
      placement="bottom"
      grid={xScaleType === "log" ? false : { class: gridLineMajorClass }}
      rule={{ class: "stroke-slate-400" }}
      tickLength={2}
      ticks={xTicks}
      label={xLabel}
      labelPlacement="end"
      motion={axisMotion}
      labelProps={{
        style: axisLabelStyle,
      }}
      tickLabelProps={{
        style: axisTickStyle,
      }}
      format={(value) =>
        xScaleType === "log" && !isMajorLogTick(value) ? "" : formatValue(value)
      }
    />
    <Points
      data={points}
      x="x"
      y="y"
      r={scaledBaseRadius}
      fill={dotFill}
      stroke={dotStroke}
      strokeWidth={dotStrokeWidth}
    />
    {#if Number.isFinite(meanX)}
      <Rule x={meanX} class={meanLineClass} />
    {/if}
    {#if Number.isFinite(meanY)}
      <Rule y={meanY} class={meanLineClass} />
    {/if}
    {#if Number.isFinite(meanX) && meanXLabel}
      <Text
        x={meanX}
        y={resolvedYDomain[1]}
        value={meanXLabel}
        textAnchor="start"
        verticalAnchor="start"
        dx={6}
        dy={6}
        style={meanLabelStyle}
      />
    {/if}
    {#if Number.isFinite(meanY) && meanYLabel}
      <Text
        x={resolvedXDomain[1]}
        y={meanY}
        value={meanYLabel}
        textAnchor="end"
        verticalAnchor="end"
        dx={-6}
        dy={-2}
        style={meanLabelStyle}
      />
    {/if}
    {#if activePoint}
      <Points
        data={[activePoint]}
        x="x"
        y="y"
        r={sizeByStops ? undefined : activePointRadius}
        class="fill-emerald-500 pointer-events-none"
        stroke="#0f172a"
        strokeWidth={1}
      />
    {/if}
    <Highlight lines />
  </Svg>
  <Tooltip.Root classes={{ container: "agency-scatter-tooltip" }}>
    {#snippet children({ data })}
      {#if data}
        <Tooltip.Header>{data.agency}</Tooltip.Header>
        <Tooltip.List>
          <Tooltip.Item
            label={xLabel}
            value={formatValue(data.x)}
            valueAlign="right"
          />
          <Tooltip.Item
            label={yLabel}
            value={formatValue(data.y)}
            valueAlign="right"
          />
          {#if Number.isFinite(data?.xCount) && xCountLabel}
            <Tooltip.Item
              label={xCountLabel}
              value={formatCount(data.xCount)}
              valueAlign="right"
            />
          {/if}
          {#if Number.isFinite(data?.yCount) && yCountLabel}
            <Tooltip.Item
              label={yCountLabel}
              value={formatCount(data.yCount)}
              valueAlign="right"
            />
          {/if}
          {#if Number.isFinite(data?.stops)}
            <Tooltip.Item
              label={stopsLabel}
              value={formatStops(data.stops)}
              valueAlign="right"
            />
          {/if}
        </Tooltip.List>
      {/if}
    {/snippet}
  </Tooltip.Root>
</Chart>

<style>
  :global(.agency-scatter-tooltip) {
    background-color: #fff !important;
    color: #0f172a !important;
    border: 1px solid rgb(226 232 240) !important;
    box-shadow: 0 10px 24px rgb(15 23 42 / 0.16) !important;
    backdrop-filter: none !important;
  }

  :global(.agency-scatter-tooltip .label) {
    color: #475569 !important;
  }
</style>
