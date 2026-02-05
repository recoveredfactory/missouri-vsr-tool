<script>
  import { Chart, Svg, Axis, Bars, Highlight, Tooltip } from "layerchart";
  import { scaleBand } from "d3-scale";

  export let stackedData = [];
  export let stackedRaceKeys = [];
  export let raceLabel = (value) => value;
  export let raceColor = () => "#0f766e";
  export let formatChartValue = (value) =>
    value === null || value === undefined ? "—" : String(value);

  const axisTickStyle = "fill: #0f172a; font-size: 11px; font-weight: 600;";
  const axisXTickStyle = "fill: #64748b; font-size: 10px; font-weight: 500;";
</script>

<Chart
  data={stackedData}
  x="year"
  xScale={scaleBand().paddingInner(0.4).paddingOuter(0.2)}
  y="values"
  yNice={4}
  c="race"
  cDomain={stackedRaceKeys}
  cRange={stackedRaceKeys.map(raceColor)}
  padding={{ left: 64, right: 12, bottom: 24, top: 8 }}
  tooltip={{ mode: "band" }}
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
    <Bars strokeWidth={1} />
    <Axis
      placement="bottom"
      rule={{ class: "stroke-slate-400" }}
      tickLength={3}
      tickLabelProps={{
        style: axisXTickStyle,
      }}
    />
    <Highlight area />
  </Svg>
  <Tooltip.Root>
    {#snippet children({ data })}
      {#if data?.data}
        <Tooltip.Header>{data.year}</Tooltip.Header>
        <Tooltip.List>
          {#each data.data as entry}
            <Tooltip.Item
              label={raceLabel(entry.race)}
              value={formatChartValue(entry.value)}
              color={raceColor(entry.race)}
              valueAlign="right"
            />
          {/each}

          <Tooltip.Separator />

          <Tooltip.Item
            label="total"
            value={formatChartValue(
              data.data.reduce((acc, item) => acc + (item?.value ?? 0), 0)
            )}
            valueAlign="right"
          />
        </Tooltip.List>
      {/if}
    {/snippet}
  </Tooltip.Root>
</Chart>
