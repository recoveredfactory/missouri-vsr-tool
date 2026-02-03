<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import {
    agency_section_label,
    agency_table_label,
    modal_baseline_agency_fallback,
    modal_baseline_mean_header,
    modal_baseline_median_header,
    modal_baseline_race_header,
    modal_chart_unavailable,
    modal_close,
    modal_metric_label,
    modal_no_baselines,
    modal_no_data,
    modal_statewide_baselines_heading,
    modal_statewide_baselines_subheading,
    race_asian,
    race_black,
    race_hispanic,
    race_native_american,
    race_other,
    race_total,
    race_white,
  } from "$lib/paraglide/messages";
  import * as m from "$lib/paraglide/messages";

  export let open = false;
  export let metricKey = "";
  export let metricLabel = "";
  export let rows = [];
  export let raceKeys = [];
  export let baselines = [];
  export let agencyName = "";

  const dispatch = createEventDispatcher();
  let backdropEl;
  let ChartComponent;
  let LineComponent;
  let chartLoadError = null;

  const chartTypeForMetric = (key, sample) => {
    if (!key) return "bar";
    if (sample && typeof sample === "object" && !Array.isArray(sample)) return "bar";
    return "bar";
  };

  const toNumber = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const toTotal = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number" || typeof value === "string") return toNumber(value);
    if (typeof value !== "object" || Array.isArray(value)) return 0;

    const direct = value.Total ?? value.total;
    if (direct !== null && direct !== undefined && direct !== "") {
      return toNumber(direct);
    }

    return resolvedRaceKeys.reduce((acc, key) => {
      const lower = key.toLowerCase();
      return acc + toNumber(value[key] ?? value[lower] ?? 0);
    }, 0);
  };

  $: resolvedRaceKeys = raceKeys.length
    ? raceKeys
    : ["White", "Black", "Hispanic", "Native American", "Asian", "Other"];
  $: isPercentageMetric = metricKey.endsWith("-percentage");
  $: metricRows = (rows || []).filter((row) => row?.row_key === metricKey);
  $: metricRowsSorted = metricRows.slice().sort((a, b) => Number(a?.year) - Number(b?.year));
  $: sampleValue = metricRows[0];
  $: chartType = chartTypeForMetric(metricKey, sampleValue);
  $: tableId = metricRows[0]?.table_id ?? "";
  $: sectionId = metricRows[0]?.section_id ?? "";
  $: metricId = metricRows[0]?.metric_id ?? "";
  $: isRateMetric = sectionId === "rates" || metricId.includes("rate");

  const numberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  });
  const percentFormatter = new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  });

  const formatNumber = (value, { isPercentage = false } = {}) => {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
    return isPercentage ? percentFormatter.format(value) : numberFormatter.format(value);
  };

  const baselineRaceOrder = [
    "Total",
    "White",
    "Black",
    "Hispanic",
    "Asian",
    "Other",
    "Native American",
  ];

  const raceLabel = (key) => {
    switch (key) {
      case "Total":
        return race_total();
      case "White":
        return race_white();
      case "Black":
        return race_black();
      case "Hispanic":
        return race_hispanic();
      case "Asian":
        return race_asian();
      case "Other":
        return race_other();
      case "Native American":
        return race_native_american();
      default:
        return key;
    }
  };

  const labelForId = (kind, id) => {
    if (!id) return "";
    const key = `${kind}_${id}`;
    const fn = m[key];
    return typeof fn === "function" ? fn() : "";
  };

  $: tableLabel = labelForId("table", tableId) || tableId;
  $: sectionLabel = labelForId("section", sectionId) || sectionId;

  const stackRaceKeys = (keys) =>
    keys.filter((key) => key && key.toLowerCase() !== "total");

  const getRaceValue = (row, race) => {
    if (!row || !race) return 0;
    const lower = race.toLowerCase();
    return toNumber(row[race] ?? row[lower] ?? 0);
  };

  const raceColors = {
    White: "#5fad56",
    Black: "#f2c14e",
    Hispanic: "#f78154",
    "Native American": "#4d9078",
    Asian: "#b4436c",
    Other: "#4d9078",
  };

  const raceColor = (race) => raceColors[race] || "#4d9078";

  $: stackedRaceKeys = stackRaceKeys(resolvedRaceKeys);

  const formatChartValue = (value) => {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
    if (isPercentageMetric) {
      return `${numberFormatter.format(value * 100)}%`;
    }
    return numberFormatter.format(value);
  };

  const buildStackedData = (rows) => {
    if (!rows.length || !stackedRaceKeys.length) return [];
    const result = [];
    rows.forEach((row) => {
      const year = row?.year;
      if (!year) return;
      const data = stackedRaceKeys.map((race) => ({
        year: String(year),
        race,
        value: toNumber(getRaceValue(row, race)),
      }));
      let offset = 0;
      data.forEach((entry) => {
        const value = Number.isFinite(entry.value) ? entry.value : 0;
        const start = offset;
        const end = offset + value;
        result.push({
          year: entry.year,
          race: entry.race,
          value,
          values: [start, end],
          data,
        });
        offset = end;
      });
    });
    return result;
  };

  $: stackedData = buildStackedData(metricRowsSorted);
  $: lineSeries = stackedRaceKeys.map((race) => ({
    race,
    data: metricRowsSorted
      .filter((row) => row?.year !== null && row?.year !== undefined)
      .map((row) => ({
        year: String(row?.year),
        race,
        value: toNumber(getRaceValue(row, race)),
      })),
  }));
  $: lineData = lineSeries.flatMap((series) => series.data);
  $: lineValuesByYear = lineSeries.reduce((acc, series) => {
    series.data.forEach((entry) => {
      if (!entry.year) return;
      if (!acc[entry.year]) acc[entry.year] = {};
      acc[entry.year][series.race] = entry.value;
    });
    return acc;
  }, {});

  $: baselineEntries = Array.isArray(baselines)
    ? baselines.filter((entry) => entry?.row_key === metricKey)
    : [];

  $: baselineYears = Array.from(new Set(baselineEntries.map((entry) => entry.year))).sort(
    (a, b) => Number(b) - Number(a)
  );

  $: baselineByYear = baselineEntries.reduce((acc, entry) => {
    const year = entry.year;
    if (year === null || year === undefined) return acc;
    if (!acc[year]) acc[year] = [];
    acc[year].push(entry);
    return acc;
  }, {});

  $: agencyTotalsByYear = metricRows.reduce((acc, row) => {
    const year = row?.year;
    if (!year) return acc;
    if (!acc[year]) acc[year] = {};
    const metric = row;
    if (metric === null || metric === undefined) return acc;
    if (typeof metric === "number" || typeof metric === "string") {
      acc[year].Total = (acc[year].Total ?? 0) + toNumber(metric);
      return acc;
    }
    if (typeof metric !== "object" || Array.isArray(metric)) return acc;
    baselineRaceOrder.forEach((race) => {
      const lower = race.toLowerCase();
      const value = metric[race] ?? metric[lower];
      if (value === null || value === undefined) return;
      acc[year][race] = (acc[year][race] ?? 0) + toNumber(value);
    });
    return acc;
  }, {});

  const sortBaselineMetrics = (a, b) => {
    const orderA = baselineRaceOrder.indexOf(a.metric);
    const orderB = baselineRaceOrder.indexOf(b.metric);
    if (orderA !== -1 || orderB !== -1) {
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    }
    return String(a.metric).localeCompare(String(b.metric));
  };

  const handleBackdrop = (event) => {
    if (event.target === event.currentTarget) {
      dispatch("close");
    }
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      dispatch("close");
    }
  };

  $: if (open) {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => backdropEl?.focus());
    }
  } else {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  }

  onDestroy(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  });

  onMount(async () => {
    try {
      const [stackedModule, lineModule] = await Promise.all([
        import("$lib/components/MetricChartStacked.svelte"),
        import("$lib/components/MetricChartLines.svelte"),
      ]);
      ChartComponent = stackedModule.default;
      LineComponent = lineModule.default;
    } catch (error) {
      chartLoadError = error;
    }
  });
