<script>
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import ChoroplethMap from "$lib/components/ChoroplethMap.svelte";
  import { withDataBase } from "$lib/dataBase";
  import { getLocale } from "$lib/paraglide/runtime";
  import { goto } from "$app/navigation";
  import {
    map_page_title,
    map_panel_metric_label,
    map_panel_race_label,
    map_panel_year_label,
    map_panel_min_stops_label,
    map_panel_agency_type_label,
    map_panel_agency_type_placeholder,
    map_panel_controls_open,
    map_panel_controls_close,
    map_panel_loading,
    map_panel_error,
    map_panel_no_data,
    map_race_total,
    map_race_nonwhite_white_ratio,
    map_race_note_ratio_rates,
    map_legend_low,
    map_legend_high,
    map_hover_stops,
    map_hover_no_data,
  } from "$lib/paraglide/messages";

  export let data;

  // ─── Metric options ──────────────────────────────────────────────────────────

  const titleToken = (token) => {
    const lower = token.toLowerCase();
    if (lower === "acs") return "ACS";
    if (lower === "bac") return "BAC";
    if (lower === "dwi") return "DWI";
    if (lower === "hwy") return "Hwy";
    if (lower === "pct") return "Pct";
    if (lower === "us") return "US";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };
  const humanizeId = (id) =>
    String(id).split("-").filter(Boolean).map(titleToken).join(" ");

  const buildMetricOptions = (baselines) => {
    const tableRank = (t) =>
      t === "rates-by-race" ? 0 : t === "search-statistics" ? 1 : t === "number-of-stops-by-race" ? 2 : t === "disparity-index-by-race" ? 3 : 99;
    const sectionRank = (t, s) => {
      if (t !== "rates-by-race") return 99;
      return s === "totals" ? 0 : s === "rates" ? 1 : 2;
    };

    return [...new Set(baselines.map((b) => String(b?.row_key || "").trim()).filter(Boolean))]
      .map((value) => {
        const [tableId = "", sectionId = "", metricId = ""] = value.split("--");
        return { value, tableId, sectionId, metricId,
          label: `${humanizeId(tableId)}: ${humanizeId(sectionId)}: ${humanizeId(metricId)}` };
      })
      .sort((a, b) => {
        const tc = tableRank(a.tableId) - tableRank(b.tableId);
        if (tc !== 0) return tc;
        const sc = sectionRank(a.tableId, a.sectionId) - sectionRank(b.tableId, b.sectionId);
        if (sc !== 0) return sc;
        return a.label.localeCompare(b.label);
      })
      .map(({ value, label }) => ({ value, label }));
  };

  $: metricOptions = buildMetricOptions(data.baselines ?? []);

  // ─── Race options ─────────────────────────────────────────────────────────────

  const RATIO_KEY = "__nonwhite_white_ratio";
  const raceColumns = ["Total", "White", "Black", "Hispanic", "Native American", "Asian", "Other"];

  $: raceOptions = [
    { value: "Total", label: map_race_total() },
    { value: RATIO_KEY, label: map_race_nonwhite_white_ratio() },
    ...raceColumns.slice(1).map((r) => ({ value: r, label: r })),
  ];

  // ─── Selections ───────────────────────────────────────────────────────────────

  let selectedMetric = "";
  let selectedRace = "Total";
  let selectedYear = "";
  let minStops = 0;
  let panelOpen = false; // mobile toggle

  $: if (metricOptions.length && !selectedMetric) {
    selectedMetric = metricOptions[0].value;
  }

  $: isRateMetric = (() => {
    if (!selectedMetric) return false;
    const [, s = "", m = ""] = selectedMetric.split("--");
    return s.includes("rate") || m.includes("rate") || m.includes("pct") || m.includes("percent");
  })();

  // ─── Data fetching ────────────────────────────────────────────────────────────

  const BASE_STOPS_ROW_KEY = "rates-by-race--totals--all-stops";
  const metricCache = new Map();
  const normalizeAgencyName = (name) =>
    String(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const fetchMetric = async (rowKey) => {
    if (metricCache.has(rowKey)) return metricCache.get(rowKey);
    const p = fetch(withDataBase(`/dist/metric_year/${rowKey}.json`)).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    });
    metricCache.set(rowKey, p);
    return p;
  };

  // Build slug map from agency index (comes from root layout)
  $: slugMap = (() => {
    const map = new Map();
    for (const entry of data.agencies ?? []) {
      const slug = entry.agency_slug ?? entry.slug ?? entry.id;
      if (!slug) continue;
      const candidates = [
        entry.canonical_name, entry.agency_name, entry.name, entry.agency,
        ...(Array.isArray(entry.names) ? entry.names : []),
      ].filter(Boolean);
      for (const name of candidates) {
        const key = normalizeAgencyName(name);
        if (key && !map.has(key)) map.set(key, slug);
      }
    }
    return map;
  })();

  // ─── Computed choropleth data ─────────────────────────────────────────────────

  let yearOptions = [];
  let featureStateData = new Map();
  let rawValuesBySlug = new Map(); // slug → raw display value (for hover)
  let totalStopsBySlug = new Map();
  let loadError = "";
  let isLoading = false;

  // Percentile normalize: returns Map<slug, 0..1>
  const percentileNormalize = (slugValues) => {
    const finite = [...slugValues.values()].filter(Number.isFinite);
    if (finite.length < 2) return new Map([...slugValues].map(([k]) => [k, 0.5]));
    const sorted = [...finite].sort((a, b) => a - b);
    const p5 = sorted[Math.max(0, Math.floor(sorted.length * 0.05))];
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const range = p95 - p5;
    const result = new Map();
    for (const [slug, v] of slugValues) {
      if (!Number.isFinite(v)) continue;
      result.set(slug, range === 0 ? 0.5 : Math.max(0, Math.min(1, (v - p5) / range)));
    }
    return result;
  };

  const toAgencySlug = (name) =>
    String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const computeMap = async (metric, race, year, minS, sMap) => {
    if (!metric || !year) return;
    isLoading = true;
    loadError = "";
    try {
      const [metricPayload, stopsPayload] = await Promise.all([
        fetchMetric(metric),
        fetchMetric(BASE_STOPS_ROW_KEY),
      ]);

      const metricRows = (metricPayload?.rows ?? []).filter(
        (r) => String(r?.year ?? "") === String(year)
      );
      const stopsRows = (stopsPayload?.rows ?? []).filter(
        (r) => String(r?.year ?? "") === String(year)
      );

      const stopsMap = new Map();
      for (const r of stopsRows) {
        const key = normalizeAgencyName(r.agency ?? "");
        if (key) stopsMap.set(key, Number(r.Total ?? 0));
      }

      const rawValues = new Map();
      const totalStops = new Map();

      for (const r of metricRows) {
        const agencyName = String(r.agency ?? "");
        const key = normalizeAgencyName(agencyName);
        if (!key) continue;
        const slug = sMap.get(key) ?? toAgencySlug(agencyName);
        const stops = stopsMap.get(key) ?? 0;
        if (stops < minS) continue;
        totalStops.set(slug, stops);

        let value;
        if (race === RATIO_KEY) {
          const total = Number(r.Total ?? NaN);
          const white = Number(r.White ?? NaN);
          value = white > 0 && Number.isFinite(total) ? (total - white) / white : NaN;
        } else {
          value = Number(r[race] ?? NaN);
        }

        if (Number.isFinite(value)) rawValues.set(slug, value);
      }

      rawValuesBySlug = rawValues;
      totalStopsBySlug = totalStops;
      featureStateData = percentileNormalize(rawValues);
    } catch (e) {
      loadError = e instanceof Error ? e.message : map_panel_error();
      featureStateData = new Map();
    } finally {
      isLoading = false;
    }
  };

  // Derive year options from the selected metric payload
  const loadYearOptions = async (metric) => {
    if (!metric) return;
    try {
      const payload = await fetchMetric(metric);
      const years = [...new Set((payload?.rows ?? []).map((r) => String(r?.year ?? "")).filter(Boolean))]
        .sort((a, b) => Number(b) - Number(a));
      yearOptions = years;
      if (!years.includes(selectedYear)) selectedYear = years[0] ?? "";
    } catch {
      yearOptions = [];
      selectedYear = "";
    }
  };

  $: loadYearOptions(selectedMetric);
  $: computeMap(selectedMetric, selectedRace, selectedYear, minStops, slugMap);

  // ─── Hover popup ──────────────────────────────────────────────────────────────

  let hoverInfo = null;

  const handleHover = (e) => {
    const { slug, x, y } = e.detail;
    if (!slug) { hoverInfo = null; return; }
    const raw = rawValuesBySlug.get(slug);
    const stops = totalStopsBySlug.get(slug);
    const agencyEntry = (data.agencies ?? []).find(
      (a) => (a.agency_slug ?? a.slug ?? a.id) === slug
    );
    const name = agencyEntry?.canonical_name ?? agencyEntry?.names?.[0] ?? slug;
    hoverInfo = { slug, name, raw, stops, x, y };
  };

  const handleLeave = () => { hoverInfo = null; };

  const handleClick = (e) => {
    const { slug } = e.detail;
    if (!slug) return;
    let locale = "en";
    try { locale = getLocale(); } catch { locale = "en"; }
    goto(`/${locale}/agency/${slug}`).catch(() => {
      window.location.href = `/${locale}/agency/${slug}`;
    });
  };

  // ─── Value formatting ─────────────────────────────────────────────────────────

  const valueFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const stopsFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const formatRaw = (v) => (Number.isFinite(v) ? valueFormatter.format(v) : "—");
  const formatStops = (v) => (Number.isFinite(v) ? stopsFormatter.format(v) : "—");

  $: locale = (() => { try { return getLocale(); } catch { return "en"; } })();
  $: basemapStyleUrl = `/map/style.${locale}.json`;
