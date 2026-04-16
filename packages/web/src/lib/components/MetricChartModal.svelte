<script>
  import { createEventDispatcher, onDestroy } from "svelte";
  import { withDataBase } from "$lib/dataBase";
  import {
    modal_close,
    modal_no_data,
    race_white,
    race_black,
    race_hispanic,
    race_native_american,
    race_asian,
    race_other,
  } from "$lib/paraglide/messages";
  import * as m from "$lib/paraglide/messages";
  import { raceColors } from "$lib/colors.js";
  import SpaghettiChart from "$lib/components/SpaghettiChart.svelte";
  import StatewideComparisonChart from "$lib/components/StatewideComparisonChart.svelte";

  $: isRateMetric = metricKey.includes("-rate") || metricKey.includes("-percentage");

  // Rate metrics are 0–100. Values outside that range indicate upstream data
  // issues (e.g. denominator races/year mismatches) — drop them so one garbage
  // point doesn't warp the y-axis or draw a flying line across the chart.
  const sanitizeRateValue = (v, isRate) => {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (isRate && (n < 0 || n > 100)) return null;
    return n;
  };

  let minStopsThreshold = 100;
  let maxStopsThreshold = null; // null = All
  let lastInitializedAgency = "";
  let showMSHP = false;
  let useSqrtScale = true;    // default sqrt; user can toggle

  export let open = false;
  export let metricKey = "";
  export let metricLabel = "";
  export let baselines = [];
  export let agencyName = "";
  // Kept for backward compat — chart fetches its own data
  export let rows = [];
  export let raceKeys = [];

  const dispatch = createEventDispatcher();
  /** @type {HTMLDivElement | undefined} */
  let dialogEl;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const metricCache = new Map();
  let allRows = [];
  let isLoading = false;
  let loadError = "";

  // Snap an agency's max total stops up to the nearest filter bucket.
  const niceMaxStopsBucket = (v) => {
    if (!Number.isFinite(v) || v <= 1000) return null;
    if (v <= 10000) return 10000;
    if (v <= 25000) return 25000;
    if (v <= 50000) return 50000;
    return null;
  };

  const normalizeAgency = (name) =>
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  // MSHP dominates count scales — excluded from grey series by default.
  const MSHP_NORMALIZED = "missouri state highway patrol";

  const fetchMetricRows = (key) => {
    if (!key) return Promise.resolve([]);
    const cached = metricCache.get(key);
    if (cached) return cached;
    const promise = fetch(withDataBase(`/data/dist/metric_year/${key}.json`))
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        return Array.isArray(d?.rows) ? d.rows : [];
      })
      .catch((err) => {
        metricCache.delete(key);
        throw err;
      });
    metricCache.set(key, promise);
    return promise;
  };

  let stopsRows = [];

  $: if (open && metricKey) {
    const key = metricKey;
    if (!metricCache.has(key)) {
      isLoading = true;
      loadError = "";
      allRows = [];
    }
    Promise.all([
      fetchMetricRows(key),
      fetchMetricRows("stops"),
    ])
      .then(([metric, stops]) => {
        if (metricKey === key) {
          allRows = metric;
          stopsRows = stops;
          isLoading = false;
        }
      })
      .catch((err) => {
        if (metricKey === key) { loadError = err.message; isLoading = false; allRows = []; }
      });
  }

  // ── Chart panel data ───────────────────────────────────────────────────────

  const RACE_PANELS = [
    { race: "White",           label: race_white },
    { race: "Black",           label: race_black },
    { race: "Hispanic",        label: race_hispanic },
    { race: "Native American", label: race_native_american },
    { race: "Asian",           label: race_asian },
    { race: "Other",           label: race_other },
  ];

  const TOTAL_COLOR = "#1e293b";

  $: allYears = Array.from(new Set(allRows.map((r) => Number(r.year))))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  $: normalizedAgencyName = normalizeAgency(agencyName);

  // Most recent stops row for the selected agency (used for panel skip + header label)
  $: agencyStopsRow = (() => {
    const agencyRows = stopsRows.filter(
      (r) => normalizeAgency(String(r.agency || "")) === normalizedAgencyName
    );
    if (!agencyRows.length) return null;
    return agencyRows.reduce((best, r) =>
      Number(r.year) > Number(best.year) ? r : best
    );
  })();

  // Max total stops per agency across all years — shared by sharedRateYMax + buildPanel.
  $: agencyMaxTotalStops = (() => {
    const map = new Map();
    for (const row of stopsRows) {
      const ag = normalizeAgency(String(row.agency || "").trim());
      if (!ag) continue;
      const v = Number(row["Total"] ?? NaN);
      if (Number.isFinite(v)) map.set(ag, Math.max(map.get(ag) ?? 0, v));
    }
    return map;
  })();

  // Shared y-axis max for rate metrics — scaled to the range of the selected
  // agency and statewide baselines across all races, so every rate panel uses
  // the same scale and inter-race comparisons are honest.
  $: sharedRateYMax = (() => {
    if (!isRateMetric) return null;

    const cols = ["Total", "White", "Black", "Hispanic", "Native American", "Asian", "Other"];
    let globalMax = 0;

    for (const row of allRows) {
      const ag = normalizeAgency(String(row.agency || "").trim());
      if (ag !== normalizedAgencyName) continue;
      for (const col of cols) {
        const v = sanitizeRateValue(row[col], isRateMetric);
        if (v !== null && v > globalMax) globalMax = v;
      }
    }

    for (const r of baselines) {
      if (r.row_key !== metricKey) continue;
      const v = sanitizeRateValue(r.mean__no_mshp, isRateMetric);
      if (v !== null && v > globalMax) globalMax = v;
    }

    return globalMax > 0 ? Math.min(globalMax * 1.1, 100) : null;
  })();

  // Build filtered series for one column (race or "Total").
  const buildPanel = (col, stopsCol, allRows, stopsRows, allYears, ctx) => {
    const {
      normalizedAgencyName, isRateMetric, minStopsThreshold, maxStopsThreshold,
      showMSHP, sharedRateYMax, agencyStopsRow, agencyMaxTotalStops,
    } = ctx;

    const byAgency = new Map();
    for (const row of allRows) {
      const agency = String(row.agency || "").trim();
      if (!agency) continue;
      if (!byAgency.has(agency)) byAgency.set(agency, new Map());
      const val = sanitizeRateValue(row[col], isRateMetric);
      if (val !== null) byAgency.get(agency).set(Number(row.year), val);
    }

    // Max stops for the relevant column — used to filter noisy grey series.
    const agencyMaxStops = new Map();
    for (const row of stopsRows) {
      const ag = normalizeAgency(String(row.agency || "").trim());
      if (!ag) continue;
      const v = Number(row[stopsCol] ?? NaN);
      if (Number.isFinite(v)) agencyMaxStops.set(ag, Math.max(agencyMaxStops.get(ag) ?? 0, v));
    }

    const greySeries = [];
    let selectedSeries = null;

    for (const [agency, yearMap] of byAgency.entries()) {
      const data = allYears.map((y) => ({ year: y, value: yearMap.get(y) ?? null }));
      if (!data.some((p) => p.value !== null)) continue;

      const normAgency = normalizeAgency(agency);
      if (normAgency === normalizedAgencyName) {
        selectedSeries = { agency, data };
      } else {
        const isMSHP = normAgency === MSHP_NORMALIZED;
        const totalStops = agencyMaxTotalStops.get(normAgency) ?? 0;
        const passesMin = totalStops >= minStopsThreshold;
        const passesMax = maxStopsThreshold == null || totalStops <= maxStopsThreshold;
        if (passesMin && passesMax && (showMSHP || !isMSHP)) {
          greySeries.push({ agency, data });
        }
      }
    }

    const colStops = agencyStopsRow?.[stopsCol];
    // Min-stops filter applies only to grey background series (above) — the
    // selected agency is always drawn so its values show even at low volumes.
    const skipPanel = false;

    // Rate metrics: shared yMax (same across all panels for comparability).
    // Count metrics: null → SpaghettiChart auto-ranges from visible series only.
    const yMax = isRateMetric ? sharedRateYMax : null;

    return { greySeries, selectedSeries, yMax, skipPanel, colStops };
  };

  // When opening the modal for an agency with very few recent stops, default
  // the min-stops filter to 0 so its line isn't filtered out of count panels.
  $: if (open && agencyStopsRow && agencyName && agencyName !== lastInitializedAgency) {
    lastInitializedAgency = agencyName;
    const total = Number(agencyStopsRow["Total"] ?? NaN);
    minStopsThreshold = Number.isFinite(total) && total < 100 ? 0 : 100;
    const agencyMax = agencyMaxTotalStops.get(normalizedAgencyName) ?? 0;
    maxStopsThreshold = niceMaxStopsBucket(agencyMax);
  }
  $: if (!open) lastInitializedAgency = "";

  $: panelCtx = {
    normalizedAgencyName, isRateMetric, minStopsThreshold, maxStopsThreshold,
    showMSHP, sharedRateYMax, agencyStopsRow, agencyMaxTotalStops,
  };

  // ── Statewide series (rate metrics) ───────────────────────────────────────

  // baselines schema: { row_key, year, metric (race/category), count (# agencies),
  //   mean, median, mean__no_mshp, median__no_mshp }
  // col maps to the `metric` field ("Total", "White", "Black", etc.)
  const buildStatewideSeries = (col, baselines, key) => {
    const isRate = key.includes("-rate") || key.includes("-percentage");
    return {
      data: baselines
        .filter((r) => r.row_key === key && r.metric === col)
        .map((r) => ({ year: Number(r.year), value: sanitizeRateValue(r.mean__no_mshp, isRate) }))
        .filter((p) => Number.isFinite(p.year))
        .sort((a, b) => a.year - b.year),
    };
  };

  $: totalStatewideSeries = buildStatewideSeries("Total", baselines, metricKey);

  $: panelData = RACE_PANELS.map(({ race, label }) => ({
    race,
    label,
    color: raceColors[race] || "#64748b",
    statewideSeries: buildStatewideSeries(race, baselines, metricKey),
    ...buildPanel(race, race, allRows, stopsRows, allYears, panelCtx),
  }));

  $: totalPanelData = allRows.length
    ? { color: TOTAL_COLOR, ...buildPanel("Total", "Total", allRows, stopsRows, allYears, panelCtx) }
    : null;

  const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

  // ── Modal controls ─────────────────────────────────────────────────────────

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) dispatch("close"); };
  const handleGlobalKeydown = (e) => { if (open && e.key === "Escape") dispatch("close"); };

  $: if (open) {
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    if (typeof window !== "undefined") window.addEventListener("keydown", handleGlobalKeydown);
    if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => dialogEl?.focus());
  } else {
    if (typeof document !== "undefined") document.body.style.overflow = "";
    if (typeof window !== "undefined") window.removeEventListener("keydown", handleGlobalKeydown);
  }

  onDestroy(() => {
    if (typeof document !== "undefined") document.body.style.overflow = "";
    if (typeof window !== "undefined") window.removeEventListener("keydown", handleGlobalKeydown);
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/60 sm:items-center sm:px-4 sm:py-8"
    style="top: var(--site-header-height, 0px); height: calc(100dvh - var(--site-header-height, 0px));"
    on:click={handleBackdrop}
    role="presentation"
  >
    <div
      bind:this={dialogEl}
      class="w-full max-w-full overflow-x-hidden overflow-y-auto rounded-none bg-white p-4 shadow-2xl focus:outline-none sm:max-w-[90rem] sm:rounded-2xl sm:p-6"
      style="max-height: calc(100dvh - var(--site-header-height, 0px) - 2rem);"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      on:keydown={(e) => { if (e.key === "Escape") dispatch("close"); }}
    >

      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          {#if agencyName}
            <p class="text-base font-semibold text-slate-700">{agencyName}</p>
          {/if}
          <h2 id="modal-title" class="mt-1 text-xl font-semibold text-slate-900">
            {metricLabel || metricKey}
          </h2>
        </div>
        <button
          class="shrink-0 rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          type="button"
          on:click={() => dispatch("close")}
        >
          {modal_close()}
        </button>
      </div>

      <!-- Spaghetti charts -->
      <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {#if isLoading}
          <div class="flex h-24 items-center justify-center text-sm text-slate-400">Loading…</div>
        {:else if loadError}
          <p class="text-sm text-rose-600">Could not load data ({loadError})</p>
        {:else if allRows.length === 0}
          <p class="text-sm text-slate-500">{modal_no_data()}</p>
        {:else}
          <!-- Filter / scale controls (count metrics only) -->
          {#if !isRateMetric}
            <div class="mb-4 flex flex-wrap items-center justify-end gap-3">
              <!-- MSHP toggle -->
              <button
                type="button"
                class="rounded border px-2.5 py-1 text-[11px] font-semibold transition {showMSHP ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}"
                on:click={() => showMSHP = !showMSHP}
              >
                {showMSHP ? m.chart_mshp_hide() : m.chart_mshp_show()}
              </button>
              <!-- Min stops -->
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{m.chart_min_stops_label()}</span>
                <div class="flex overflow-hidden rounded border border-slate-300 text-[11px] font-semibold">
                  {#each [0, 100, 500, 1000, 5000] as preset, i}
                    <button
                      type="button"
                      class="px-2.5 py-1 transition {minStopsThreshold === preset ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'} {i > 0 ? 'border-l border-slate-300' : ''}"
                      on:click={() => minStopsThreshold = preset}
                    >{preset >= 1000 ? `${preset / 1000}K` : preset}</button>
                  {/each}
                </div>
              </div>
              <!-- Max total stops -->
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{m.chart_max_stops_label()}</span>
                <div class="flex overflow-hidden rounded border border-slate-300 text-[11px] font-semibold">
                  {#each [[null, null], [10000, '10K'], [25000, '25K'], [50000, '50K']] as [val, lbl], i}
                    <button
                      type="button"
                      class="px-2.5 py-1 transition {maxStopsThreshold === val ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'} {i > 0 ? 'border-l border-slate-300' : ''}"
                      on:click={() => maxStopsThreshold = val}
                    >{lbl ?? m.chart_max_stops_all()}</button>
                  {/each}
                </div>
              </div>
              <!-- Scale toggle -->
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{m.chart_scale_label()}</span>
                <div class="flex overflow-hidden rounded border border-slate-300 text-[11px] font-semibold">
                  <button
                    type="button"
                    class="px-2.5 py-1 transition {!useSqrtScale ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}"
                    on:click={() => useSqrtScale = false}
                  >{m.chart_scale_linear()}</button>
                  <button
                    type="button"
                    class="border-l border-slate-300 px-2.5 py-1 transition {useSqrtScale ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}"
                    on:click={() => useSqrtScale = true}
                  >{m.chart_scale_sqrt()}</button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Total panel — own row, centered ~2/3 width -->
          {#if totalPanelData}
            <div class="mb-6 flex justify-center">
              <div class="w-full lg:w-2/3">
                <p class="mb-2 text-base font-semibold" style="color:{TOTAL_COLOR}">
                  Total{metricLabel ? ' ' + metricLabel : ''}{#if totalPanelData.colStops != null && metricKey !== "stops"}&thinsp;<span class="font-normal normal-case tracking-normal text-slate-400">({agencyStopsRow?.year} total stops: {numberFormatter.format(totalPanelData.colStops)})</span>{/if}
                </p>
                {#if totalPanelData.skipPanel && !isRateMetric}
                  <div class="flex h-[280px] items-center justify-center rounded-lg border border-slate-200 bg-white text-center text-[11px] text-slate-400">
                    {m.chart_panel_skipped({ n: minStopsThreshold })}
                  </div>
                {:else}
                  <div class="h-[280px]">
                    {#if isRateMetric}
                      <StatewideComparisonChart
                        statewideSeries={totalStatewideSeries}
                        selectedSeries={totalPanelData.selectedSeries}
                        {allYears}
                        yMax={totalPanelData.yMax}
                        color={TOTAL_COLOR}
                        {agencyName}
                        height={280}
                      />
                    {:else}
                      <SpaghettiChart
                        greySeries={totalPanelData.greySeries}
                        selectedSeries={totalPanelData.selectedSeries}
                        {allYears}
                        yMax={totalPanelData.yMax}
                        useSqrt={useSqrtScale && !isRateMetric}
                        {isRateMetric}
                        color={TOTAL_COLOR}
                        {agencyName}
                        height={280}
                      />
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Race panels — 3-column grid -->
          <div class="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {#each panelData as panel}
              <div>
                <p class="mb-2 text-base font-semibold" style="color:{panel.color}">
                  {panel.label()}{metricLabel ? ' ' + metricLabel : ''}{#if panel.colStops != null && metricKey !== "stops"}&thinsp;<span class="font-normal normal-case tracking-normal text-slate-400">({agencyStopsRow?.year} total stops: {numberFormatter.format(panel.colStops)})</span>{/if}
                </p>
                {#if panel.skipPanel && !isRateMetric}
                  <div class="flex h-[280px] items-center justify-center rounded-lg border border-slate-200 bg-white text-center text-[11px] text-slate-400">
                    {m.chart_panel_skipped({ n: minStopsThreshold })}
                  </div>
                {:else}
                  <div class="h-[280px]">
                    {#if isRateMetric}
                      <StatewideComparisonChart
                        statewideSeries={panel.statewideSeries}
                        selectedSeries={panel.selectedSeries}
                        {allYears}
                        yMax={panel.yMax}
                        color={panel.color}
                        {agencyName}
                        height={280}
                      />
                    {:else}
                      <SpaghettiChart
                        greySeries={panel.greySeries}
                        selectedSeries={panel.selectedSeries}
                        {allYears}
                        yMax={panel.yMax}
                        useSqrt={useSqrtScale && !isRateMetric}
                        {isRateMetric}
                        color={panel.color}
                        {agencyName}
                        height={280}
                      />
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          {#if agencyName}
            {#if isRateMetric}
              <p class="mt-3 text-[10px] text-slate-400">
                <span style="color:{TOTAL_COLOR}" class="font-semibold">{agencyName}</span>
                {" — "}
                <span>{m.chart_statewide_label()}</span>
              </p>
            {:else}
              <p class="mt-3 text-[10px] text-slate-400">
                {m.chart_count_legend({ agencyName })}
              </p>
            {/if}
          {/if}
        {/if}
      </div>

    </div>
  </div>
{/if}
