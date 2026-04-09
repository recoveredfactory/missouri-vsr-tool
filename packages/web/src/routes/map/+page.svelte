<script>
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import AgencyMap from "$lib/components/AgencyMap.svelte";
  import ChangeMap from "$lib/components/ChangeMap.svelte";
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
    map_view_value,
    map_view_change,
    map_change_increase,
    map_change_decrease,
    map_change_year_range,
    map_change_pct,
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
  let minStops = 500;
  let selectedAgencyType = "Municipal";

  $: if (metricOptions.length && !selectedMetric) {
    selectedMetric = metricOptions[0].value;
  }

  // ─── Agency type options ──────────────────────────────────────────────────────

  $: agencyTypeOptions = (() => {
    const types = [...new Set((data.agencies ?? []).map((a) => a.agency_type).filter(Boolean))].sort();
    return [{ value: "", label: "All types" }, ...types.map((t) => ({ value: t, label: t }))];
  })();

  // Slugs allowed by the current agency type filter (null = no filter)
  $: allowedSlugs = selectedAgencyType
    ? new Set(
        (data.agencies ?? [])
          .filter((a) => a.agency_type === selectedAgencyType)
          .map((a) => a.agency_slug ?? a.slug ?? a.id)
          .filter(Boolean)
      )
    : null;

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

  let viewMode = "value"; // "value" | "change"

  let yearOptions = [];
  let featureStateData = new Map();
  let rawValuesBySlug = new Map(); // slug → raw display value (for hover)
  let totalStopsBySlug = new Map();
  let legendMin = null;
  let legendMax = null;
  let loadError = "";
  let isLoading = false;

  // ─── Change map data ──────────────────────────────────────────────────────────

  let changeFeatureStateData = new Map(); // Map<agency_id, -1..1>
  let rawChangesBySlug = new Map();       // Map<agency_id, raw % change (0.23 = 23%)>
  let changeYearFrom = "";
  let changeYearTo = "";

  // Percentile normalize: returns { normalized: Map<slug, 0..1>, min, max }
  const percentileNormalize = (slugValues) => {
    const finite = [...slugValues.values()].filter(Number.isFinite);
    if (finite.length < 2) return { normalized: new Map([...slugValues].map(([k]) => [k, 0.5])), min: null, max: null };
    const sorted = [...finite].sort((a, b) => a - b);
    const p5 = sorted[Math.max(0, Math.floor(sorted.length * 0.05))];
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const range = p95 - p5;
    const normalized = new Map();
    for (const [slug, v] of slugValues) {
      if (!Number.isFinite(v)) continue;
      normalized.set(slug, range === 0 ? 0.5 : Math.max(0, Math.min(1, (v - p5) / range)));
    }
    return { normalized, min: p5, max: p95 };
  };

  const toAgencySlug = (name) =>
    String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const computeMap = async (metric, race, year, minS, sMap, allowed) => {
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
        if (allowed && !allowed.has(slug)) continue;
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
      const { normalized, min, max } = percentileNormalize(rawValues);
      featureStateData = normalized;
      legendMin = min;
      legendMax = max;
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

  const extractValues = (rows, race, sMap, allowed, stopsMap, minS) => {
    const values = new Map();
    for (const r of rows) {
      const agencyName = String(r.agency ?? "");
      const key = normalizeAgencyName(agencyName);
      if (!key) continue;
      const slug = sMap.get(key) ?? toAgencySlug(agencyName);
      if (allowed && !allowed.has(slug)) continue;
      const stops = stopsMap?.get(key) ?? Infinity;
      if (stops < minS) continue;
      let value;
      if (race === RATIO_KEY) {
        const total = Number(r.Total ?? NaN), white = Number(r.White ?? NaN);
        value = white > 0 && Number.isFinite(total) ? (total - white) / white : NaN;
      } else {
        value = Number(r[race] ?? NaN);
      }
      if (Number.isFinite(value)) values.set(slug, value);
    }
    return values;
  };

  const computeChange = async (metric, race, sMap, allowed, yOptions, minS) => {
    if (!metric || yOptions.length < 2) { changeFeatureStateData = new Map(); return; }
    const sorted = [...yOptions].sort((a, b) => Number(a) - Number(b));
    const yearFrom = sorted[0];
    const yearTo = sorted[sorted.length - 1];
    try {
      const [payload, stopsPayload] = await Promise.all([
        fetchMetric(metric),
        fetchMetric(BASE_STOPS_ROW_KEY),
      ]);
      const stopsRows = (stopsPayload?.rows ?? []).filter(r => String(r?.year ?? "") === yearTo);
      const stopsMap = new Map();
      for (const r of stopsRows) {
        const key = normalizeAgencyName(r.agency ?? "");
        if (key) stopsMap.set(key, Number(r.Total ?? 0));
      }

      const vFrom = extractValues(
        (payload?.rows ?? []).filter(r => String(r?.year ?? "") === yearFrom),
        race, sMap, allowed, null, 0
      );
      const vTo = extractValues(
        (payload?.rows ?? []).filter(r => String(r?.year ?? "") === yearTo),
        race, sMap, allowed, stopsMap, minS
      );

      const rawChanges = new Map();
      for (const [slug, to] of vTo) {
        const from = vFrom.get(slug);
        if (!Number.isFinite(from) || from === 0) continue;
        rawChanges.set(slug, (to - from) / Math.abs(from));
      }

      // Normalize by p95 of absolute values → -1..1
      const absVals = [...rawChanges.values()].map(Math.abs).filter(Number.isFinite).sort((a, b) => a - b);
      if (absVals.length < 2) { changeFeatureStateData = new Map(); return; }
      const p95 = absVals[Math.min(absVals.length - 1, Math.floor(absVals.length * 0.95))];

      const normalized = new Map();
      for (const [slug, change] of rawChanges) {
        normalized.set(slug, Math.max(-1, Math.min(1, change / p95)));
      }

      rawChangesBySlug = rawChanges;
      changeYearFrom = yearFrom;
      changeYearTo = yearTo;
      changeFeatureStateData = normalized;
    } catch {
      changeFeatureStateData = new Map();
    }
  };

  $: loadYearOptions(selectedMetric);
  $: computeMap(selectedMetric, selectedRace, selectedYear, minStops, slugMap, allowedSlugs);
  $: computeChange(selectedMetric, selectedRace, slugMap, allowedSlugs, yearOptions, minStops);

  // ─── Hover popup ──────────────────────────────────────────────────────────────

  let hoverInfo = null;

  const handleHover = (e) => {
    const { slug, x, y } = e.detail;
    if (!slug) { hoverInfo = null; return; }
    const agencyEntry = (data.agencies ?? []).find(
      (a) => (a.agency_slug ?? a.slug ?? a.id) === slug
    );
    const name = agencyEntry?.canonical_name ?? agencyEntry?.names?.[0] ?? slug;
    if (viewMode === "change") {
      const rawChange = rawChangesBySlug.get(slug);
      hoverInfo = { slug, name, x, y, rawChange, mode: "change" };
    } else {
      const raw = rawValuesBySlug.get(slug);
      const stops = totalStopsBySlug.get(slug);
      hoverInfo = { slug, name, raw, stops, x, y, metricLabel, mode: "value" };
    }
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

  // ─── Metric label (section: metric) for tooltip ───────────────────────────────

  $: metricLabel = (() => {
    const [, sectionId = "", metricId = ""] = (selectedMetric || "").split("--");
    return [sectionId, metricId].filter(Boolean).map(humanizeId).join(": ");
  })();

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
  {#if viewMode === "value"}
    <AgencyMap
      {featureStateData}
      {basemapStyleUrl}
      on:hover={handleHover}
      on:leave={handleLeave}
      on:click={handleClick}
    />
  {:else}
    <ChangeMap
      featureStateData={changeFeatureStateData}
      {basemapStyleUrl}
      on:hover={handleHover}
      on:leave={handleLeave}
      on:click={handleClick}
    />
  {/if}

  <!-- Horizontal controls bar -->
  <div class="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
    <!-- Metric -->
    <div class="flex items-center gap-1.5">
      <label for="map-metric" class="shrink-0 text-xs font-semibold text-slate-500">{map_panel_metric_label()}</label>
      <select
        id="map-metric"
        bind:value={selectedMetric}
        class="max-w-[220px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
      >
        {#each metricOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <!-- Race -->
    <div class="flex items-center gap-1.5">
      <label for="map-race" class="shrink-0 text-xs font-semibold text-slate-500">{map_panel_race_label()}</label>
      <select
        id="map-race"
        bind:value={selectedRace}
        class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
      >
        {#each raceOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <!-- Min stops -->
    <div class="flex items-center gap-1.5">
      <label for="map-min-stops" class="shrink-0 text-xs font-semibold text-slate-500">{map_panel_min_stops_label()}</label>
      <select
        id="map-min-stops"
        bind:value={minStops}
        class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
      >
        {#each [0, 100, 500, 1000, 2500, 5000, 10000] as n}
          <option value={n}>{n === 0 ? "Any" : n.toLocaleString()}</option>
        {/each}
      </select>
    </div>

    <!-- Agency type -->
    <div class="flex items-center gap-1.5">
      <label for="map-agency-type" class="shrink-0 text-xs font-semibold text-slate-500">{map_panel_agency_type_label()}</label>
      <select
        id="map-agency-type"
        bind:value={selectedAgencyType}
        class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
      >
        {#each agencyTypeOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <!-- View toggle -->
    <div class="ml-auto flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
      {#each [["value", map_view_value()], ["change", map_view_change()]] as [mode, label]}
        <button
          type="button"
          class="rounded px-2.5 py-1 text-xs font-semibold transition-colors {viewMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
          on:click={() => { viewMode = mode; hoverInfo = null; }}
        >{label}</button>
      {/each}
    </div>

    {#if loadError}
      <p class="text-xs text-red-600">{loadError}</p>
    {/if}

    {#if selectedRace === RATIO_KEY && isRateMetric}
      <p class="text-[0.7rem] leading-snug text-amber-700">{map_race_note_ratio_rates()}</p>
    {/if}
  </div>

  <!-- Loading overlay -->
  {#if isLoading}
    <div class="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
      <span class="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-600 shadow">
        {map_panel_loading()}
      </span>
    </div>
  {/if}

  <!-- Legend -->
  <div class="absolute bottom-8 left-3 z-10 rounded-xl bg-white/95 px-3 py-2 shadow backdrop-blur-sm">
    {#if viewMode === "value"}
      <div class="flex items-end gap-1 pb-1">
        {#each [[3,"#dbeafe"],[7,"#93c5fd"],[11,"#3b82f6"],[16,"#1d4ed8"],[22,"#1e3a8a"]] as [r, fill]}
          <span
            class="inline-block rounded-full opacity-80"
            style="width:{r*2}px;height:{r*2}px;background:{fill};border:0.5px solid #fff"
          ></span>
        {/each}
      </div>
      <div class="flex justify-between text-[0.65rem] font-semibold text-slate-500">
        <span>{legendMin != null ? formatRaw(legendMin) : map_legend_low()}</span>
        <span>{legendMax != null ? formatRaw(legendMax) : map_legend_high()}</span>
      </div>
    {:else}
      <div class="flex items-center gap-3 pb-1">
        <div class="flex items-center gap-1">
          <span class="inline-block h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[#ea580c] opacity-80"></span>
          <span class="text-[0.65rem] font-semibold text-slate-600">{map_change_increase()}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="inline-block h-0 w-0 border-x-[6px] border-t-[10px] border-x-transparent border-t-[#2563eb] opacity-80"></span>
          <span class="text-[0.65rem] font-semibold text-slate-600">{map_change_decrease()}</span>
        </div>
      </div>
      {#if changeYearFrom && changeYearTo}
        <p class="text-[0.65rem] text-slate-400">{map_change_year_range({ from: changeYearFrom, to: changeYearTo })}</p>
      {/if}
    {/if}
  </div>

  <!-- Year scrubber (value view only) -->
  {#if viewMode === "value" && yearOptions.length}
    {@const yearsSorted = [...yearOptions].sort((a, b) => Number(a) - Number(b))}
    {@const selectedIdx = Math.max(0, yearsSorted.indexOf(selectedYear))}
    <div class="absolute bottom-8 right-3 z-10 rounded-xl bg-white/95 px-3 py-2.5 shadow backdrop-blur-sm">
      <div class="mb-1.5 flex items-baseline justify-between gap-4">
        <span class="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">{map_panel_year_label()}</span>
        <span class="text-xl font-bold tabular-nums leading-none text-slate-800">{selectedYear}</span>
      </div>
      {#if yearsSorted.length > 1}
        <input
          type="range"
          min="0"
          max={yearsSorted.length - 1}
          step="1"
          value={selectedIdx}
          on:input={(e) => (selectedYear = yearsSorted[Number(e.target.value)])}
          class="w-32 accent-[#1b613c]"
        />
        <div class="mt-0.5 flex justify-between text-[0.6rem] text-slate-400">
          <span>{yearsSorted[0]}</span>
          <span>{yearsSorted[yearsSorted.length - 1]}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Hover tooltip (Svelte-rendered, positioned by map events) -->
  {#if hoverInfo}
    {@const offsetX = hoverInfo.x + 14}
    {@const offsetY = hoverInfo.y - 10}
    <div
      class="pointer-events-none absolute z-20 max-w-[220px] rounded-lg bg-slate-900/90 px-3 py-2 text-white shadow-lg"
      style="left: {offsetX}px; top: {offsetY}px; transform: translateY(-100%)"
    >
      <p class="text-sm font-semibold leading-snug">{hoverInfo.name}</p>
      {#if hoverInfo.mode === "change"}
        {#if Number.isFinite(hoverInfo.rawChange)}
          {@const pct = (hoverInfo.rawChange * 100).toFixed(1)}
          <p class="mt-0.5 text-xs {hoverInfo.rawChange >= 0 ? 'text-orange-300' : 'text-blue-300'}">
            {hoverInfo.rawChange >= 0 ? "+" : ""}{pct}%
          </p>
          <p class="text-[0.65rem] text-slate-400">{map_change_year_range({ from: changeYearFrom, to: changeYearTo })}</p>
        {:else}
          <p class="mt-0.5 text-xs text-slate-400">{map_hover_no_data()}</p>
        {/if}
      {:else}
        {#if Number.isFinite(hoverInfo.raw)}
          <p class="mt-0.5 text-xs text-slate-300">{formatRaw(hoverInfo.raw)}</p>
          {#if hoverInfo.metricLabel}
            <p class="text-[0.65rem] text-slate-400">{hoverInfo.metricLabel}</p>
          {/if}
        {:else}
          <p class="mt-0.5 text-xs text-slate-400">{map_hover_no_data()}</p>
        {/if}
        {#if Number.isFinite(hoverInfo.stops)}
          <p class="mt-0.5 text-xs text-slate-400">{map_hover_stops({ stops: formatStops(hoverInfo.stops) })}</p>
        {/if}
      {/if}
    </div>
  {/if}
</div>