</script>

<svelte:head>
  <title>{map_page_title()}</title>
</svelte:head>

<StickyHeader agencies={data.agencies} />

<div
  class="relative overflow-hidden bg-slate-100"
  style="height: calc(100dvh - var(--site-header-height, 56px))"
>
  <!-- Map fills the full container -->
  <ChoroplethMap
    {featureStateData}
    {basemapStyleUrl}
    on:hover={handleHover}
    on:leave={handleLeave}
    on:click={handleClick}
  />

  <!-- Loading / error overlay -->
  {#if isLoading}
    <div class="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
      <span class="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-600 shadow">
        {map_panel_loading()}
      </span>
    </div>
  {/if}

  <!-- Controls panel — desktop: always visible; mobile: toggle -->
  <div class="absolute left-3 top-3 z-10 w-64 max-w-[calc(100vw-1.5rem)]">
    <!-- Mobile toggle button (shown when panel is closed) -->
    <button
      type="button"
      class="mb-1 flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-slate-700 shadow-md md:hidden {panelOpen ? 'hidden' : ''}"
      on:click={() => (panelOpen = true)}
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 10z" clip-rule="evenodd" />
      </svg>
      {map_panel_controls_open()}
    </button>

    <!-- Panel body: always open on md+, toggle on mobile -->
    <div class="{!panelOpen ? 'hidden md:block' : ''} rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur-sm">
      <div class="mb-3 flex items-center justify-between md:hidden">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">{map_panel_controls_open()}</span>
        <button
          type="button"
          class="rounded-md p-1 text-slate-500 hover:text-slate-800"
          on:click={() => (panelOpen = false)}
          aria-label={map_panel_controls_close()}
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      <!-- Metric select -->
      <div class="mb-3">
        <label for="map-metric" class="mb-1 block text-xs font-semibold text-slate-600">
          {map_panel_metric_label()}
        </label>
        <select
          id="map-metric"
          bind:value={selectedMetric}
          class="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
        >
          {#each metricOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <!-- Race select -->
      <div class="mb-3">
        <label for="map-race" class="mb-1 block text-xs font-semibold text-slate-600">
          {map_panel_race_label()}
        </label>
        <select
          id="map-race"
          bind:value={selectedRace}
          class="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
        >
          {#each raceOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        {#if selectedRace === RATIO_KEY && isRateMetric}
          <p class="mt-1 text-[0.7rem] leading-snug text-amber-700">
            {map_race_note_ratio_rates()}
          </p>
        {/if}
      </div>

      <!-- Year pills -->
      {#if yearOptions.length}
        <div class="mb-3">
          <span class="mb-1 block text-xs font-semibold text-slate-600">
            {map_panel_year_label()}
          </span>
          <div class="flex flex-wrap gap-1">
            {#each yearOptions as year}
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors {selectedYear === year
                  ? 'bg-[#1b613c] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                on:click={() => (selectedYear = year)}
              >
                {year}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Min stops -->
      <div class="mb-3">
        <label for="map-min-stops" class="mb-1 block text-xs font-semibold text-slate-600">
          {map_panel_min_stops_label()}
        </label>
        <input
          id="map-min-stops"
          type="number"
          min="0"
          step="100"
          bind:value={minStops}
          class="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
        />
      </div>

      <!-- Agency type (stub — architectural placeholder) -->
      <div class="mb-1 opacity-50">
        <label for="map-agency-type" class="mb-1 block text-xs font-semibold text-slate-600">
          {map_panel_agency_type_label()}
        </label>
        <select
          id="map-agency-type"
          disabled
          class="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-500"
        >
          <option>{map_panel_agency_type_placeholder()}</option>
        </select>
      </div>

      {#if loadError}
        <p class="mt-2 text-xs text-red-600">{loadError}</p>
      {/if}
    </div>
  </div>

  <!-- Legend -->
  <div class="absolute bottom-8 left-3 z-10 rounded-xl bg-white/95 px-3 py-2 shadow backdrop-blur-sm">
    <div class="mb-1 flex justify-between text-[0.65rem] font-semibold text-slate-500">
      <span>{map_legend_low()}</span>
      <span>{map_legend_high()}</span>
    </div>
    <div
      class="h-3 w-36 rounded-sm"
      style="background: linear-gradient(to right, #dbeafe, #93c5fd, #3b82f6, #1d4ed8, #1e3a8a)"
    ></div>
    <div class="mt-1.5 flex items-center gap-1.5">
      <span class="inline-block h-3 w-3 flex-shrink-0 rounded-sm bg-slate-200"></span>
      <span class="text-[0.65rem] text-slate-500">{map_panel_no_data()}</span>
    </div>
  </div>

  <!-- Hover tooltip (Svelte-rendered, positioned by map events) -->
  {#if hoverInfo}
    {@const offsetX = hoverInfo.x + 14}
    {@const offsetY = hoverInfo.y - 10}
    <div
      class="pointer-events-none absolute z-20 max-w-[220px] rounded-lg bg-slate-900/90 px-3 py-2 text-white shadow-lg"
      style="left: {offsetX}px; top: {offsetY}px; transform: translateY(-100%)"
    >
      <p class="text-sm font-semibold leading-snug">{hoverInfo.name}</p>
      {#if Number.isFinite(hoverInfo.raw)}
        <p class="mt-0.5 text-xs text-slate-300">{formatRaw(hoverInfo.raw)}</p>
      {:else}
        <p class="mt-0.5 text-xs text-slate-400">{map_hover_no_data()}</p>
      {/if}
      {#if Number.isFinite(hoverInfo.stops)}
        <p class="mt-0.5 text-xs text-slate-400">{map_hover_stops({ stops: formatStops(hoverInfo.stops) })}</p>
      {/if}
    </div>
  {/if}
</div>