</script>

{#if open}
  <div
    bind:this={backdropEl}
    class="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-center bg-slate-950/60 sm:items-center sm:px-4 sm:py-8"
    style="top: var(--site-header-height); height: calc(100svh - var(--site-header-height));"
    on:click={handleBackdrop}
    on:keydown={handleKeydown}
    role="presentation"
    tabindex="0"
  >
    <div
      class="w-full max-w-full rounded-none bg-white p-4 shadow-2xl sm:max-w-4xl sm:rounded-2xl sm:p-6 max-h-[calc(100svh-var(--site-header-height))] overflow-y-auto overflow-x-hidden sm:max-h-[90vh]"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          {#if agencyName}
            <p class="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              {agencyName}
            </p>
          {/if}
          {#if !agencyName}
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">
              {modal_metric_label()}
            </p>
          {/if}
          <h2 class="mt-2 text-xl font-semibold text-slate-900">
            {metricLabel || metricKey}
          </h2>
          {#if metricKey}
            <p class="mt-2 text-xs font-mono text-slate-500">
              {metricKey}
            </p>
          {/if}
          {#if tableLabel || sectionLabel}
            <p class="mt-2 text-xs text-slate-500">
              {#if tableLabel}
                <span class="font-semibold text-slate-700">{agency_table_label()}:</span>
                {tableLabel}
              {/if}
              {#if tableLabel && sectionLabel}
                <span class="mx-2 text-slate-300">•</span>
              {/if}
              {#if sectionLabel}
                <span class="font-semibold text-slate-700">{agency_section_label()}:</span>
                {sectionLabel}
              {/if}
            </p>
          {/if}
        </div>
        <button
          class="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          type="button"
          on:click={() => dispatch("close")}
        >
          {modal_close()}
        </button>
      </div>

      <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {#if chartType === "bar"}
          {#if stackedData.length === 0}
            <p class="text-sm text-slate-500">{modal_no_data()}</p>
          {:else if chartLoadError}
            <p class="text-sm text-slate-500">{modal_chart_unavailable()}</p>
          {:else}
            <div class="space-y-3">
              <div class="h-[280px]">
                {#if isRateMetric}
                  {#if LineComponent}
                    <svelte:component
                      this={LineComponent}
                      lineSeries={lineSeries}
                      lineData={lineData}
                      lineValuesByYear={lineValuesByYear}
                      raceKeys={stackedRaceKeys}
                      raceLabel={raceLabel}
                      raceColor={raceColor}
                      formatChartValue={formatChartValue}
                    />
                  {:else}
                    <div
                      class="flex h-full items-center justify-center text-sm text-slate-500"
                      aria-busy="true"
                    >
                      Loading chart…
                    </div>
                  {/if}
                {:else if ChartComponent}
                  <svelte:component
                    this={ChartComponent}
                    stackedData={stackedData}
                    stackedRaceKeys={stackedRaceKeys}
                    raceLabel={raceLabel}
                    raceColor={raceColor}
                    formatChartValue={formatChartValue}
                  />
                {:else}
                  <div
                    class="flex h-full items-center justify-center text-sm text-slate-500"
                    aria-busy="true"
                  >
                    Loading chart…
                  </div>
                {/if}
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                {#each stackedRaceKeys as race}
                  <span class="flex items-center gap-2">
                    <span
                      class="h-2.5 w-2.5 rounded-full"
                      style={`background:${raceColor(race)}`}
                    ></span>
                    {raceLabel(race)}
                  </span>
                {/each}
              </div>
            </div>
          {/if}
        {:else}
          <p class="text-sm text-slate-500">{modal_chart_unavailable()}</p>
        {/if}
      </div>

      <div class="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-baseline justify-between gap-4">
          <h3 class="text-sm font-semibold text-slate-900">
            {modal_statewide_baselines_heading()}
          </h3>
          <p class="text-xs text-slate-400">{modal_statewide_baselines_subheading()}</p>
        </div>
        {#if baselineYears.length === 0}
          <p class="mt-3 text-sm text-slate-500">{modal_no_baselines()}</p>
        {:else}
          <div class="mt-3 space-y-4">
            {#each baselineYears as year}
              {@const yearEntries = (baselineByYear[year] ?? []).slice().sort(sortBaselineMetrics)}
              <div class="rounded-lg border border-slate-200">
                <div class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  {year}
                </div>
                <div class="overflow-x-auto">
                  <table class="min-w-full table-auto border-separate border-spacing-0 text-xs text-slate-600">
                    <thead class="bg-white text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th class="px-3 py-2 text-left font-semibold">
                          {modal_baseline_race_header()}
                        </th>
                        <th class="px-3 py-2 text-left font-semibold">
                          {agencyName || modal_baseline_agency_fallback()}
                        </th>
                        <th class="px-3 py-2 text-left font-semibold">
                          {modal_baseline_mean_header()}
                        </th>
                        <th class="px-3 py-2 text-left font-semibold">
                          {modal_baseline_median_header()}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      {#each yearEntries as entry}
                        <tr>
                          <td class="px-3 py-2 font-medium text-slate-700">
                            {raceLabel(entry.metric)}
                          </td>
                          <td class="px-3 py-2">
                            {formatNumber(agencyTotalsByYear[year]?.[entry.metric], {
                              isPercentage: isPercentageMetric,
                            })}
                          </td>
                          <td class="px-3 py-2">
                            {formatNumber(entry.mean__no_mshp, {
                              isPercentage: isPercentageMetric,
                            })}
                          </td>
                          <td class="px-3 py-2">
                            {formatNumber(entry.median__no_mshp, {
                              isPercentage: isPercentageMetric,
                            })}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
