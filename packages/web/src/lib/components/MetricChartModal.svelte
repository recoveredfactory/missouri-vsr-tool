<script>
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Chart, Svg, Axis, Spline } from "layerchart";
  import { withDataBase } from "$lib/dataBase";
  import {
    modal_close,
    modal_no_data,
    modal_no_baselines,
    modal_statewide_baselines_heading,
    modal_statewide_baselines_subheading,
    modal_baseline_race_header,
    modal_baseline_mean_header,
    modal_baseline_median_header,
    modal_baseline_agency_fallback,
    race_white,
    race_black,
    race_hispanic,
    race_native_american,
    race_asian,
    race_other,
  } from "$lib/paraglide/messages";
  import * as m from "$lib/paraglide/messages";
  import { raceColors } from "$lib/colors.js";

  export let open = false;
  export let metricKey = "";
  export let metricLabel = "";
  export let baselines = [];
  export let agencyName = "";
  // Kept for backward compat — chart now fetches its own data
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

  const normalizeAgency = (name) =>
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

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

  $: allYears = Array.from(new Set(allRows.map((r) => Number(r.year))))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  $: minYear = allYears[0] ?? 2000;
  $: maxYear = allYears[allYears.length - 1] ?? 2024;
  $: normalizedAgencyName = normalizeAgency(agencyName);

  // Most recent stops row for the selected agency
  $: agencyStopsRow = (() => {
    const agencyRows = stopsRows.filter(
      (r) => normalizeAgency(String(r.agency || "")) === normalizedAgencyName
    );
    if (!agencyRows.length) return null;
    return agencyRows.reduce((best, r) =>
      Number(r.year) > Number(best.year) ? r : best
    );
  })();

  $: panelData = RACE_PANELS.map(({ race, label }) => {
    const byAgency = new Map();
    for (const row of allRows) {
      const agency = String(row.agency || "").trim();
      if (!agency) continue;
      if (!byAgency.has(agency)) byAgency.set(agency, new Map());
      const raw = row[race];
      const val = raw === null || raw === undefined ? null : Number(raw);
      if (val !== null && Number.isFinite(val)) byAgency.get(agency).set(Number(row.year), val);
    }

    const greySeries = [];
    let selectedSeries = null;
    const allPoints = [];

    for (const [agency, yearMap] of byAgency.entries()) {
      const data = allYears.map((y) => ({ year: y, value: yearMap.get(y) ?? null }));
      if (!data.some((p) => p.value !== null)) continue;

      const isSelected = normalizeAgency(agency) === normalizedAgencyName;
      const nonNull = data.filter((p) => p.value !== null);
      allPoints.push(...nonNull);

      if (isSelected) {
        selectedSeries = { agency, data };
      } else {
        greySeries.push({ agency, data });
      }
    }

    return {
      race,
      label,
      color: raceColors[race] || "#64748b",
      greySeries,
      selectedSeries,
      allPoints,
    };
  });

  // ── Baselines table ────────────────────────────────────────────────────────

  const baselineRaceOrder = ["Total", "White", "Black", "Hispanic", "Asian", "Other", "Native American"];

  $: baselineEntries = Array.isArray(baselines)
    ? baselines.filter((e) => e?.row_key === metricKey)
    : [];
  $: baselineYears = Array.from(new Set(baselineEntries.map((e) => e.year))).sort(
    (a, b) => Number(b) - Number(a)
  );
  $: baselineByYear = baselineEntries.reduce((acc, e) => {
    const y = e.year;
    if (y == null) return acc;
    (acc[y] = acc[y] || []).push(e);
    return acc;
  }, {});
  $: agencyRowsByYear = allRows.reduce((acc, row) => {
    if (normalizeAgency(String(row.agency || "")) !== normalizedAgencyName) return acc;
    const y = row.year;
    if (y != null) acc[y] = row;
    return acc;
  }, {});

  const sortBaselineMetrics = (a, b) => {
    const idx = (x) => baselineRaceOrder.indexOf(x.metric);
    const [ai, bi] = [idx(a), idx(b)];
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return String(a.metric).localeCompare(String(b.metric));
  };

  const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const pctFormatter = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });
  const isPct = (key) => key?.endsWith("-percentage");
  const formatNum = (v, pct = false) => {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return pct ? pctFormatter.format(n) : numberFormatter.format(n);
  };

  const raceLabel = (race) => {
    const key = `race_${String(race || "").toLowerCase().replace(/[\s-]+/g, "_")}`;
    return typeof m[key] === "function" ? m[key]() : race;
  };

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
      class="w-full max-w-full overflow-x-hidden overflow-y-auto rounded-none bg-white p-4 shadow-2xl focus:outline-none sm:max-w-4xl sm:rounded-2xl sm:p-6"
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
            <p class="text-[11px] uppercase tracking-[0.22em] text-slate-400">{agencyName}</p>
          {/if}
          <h2 id="modal-title" class="mt-2 text-xl font-semibold text-slate-900">
            {metricLabel || metricKey}
          </h2>
          {#if metricKey}
            <p class="mt-1 font-mono text-xs text-slate-400">{metricKey}</p>
          {/if}
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
          <div class="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {#each panelData as panel}
              <div>
                <p
                  class="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style="color:{panel.color}"
                >
                  {panel.label()}{#if agencyStopsRow?.[panel.race] != null && metricKey !== "stops"}&thinsp;<span class="font-normal normal-case tracking-normal text-slate-400">(stops: {numberFormatter.format(agencyStopsRow[panel.race])})</span>{/if}
                </p>
                <div class="h-[140px]">
                  <Chart
                    data={panel.allPoints}
                    x="year"
                    y="value"
                    yDomain={[0, null]}
                    yNice
                    padding={{ left: 40, right: 6, bottom: 22, top: 6 }}
                  >
                    <Svg>
                      <Axis
                        placement="left"
                        ticks={3}
                        grid={{ class: "stroke-slate-100" }}
                        rule={{ class: "stroke-slate-200" }}
                        tickLabelProps={{ style: "fill:#94a3b8;font-size:9px;font-family:inherit;" }}
                        format={(v) => numberFormatter.format(v)}
                      />
                      {#each panel.greySeries as gs}
                        <Spline data={gs.data} x="year" y="value" fill="none" stroke="#94a3b8" strokeWidth={0.8} defined={(d) => d.value !== null} />
                      {/each}
                      {#if panel.selectedSeries}
                        <Spline
                          data={panel.selectedSeries.data}
                          x="year"
                          y="value"
                          fill="none"
                          stroke={panel.color}
                          strokeWidth={2.5}
                          defined={(d) => d.value !== null}
                        />
                      {/if}
                      <Axis
                        placement="bottom"
                        ticks={5}
                        rule={{ class: "stroke-slate-200" }}
                        tickLabelProps={{ style: "fill:#94a3b8;font-size:9px;font-family:inherit;" }}
                        format={(v) => String(Math.round(v))}
                      />
                    </Svg>
                  </Chart>
                </div>
              </div>
            {/each}
          </div>
          {#if agencyName}
            <p class="mt-3 text-[10px] text-slate-400">
              All agencies shown in grey — <span style="color:{raceColors['Black'] || '#64748b'}" class="font-semibold">{agencyName}</span> highlighted.
            </p>
          {/if}
        {/if}
      </div>

      <!-- Statewide baselines -->
      <div class="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-baseline justify-between gap-4">
          <h3 class="text-sm font-semibold text-slate-900">{modal_statewide_baselines_heading()}</h3>
          <p class="text-xs text-slate-400">{modal_statewide_baselines_subheading()}</p>
        </div>
        {#if baselineYears.length === 0}
          <p class="mt-3 text-sm text-slate-500">{modal_no_baselines()}</p>
        {:else}
          <div class="mt-3 space-y-4">
            {#each baselineYears as year}
              {@const yearEntries = (baselineByYear[year] ?? []).slice().sort(sortBaselineMetrics)}
              {@const agencyRow = agencyRowsByYear[year]}
              <div class="rounded-lg border border-slate-200">
                <div class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  {year}
                </div>
                <div class="overflow-x-auto">
                  <table class="min-w-full table-auto border-separate border-spacing-0 text-xs text-slate-600">
                    <thead class="bg-white text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th class="px-3 py-2 text-left font-semibold">{modal_baseline_race_header()}</th>
                        <th class="px-3 py-2 text-left font-semibold">{agencyName || modal_baseline_agency_fallback()}</th>
                        <th class="px-3 py-2 text-left font-semibold">{modal_baseline_mean_header()}</th>
                        <th class="px-3 py-2 text-left font-semibold">{modal_baseline_median_header()}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      {#each yearEntries as entry}
                        <tr>
                          <td class="px-3 py-2 font-medium text-slate-700">{raceLabel(entry.metric)}</td>
                          <td class="px-3 py-2">{formatNum(agencyRow?.[entry.metric], isPct(metricKey))}</td>
                          <td class="px-3 py-2">{formatNum(entry.mean__no_mshp, isPct(metricKey))}</td>
                          <td class="px-3 py-2">{formatNum(entry.median__no_mshp, isPct(metricKey))}</td>
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
