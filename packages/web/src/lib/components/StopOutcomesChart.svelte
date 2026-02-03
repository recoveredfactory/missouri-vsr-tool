<script>
  import { browser } from "$app/environment";
  import { scaleBand } from "d3-scale";

  export let dataByYear = {};
  export let years = [];

  const outcomeColors = {
    citations: "#5fad56",
    arrests: "#f2c14e",
    searches: "#f78154",
    noAction: "#4d9078"
  };

  const outcomeLabels = {
    citations: "Citations",
    arrests: "Arrests",
    searches: "Searches",
    noAction: "No Action"
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return "—";
    if (value >= 1000) {
      const k = value / 1000;
      return k % 1 === 0 ? `${k.toFixed(0)}K` : `${k.toFixed(1)}K`;
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  };

  const outcomeKeys = ["citations", "arrests", "searches", "noAction"];

  // Transform data for slope chart - compute noAction as stops - (citations + arrests + searches)
  $: lineSeries = outcomeKeys.map(outcome => ({
    outcome,
    label: outcomeLabels[outcome],
    color: outcomeColors[outcome],
    data: years.map(year => {
      const yearData = dataByYear[year] || {};
      let value;
      if (outcome === "noAction") {
        const stops = Number(yearData.stops) || 0;
        const citations = Number(yearData.citations) || 0;
        const arrests = Number(yearData.arrests) || 0;
        const searches = Number(yearData.searches) || 0;
        value = Math.max(0, stops - citations - arrests - searches);
      } else {
        value = Number(yearData[outcome]) || 0;
      }
      return { year, value, outcome };
    })
  }));

  $: allPoints = lineSeries.flatMap(s => s.data);

  $: valuesByYear = years.reduce((acc, year) => {
    acc[year] = {};
    const yearData = dataByYear[year] || {};
    outcomeKeys.forEach(outcome => {
      if (outcome === "noAction") {
        const stops = Number(yearData.stops) || 0;
        const citations = Number(yearData.citations) || 0;
        const arrests = Number(yearData.arrests) || 0;
        const searches = Number(yearData.searches) || 0;
        acc[year][outcome] = Math.max(0, stops - citations - arrests - searches);
      } else {
        acc[year][outcome] = Number(yearData[outcome]) || 0;
      }
    });
    return acc;
  }, {});

  // Dynamically import layerchart only on client
  let Chart, Svg, Axis, Spline, Points, Tooltip, Highlight;
  $: if (browser) {
    import("layerchart").then((module) => {
      Chart = module.Chart;
      Svg = module.Svg;
      Axis = module.Axis;
      Spline = module.Spline;
      Points = module.Points;
      Tooltip = module.Tooltip;
      Highlight = module.Highlight;
    });
  }
</script>

{#if browser && Chart && allPoints.length > 0}
  <div class="h-[200px] sm:h-[220px]">
    <Chart
      data={allPoints}
      x="year"
      y="value"
      xScale={scaleBand().paddingInner(0.4).paddingOuter(0.2)}
      yDomain={[0, null]}
      yNice
      padding={{ left: 45, right: 8, bottom: 24, top: 8 }}
      tooltip={{ mode: "quadtree-x" }}
    >
      <Svg>
        <Axis
          placement="left"
          grid={{ class: "stroke-slate-200/70" }}
          rule={{ class: "stroke-slate-400" }}
          tickLength={3}
          ticks={4}
          format={formatNumber}
          tickLabelProps={{
            style: "fill: #0f172a; font-size: 9px; font-weight: 600;",
          }}
        />
        {#each lineSeries as series}
          <Spline
            data={series.data}
            x="year"
            y="value"
            class="stroke-[2.5]"
            stroke={series.color}
          />
          <Points
            data={series.data}
            x="year"
            y="value"
            r={4}
            fill={series.color}
          />
        {/each}
        <Highlight lines />
        <Axis
          placement="bottom"
          rule={{ class: "stroke-slate-400" }}
          tickLength={3}
          tickLabelProps={{
            style: "fill: #64748b; font-size: 9px; font-weight: 500;",
          }}
        />
      </Svg>
      <Tooltip.Root>
        {#snippet children({ data })}
          {#if data}
            <Tooltip.Header>{data.year}</Tooltip.Header>
            <Tooltip.List>
              {#each outcomeKeys as outcome}
                <Tooltip.Item
                  label={outcomeLabels[outcome]}
                  value={formatNumber(valuesByYear[data.year]?.[outcome])}
                  color={outcomeColors[outcome]}
                  valueAlign="right"
                />
              {/each}
            </Tooltip.List>
          {/if}
        {/snippet}
      </Tooltip.Root>
    </Chart>
  </div>
{:else}
  <div class="h-[200px] sm:h-[220px] flex items-center justify-center">
    <span class="text-sm text-slate-400">Loading chart...</span>
  </div>
{/if}

<div class="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600">
  {#each outcomeKeys as outcome}
    <span class="flex items-center gap-1">
      <span class="inline-block h-2.5 w-2.5 rounded-full" style="background-color: {outcomeColors[outcome]};"></span>
      <span class="text-[11px]">{outcomeLabels[outcome]}</span>
    </span>
  {/each}
</div>
