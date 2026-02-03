<script>
  import { Chart, Svg, Axis, Spline, Highlight, Tooltip, Points } from "layerchart";
  import { scaleBand } from "d3-scale";

  export let lineSeries = [];
  export let lineData = [];
  export let lineValuesByYear = {};
  export let raceKeys = [];
  export let raceLabel = (value) => value;
  export let raceColor = () => "#4d9078";
  export let formatChartValue = (value) =>
    value === null || value === undefined ? "—" : String(value);

  const axisTickStyle = "fill: #0f172a; font-size: 11px; font-weight: 600;";
  const axisXTickStyle = "fill: #64748b; font-size: 10px; font-weight: 500;";
</script>

<Chart
  data={lineData}
  x="year"
  y="value"
  xScale={scaleBand().paddingInner(0.4).paddingOuter(0.2)}
  yDomain={[0, null]}
  yNice
  c="race"
  cDomain={raceKeys}
  cRange={raceKeys.map(raceColor)}
  padding={{ left: 64, right: 12, bottom: 24, top: 8 }}
  tooltip={{ mode: "quadtree-x" }}
>
  <Svg>
    <Axis
      placement="left"
      grid={{ class: "stroke-slate-200/70" }}
      rule={{ class: "stroke-slate-400" }}
      tickLength={3}
      ticks={4}
      format={(value) => formatChartValue(value)}
      tickLabelProps={{
        style: axisTickStyle,
      }}
    />
    {#each lineSeries as series}
      <Spline
        data={series.data}
        x="year"
        y="value"
        class="stroke-[3.5]"
        stroke={raceColor(series.race)}
      />
    {/each}
    <Points data={lineData} x="year" y="value" r={4.5} />
    {#each raceKeys as race}
      <Highlight
        y={(d) => lineValuesByYear?.[d?.year]?.[race] ?? null}
        points={{ fill: raceColor(race) }}
      />
    {/each}
    <Highlight lines />
    <Axis
      placement="bottom"
      rule={{ class: "stroke-slate-400" }}
      tickLength={3}
      tickLabelProps={{
        style: axisXTickStyle,
      }}
    />
  </Svg>
  <Tooltip.Root>
    {#snippet children({ data })}
      {#if data}
        <Tooltip.Header>{data.year}</Tooltip.Header>
        <Tooltip.List>
          {#each raceKeys as race}
            <Tooltip.Item
              label={raceLabel(race)}
              value={formatChartValue(lineValuesByYear?.[data.year]?.[race])}
              color={raceColor(race)}
              valueAlign="right"
            />
          {/each}
        </Tooltip.List>
      {/if}
    {/snippet}
  </Tooltip.Root>
</Chart>
