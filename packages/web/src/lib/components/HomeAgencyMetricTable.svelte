<script lang="ts">
  import { Grid, PagingData, PlainTableCssTheme } from "@mediakular/gridcraft";
  import { onMount } from "svelte";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { withDataBase } from "$lib/dataBase";
  import {
    home_metric_table_label,
    home_metric_table_heading,
    home_metric_select_label,
    home_metric_table_showing,
    home_metric_min_stops_label,
    home_metric_search_placeholder,
    home_metric_search_aria_label,
    home_metric_year_selector_label,
    home_metric_no_rows,
    home_metric_loading,
    home_metric_hidden_over_100,
    home_metric_col_agency,
    home_metric_col_total_stops,
  } from "$lib/paraglide/messages.js";
  import * as m from "$lib/paraglide/messages.js";
  import GridAgencyLinkCell from "$lib/components/grid/GridAgencyLinkCell.svelte";

  type AgencyIndexEntry = {
    agency_slug?: string;
    slug?: string;
    id?: string;
    canonical_name?: string;
    agency_name?: string;
    name?: string;
    agency?: string;
    names?: string[];
  };

  type BaselineEntry = {
    row_key?: string;
  };

  type MetricYearSubset = {
    agencies: string[];
    years: Array<number | string>;
    columns: string[];
    rows: Record<string, Array<Array<number | null>>>;
  };

  type MetricOption = {
    value: string;
    label: string;
  };

  type AgencyLink = {
    value: string;
    href: string;
  };

  type TableRow = {
    id: string;
    agency: {
      value: string;
      href: string;
    };
    total_stops: string;
    Total: string;
    White: string;
    Black: string;
    Hispanic: string;
    "Native American": string;
    Asian: string;
    Other: string;
    raw: Record<string, number>;
  };

  export let agencies: AgencyIndexEntry[] = [];

  const baseTotalStopsRowKey = "stops";
  const raceColumns = [
    "Total",
    "White",
    "Black",
    "Hispanic",
    "Native American",
    "Asian",
    "Other",
  ] as const;
  const agencyColumnWidth = "var(--agency-col-width)";
  const totalStopsColumnWidth = "var(--total-stops-col-width)";
  const raceColumnWidth = "var(--race-col-width)";
  const rateOutlierThreshold = 100;
  const minTotalStopsPresets = [0, 100, 1000, 5000, 10000] as const;

  const valueFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });

  const subsetCache = new Map<string, Promise<MetricYearSubset>>();
  const SUBSET_URL = withDataBase("/data/dist/metric_year_subset.json");
  const naturalTextSorter = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const compareStrings = (a: string, b: string) => (a === b ? 0 : a < b ? -1 : 1);

  const normalizeText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const toAgencySlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const titleToken = (token: string) => {
    const lower = token.toLowerCase();
    if (lower === "acs") return "ACS";
    if (lower === "bac") return "BAC";
    if (lower === "dwi") return "DWI";
    if (lower === "hwy") return "Hwy";
    if (lower === "pct") return "Pct";
    if (lower === "us") return "US";
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  };

  const humanizeId = (id: string) =>
    String(id)
      .split("-")
      .filter(Boolean)
      .map((token) => titleToken(token))
      .join(" ");

  const labelForId = (prefix: string, id: string) => {
    if (!id) return "";
    const key = `${prefix}_${id}`;
    const fn = (m as Record<string, unknown>)[key];
    return typeof fn === "function" ? (fn as () => string)() : humanizeId(id);
  };

  const toDisplayValue = (value: number | null | undefined) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return "—";
    return valueFormatter.format(numeric);
  };

  const isRateMetricRowKey = (rowKey: string) => {
    if (!rowKey || rowKey === baseTotalStopsRowKey) return false;

    const [tableId = "", sectionId = "", metricId = ""] = rowKey.split("--");
    const section = sectionId.toLowerCase();
    const metric = metricId.toLowerCase();
    const table = tableId.toLowerCase();

    if (section.includes("rate")) return true;
    if (metric.includes("rate") || metric.includes("pct") || metric.includes("percent")) return true;
    if (table.includes("rate") && section !== "totals") return true;
    return false;
  };

  const rowHasRateOverflow = (row: TableRow) =>
    raceColumns.some((column) => {
      const value = row.raw[column];
      return Number.isFinite(value) && value > rateOutlierThreshold;
    });

  const splitRowsByRateOverflow = (rows: TableRow[], hideOverflows: boolean) => {
    if (!hideOverflows) return { visible: rows, hidden: [] as TableRow[] };

    const visible: TableRow[] = [];
    const hidden: TableRow[] = [];

    rows.forEach((row) => {
      if (rowHasRateOverflow(row)) {
        hidden.push(row);
      } else {
        visible.push(row);
      }
    });

    return { visible, hidden };
  };

  const buildAgencySlugMap = (agencyEntries: AgencyIndexEntry[]) => {
    const map = new Map<string, string>();

    agencyEntries.forEach((entry) => {
      const slug = entry?.agency_slug || entry?.slug || entry?.id;
      if (!slug) return;

      const names = [
        entry?.canonical_name,
        entry?.agency_name,
        entry?.name,
        entry?.agency,
        ...(Array.isArray(entry?.names) ? entry.names : []),
      ].filter((value): value is string => Boolean(value));

      names.forEach((name) => {
        const normalized = normalizeText(name);
        if (!normalized || map.has(normalized)) return;
        map.set(normalized, slug);
      });
    });

    return map;
  };

  const rowKeyOptionsFromBaselines = (baselineEntries: BaselineEntry[]) => {
    const keys = Array.from(
      new Set(
        baselineEntries
          .map((entry) => String(entry?.row_key || "").trim())
          .filter(Boolean),
      ),
    );

    // v2: canonical keys have a flat structure; split on first '--' to get group/metric.
    const RATE_KEYS = new Set([
      "search-rate", "arrest-rate", "contraband-hit-rate", "stop-rate",
      "citation-rate", "stop-rate-residents",
    ]);
    const getCanonicalGroup = (key: string) => {
      const idx = key.indexOf("--");
      if (idx >= 0) return key.slice(0, idx);
      if (RATE_KEYS.has(key) || key.endsWith("-rate")) return "rates";
      return "core-counts";
    };

    return keys
      .map((value) => {
        const groupId = getCanonicalGroup(value);
        const metricSuffix = value.includes("--") ? value.slice(value.indexOf("--") + 2) : value;
        const groupLabel = labelForId("section", groupId) || humanizeId(groupId);
        const metricLabel = labelForId("metric", metricSuffix) || humanizeId(metricSuffix);

        return {
          value,
          label: `${groupLabel}: ${metricLabel}`,
          tableId: groupId,
          sectionId: "",
          metricId: metricSuffix,
          tableLabel: groupLabel,
          sectionLabel: "",
          metricLabel,
        };
      })
      .sort((a, b) => {
        // Flat canonical keys (no '--') are core counts/rates — sort first.
        const aPriority = a.value.includes("--") ? 1 : 0;
        const bPriority = b.value.includes("--") ? 1 : 0;
        if (aPriority !== bPriority) return aPriority - bPriority;

        const groupCmp = naturalTextSorter.compare(a.tableLabel, b.tableLabel);
        if (groupCmp !== 0) return groupCmp;

        const metricCmp = naturalTextSorter.compare(a.metricLabel, b.metricLabel);
        if (metricCmp !== 0) return metricCmp;

        return naturalTextSorter.compare(a.value, b.value);
      })
      .map(({ value, label }) => ({ value, label }));
  };

  const fetchSubset = () => {
    const cached = subsetCache.get(SUBSET_URL);
    if (cached) return cached;

    const request = fetch(SUBSET_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load metric data (${response.status}).`);
        }
        return (await response.json()) as MetricYearSubset;
      })
      .catch((error) => {
        subsetCache.delete(SUBSET_URL);
        throw error;
      });

    subsetCache.set(SUBSET_URL, request);
    return request;
  };

  const yearsFromPayload = (payload: MetricYearSubset) =>
    Array.from(payload.years ?? [])
      .map((y) => String(y))
      .sort((a, b) => Number(b) - Number(a));

  const rowsForYear = (
    payload: MetricYearSubset,
    metricRowKey: string,
    year: string,
    slugMap: Map<string, string>,
    locale: string,
    sortColumn: "Total" | "total_stops",
  ): TableRow[] => {
    const yearNum = Number(year);
    const colIdx = (col: string) => payload.columns.indexOf(col);
    const getVal = (row: Array<number | null>, idx: number) => {
      if (idx === -1 || idx >= row.length) return NaN;
      const v = row[idx];
      return v === null || v === undefined ? NaN : Number(v);
    };

    const stopsData = payload.rows?.[baseTotalStopsRowKey] ?? [];
    const stopsMap = new Map<number, number>();
    for (const row of stopsData) {
      if (!Array.isArray(row)) continue;
      if (Number(payload.years?.[Number(row[1])]) !== yearNum) continue;
      stopsMap.set(Number(row[0]), getVal(row, colIdx("Total")));
    }

    const metricData =
      metricRowKey === baseTotalStopsRowKey
        ? stopsData
        : (payload.rows?.[metricRowKey] ?? []);
    const metricMap = new Map<number, Record<string, number>>();
    for (const row of metricData) {
      if (!Array.isArray(row)) continue;
      if (Number(payload.years?.[Number(row[1])]) !== yearNum) continue;
      const vals: Record<string, number> = {};
      for (const col of raceColumns) {
        vals[col] = getVal(row, colIdx(col));
      }
      metricMap.set(Number(row[0]), vals);
    }

    const allIdxs = new Set([...stopsMap.keys(), ...metricMap.keys()]);

    return Array.from(allIdxs)
      .map((aIdx) => {
        const agencyName = payload.agencies?.[aIdx]?.trim() || "Unknown agency";
        const agencySlug = slugMap.get(normalizeText(agencyName)) || toAgencySlug(agencyName);
        const stopsTotal = stopsMap.get(aIdx) ?? NaN;
        const metricVals = metricMap.get(aIdx) ?? {};

        const raw: Record<string, number> = { total_stops: stopsTotal };
        for (const col of raceColumns) raw[col] = metricVals[col] ?? NaN;

        return {
          id: `${agencyName}-${year}`,
          agency: { value: agencyName, href: `/${locale}/agency/${agencySlug}` },
          total_stops: toDisplayValue(stopsTotal),
          Total: toDisplayValue(metricVals["Total"]),
          White: toDisplayValue(metricVals["White"]),
          Black: toDisplayValue(metricVals["Black"]),
          Hispanic: toDisplayValue(metricVals["Hispanic"]),
          "Native American": toDisplayValue(metricVals["Native American"]),
          Asian: toDisplayValue(metricVals["Asian"]),
          Other: toDisplayValue(metricVals["Other"]),
          raw,
        };
      })
      .sort((a, b) => {
        if (b.raw[sortColumn] !== a.raw[sortColumn]) return b.raw[sortColumn] - a.raw[sortColumn];
        return compareStrings(a.agency.value, b.agency.value);
      });
  };

  let currentLocale = "en";
  let agencySlugMap = new Map<string, string>();

  let metricOptions: MetricOption[] = [];
  let selectedMetric = baseTotalStopsRowKey;
  let yearOptions: string[] = [];
  let selectedYear = "";
  let agencySearch = "";

  let isLoading = true;
  let loadError = "";
  let tableRows: TableRow[] = [];
  let visibleRaceColumns: (typeof raceColumns)[number][] = [...raceColumns];
  let defaultSortColumn = "Total";
  let gridColumns: any[] = [];
  let gridSortByColumn = "Total";
  let gridSortOrder = -1;
  let lastSortedColumn = "";
  let sortResetMetric = "";
  let gridFrameElement: HTMLDivElement | null = null;
  let normalizedSearch = "";
  let rateFilteredRows: TableRow[] = [];
  let overflowRows: TableRow[] = [];
  let excludedAgencyLinks: AgencyLink[] = [];
  let minTotalStops = 100;
  let minTotalStopsInput = "100";
  let normalizedMinTotalStops = 100;
  let filteredRows: TableRow[] = [];
  let shouldHideOver100Rates = false;

  const gridPaging = new PagingData(1, 1000, [1000]);

  $: visibleRaceColumns =
    selectedMetric === baseTotalStopsRowKey
      ? (raceColumns.filter((column) => column !== "Total") as (typeof raceColumns)[number][])
      : [...raceColumns];
  $: defaultSortColumn = selectedMetric === baseTotalStopsRowKey ? "total_stops" : "Total";
  $: if (selectedMetric !== sortResetMetric) {
    gridSortByColumn = defaultSortColumn;
    gridSortOrder = -1;
    lastSortedColumn = defaultSortColumn;
    sortResetMetric = selectedMetric;
  }
  $: if (gridSortByColumn && gridSortByColumn !== lastSortedColumn) {
    if (gridSortOrder === 1) {
      // Gridcraft initializes new column clicks with ascending order; flip once so first click is descending.
      gridSortOrder = -1;
    }
    lastSortedColumn = gridSortByColumn;
  }
  $: gridColumns = [
    {
      key: "agency",
      title: home_metric_col_agency(),
      width: agencyColumnWidth,
      sortable: true,
      accessor: (row: TableRow) => row.agency,
      sortValue: (row: TableRow) => row.agency.value,
      renderComponent: GridAgencyLinkCell,
    },
    {
      key: "total_stops",
      title: home_metric_col_total_stops(),
      width: totalStopsColumnWidth,
      sortable: true,
      accessor: (row: TableRow) => row.total_stops,
      sortValue: (row: TableRow) => row.raw.total_stops,
    },
    ...visibleRaceColumns.map((column) => ({
      key: column,
      title: column,
      width: raceColumnWidth,
      sortable: true,
      accessor: (row: TableRow) => row[column],
      sortValue: (row: TableRow) => row.raw[column],
    })),
  ];

  $: {
    try {
      currentLocale = getLocale() || "en";
    } catch {
      currentLocale = "en";
    }
  }

  $: agencySlugMap = buildAgencySlugMap(agencies || []);
  $: shouldHideOver100Rates = isRateMetricRowKey(selectedMetric);
  $: {
    const split = splitRowsByRateOverflow(tableRows, shouldHideOver100Rates);
    rateFilteredRows = split.visible;
    overflowRows = split.hidden;
  }
  $: excludedAgencyLinks = Array.from(
    new Map(overflowRows.map((row) => [row.agency.href, row.agency])).values(),
  ).sort((a, b) => compareStrings(a.value, b.value));
  $: normalizedMinTotalStops = Number.isFinite(Number(minTotalStops)) ? Math.max(0, Number(minTotalStops)) : 0;
  $: normalizedSearch = normalizeText(agencySearch || "");
  $: filteredRows = rateFilteredRows.filter((row) => {
    if (row.raw.total_stops < normalizedMinTotalStops) return false;
    if (!normalizedSearch) return true;
    return normalizeText(row.agency.value).includes(normalizedSearch);
  });

  const applyMinTotalStopsInput = () => {
    const parsed = Number(minTotalStopsInput);
    const next = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
    minTotalStops = next;
    minTotalStopsInput = String(next);
  };

  const setMinTotalStops = (value: number) => {
    const next = Math.max(0, Math.round(value));
    minTotalStops = next;
    minTotalStopsInput = String(next);
  };

  const handleMinStopsInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    minTotalStopsInput = target.value;
  };

  const handleMinStopsKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyMinTotalStopsInput();
    (event.currentTarget as HTMLInputElement)?.blur();
  };

  const loadMetricRows = async (rowKey: string, keepYear = false) => {
    isLoading = true;
    loadError = "";

    try {
      const payload = await fetchSubset();
      const years = yearsFromPayload(payload);
      yearOptions = years;

      if (!keepYear || !years.includes(selectedYear)) {
        selectedYear = years[0] ?? "";
      }

      const sortColumn = rowKey === baseTotalStopsRowKey ? "total_stops" : "Total";
      tableRows = selectedYear
        ? rowsForYear(payload, rowKey, selectedYear, agencySlugMap, currentLocale, sortColumn)
        : [];
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Unable to load selected metric data.";
      yearOptions = [];
      selectedYear = "";
      tableRows = [];
    } finally {
      isLoading = false;
    }
  };

  const initialize = async () => {
    isLoading = true;
    loadError = "";

    try {
      const response = await fetch(withDataBase("/dist/statewide_slug_baselines.json"));
      if (!response.ok) {
        throw new Error(`Unable to load metric list (${response.status}).`);
      }

      const baselineEntries = (await response.json()) as BaselineEntry[];
      metricOptions = rowKeyOptionsFromBaselines(baselineEntries);

      if (!metricOptions.length) {
        throw new Error("No metrics available.");
      }

      if (!metricOptions.some((option) => option.value === selectedMetric)) {
        selectedMetric = metricOptions[0].value;
      }

      await loadMetricRows(selectedMetric, false);
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Unable to initialize agencies table.";
      metricOptions = [];
      yearOptions = [];
      selectedYear = "";
      tableRows = [];
      isLoading = false;
    }
  };

  const handleMetricChange = async (event: Event) => {
    const target = event.currentTarget as HTMLSelectElement;
    selectedMetric = target.value;
    await loadMetricRows(selectedMetric, false);
  };

  const selectYear = async (year: string) => {
    selectedYear = year;
    await loadMetricRows(selectedMetric, true);
  };

  const handleGridRowClick = (event: MouseEvent) => {
    const rawTarget = event.target as EventTarget | null;
    if (!rawTarget) return;
    const target =
      rawTarget instanceof Element ? rawTarget : (rawTarget as Node).parentElement;
    if (!target) return;

    if (target.closest("a, button, input, select, textarea, label")) {
      return;
    }

    const row = target.closest("tbody tr");
    if (!row) return;

    const link = row.querySelector("td:first-child a[href]") as HTMLAnchorElement | null;
    if (!link?.href) return;

    window.location.assign(link.href);
  };

  onMount(() => {
    gridFrameElement?.addEventListener("click", handleGridRowClick);
    void initialize();

    return () => {
      gridFrameElement?.removeEventListener("click", handleGridRowClick);
    };
  });
</script>

<section id="agencies" class="border-t border-slate-200 bg-white py-12" aria-label={home_metric_table_label()}>
  <div class="mx-auto max-w-6xl px-6">
    <h2 class="mb-5 text-3xl font-bold text-slate-900">{home_metric_table_heading()}</h2>

    <div class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-start">
      <div class="min-w-0">
        <label class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" for="home-metric-select">
          {home_metric_select_label()}
        </label>
        <select
          id="home-metric-select"
          class="mt-2 h-12 w-full rounded-md border border-slate-400 bg-white px-3 text-base font-semibold text-slate-900 focus:border-slate-500 focus:outline-none"
          bind:value={selectedMetric}
          on:change={handleMetricChange}
          disabled={!metricOptions.length || isLoading}
        >
          {#each metricOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        <p class="mt-2 pl-1 text-[0.72rem] font-medium text-slate-500 sm:text-xs">
          {home_metric_table_showing({ visible: filteredRows.length.toLocaleString(), total: rateFilteredRows.length.toLocaleString() })}
        </p>
      </div>

      <div class="min-w-0">
        <label class="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500" for="home-min-stops">
          {home_metric_min_stops_label()}
        </label>
        <input
          id="home-min-stops"
          type="number"
          min="0"
          step="100"
          class="mt-2 h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-base text-slate-700 focus:border-slate-500 focus:outline-none"
          value={minTotalStopsInput}
          on:input={handleMinStopsInput}
          on:change={applyMinTotalStopsInput}
          on:blur={applyMinTotalStopsInput}
          on:keydown={handleMinStopsKeydown}
        />
        <div class="mt-2 flex flex-wrap gap-1.5">
          {#each minTotalStopsPresets as preset}
            <button
              type="button"
              class={`rounded-md border px-3 py-1.5 text-xs font-semibold leading-none transition sm:text-sm ${
                minTotalStops === preset
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
              }`}
              on:click={() => setMinTotalStops(preset)}
            >
              {preset.toLocaleString()}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="mb-5">
      <input
        type="search"
        class="h-10 w-full rounded-md border border-slate-400 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none sm:w-80 md:w-96"
        placeholder={home_metric_search_placeholder()}
        aria-label={home_metric_search_aria_label()}
        bind:value={agencySearch}
      />
    </div>

    {#if yearOptions.length}
      <div class="mb-5 mt-2 flex items-center gap-3">
        <label class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" for="home-year-select">
          {home_metric_year_selector_label()}
        </label>
        <select
          id="home-year-select"
          value={selectedYear}
          on:change={(e) => selectYear(e.currentTarget.value)}
          disabled={isLoading}
          class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-slate-500 focus:outline-none"
        >
          {#each yearOptions as year}
            <option value={year}>{year}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if loadError}
      <p class="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {loadError}
      </p>
    {/if}

    <div class="agency-metric-grid agency-metric-grid--frame" bind:this={gridFrameElement}>
      {#if filteredRows.length}
        <Grid
          data={filteredRows}
          columns={gridColumns}
          paging={gridPaging}
          theme={PlainTableCssTheme}
          bind:sortByColumn={gridSortByColumn}
          bind:sortOrder={gridSortOrder}
        />
      {:else if !isLoading}
        <div class="agency-metric-grid__empty">{home_metric_no_rows()}</div>
      {/if}

      {#if isLoading}
        <div class="agency-metric-grid__overlay">
          <span>{home_metric_loading()}</span>
        </div>
      {/if}
    </div>

    {#if excludedAgencyLinks.length}
      <div class="mt-2 text-[0.72rem] leading-relaxed text-slate-500 sm:text-xs">
        <p>
          {home_metric_hidden_over_100()}
          {#each excludedAgencyLinks as agency, index}
            <a
              class="text-slate-600 no-underline transition-colors hover:text-slate-800 hover:underline"
              href={agency.href}
            >
              {agency.value}</a
            >{index < excludedAgencyLinks.length - 1 ? ", " : "."}
          {/each}
        </p>
      </div>
    {/if}

  </div>
</section>

<style>
  .agency-metric-grid {
    --agency-col-width: 140px;
    --total-stops-col-width: 92px;
    --race-col-width: 110px;
    --sticky-col-bg: #f8fafc;
    --sticky-col-hover-bg: #e2e8f0;
    --gc-th-font-size: 0.62rem;
    --gc-th-color: #ffffff;
  }

  :global(.agency-metric-grid .gc-table-wrapper) {
    overflow: auto;
    height: min(70vh, 900px);
    position: relative;
  }

  .agency-metric-grid--frame {
    position: relative;
    min-height: min(70vh, 900px);
  }

  .agency-metric-grid__empty {
    display: grid;
    place-items: center;
    min-height: min(70vh, 900px);
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    background: #f8fafc;
    color: #475569;
    font-size: 0.9rem;
  }

  .agency-metric-grid__overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.72);
    color: #334155;
    font-size: 0.9rem;
    font-weight: 600;
    pointer-events: none;
    backdrop-filter: blur(1px);
  }

  :global(.agency-metric-grid .gc-table) {
    border-collapse: collapse;
    border-spacing: 0;
    width: 100%;
    table-layout: fixed;
  }

  :global(.agency-metric-grid .gc-header-tr th) {
    position: sticky;
    top: 0;
    z-index: 3;
    background: #334155;
    border-color: #334155;
    color: var(--gc-th-color);
    cursor: default;
    font-size: var(--gc-th-font-size);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.5rem 0.45rem;
    line-height: 1.1;
  }

  :global(.agency-metric-grid .gc-header-tr .gc-th-col-title) {
    color: var(--gc-th-color);
    font-size: var(--gc-th-font-size);
  }

  :global(.agency-metric-grid .gc-header-tr th *) {
    color: inherit;
  }

  :global(.agency-metric-grid .gc-header-tr .gc-th-col) {
    position: relative;
    padding-right: 0.95rem;
  }

  :global(.agency-metric-grid .gc-header-tr .gc-th-col svg) {
    position: absolute;
    right: 0;
    top: 50%;
  }

  :global(.agency-metric-grid .gc-header-tr .gc-th-col .lucide-arrow-down),
  :global(.agency-metric-grid .gc-header-tr .gc-th-col .lucide-arrow-up) {
    transform: translateY(-50%) rotate(180deg);
  }

  :global(.agency-metric-grid .gc-table th:first-child) {
    left: 0;
    z-index: 6;
  }

  :global(.agency-metric-grid .gc-table th:nth-child(2)) {
    left: var(--agency-col-width);
    z-index: 5;
  }

  :global(.agency-metric-grid .gc-header-tr th:has(.lucide-arrow-down)),
  :global(.agency-metric-grid .gc-header-tr th:has(.lucide-arrow-up)) {
    background: #1f2937;
    border-color: #1f2937;
  }

  :global(.agency-metric-grid .gc-table th),
  :global(.agency-metric-grid .gc-table td) {
    border: 0;
  }

  :global(.agency-metric-grid .gc-table td) {
    background: #ffffff;
    padding: 0.5rem 0.45rem;
    font-size: 0.8rem;
    color: #0f172a;
  }

  :global(.agency-metric-grid .gc-table td:not(:first-child)) {
    font-variant-numeric: tabular-nums;
    font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    padding-left: 0.22rem;
    padding-right: 0.22rem;
  }

  :global(.agency-metric-grid .gc-table th:not(:first-child)) {
    text-align: center;
    padding-left: 0.22rem;
    padding-right: 0.22rem;
  }

  :global(.agency-metric-grid .gc-table th:not(:first-child) .gc-th-col) {
    justify-content: center;
  }

  :global(.agency-metric-grid .gc-table td:not(:first-child)) {
    text-align: right;
  }

  :global(.agency-metric-grid .gc-table tbody tr:hover td) {
    background: #f1f5f9;
  }

  :global(.agency-metric-grid .gc-table tbody tr) {
    cursor: pointer;
  }

  :global(.agency-metric-grid .gc-table td:first-child) {
    position: sticky;
    left: 0;
    z-index: 4;
    background: var(--sticky-col-bg);
    white-space: normal;
    overflow-wrap: anywhere;
    box-shadow: 6px 0 8px -6px rgba(15, 23, 42, 0.15);
  }

  :global(.agency-metric-grid .gc-table td:nth-child(2)) {
    position: sticky;
    left: var(--agency-col-width);
    z-index: 3;
    background: var(--sticky-col-bg);
    box-shadow: 6px 0 8px -6px rgba(15, 23, 42, 0.15);
  }

  :global(.agency-metric-grid .gc-table tbody tr:hover td:first-child) {
    background: var(--sticky-col-hover-bg);
  }

  :global(.agency-metric-grid .gc-table tbody tr:hover td:nth-child(2)) {
    background: var(--sticky-col-hover-bg);
  }

  @media (max-width: 640px) {
    .agency-metric-grid {
      --agency-col-width: 102px;
      --total-stops-col-width: 78px;
      --race-col-width: 78px;
      --gc-th-font-size: 0.6rem;
    }

    .agency-metric-grid--frame {
      width: 100vw;
      margin-left: calc(50% - 50vw);
      margin-right: calc(50% - 50vw);
    }

    :global(.agency-metric-grid .gc-table-wrapper) {
      height: min(74vh, 760px);
    }

    :global(.agency-metric-grid .gc-header-tr th) {
      letter-spacing: 0.04em;
      padding: 0.3rem 0.35rem;
    }

    :global(.agency-metric-grid .gc-table td) {
      font-size: 0.74rem;
      padding: 0.42rem 0.35rem;
    }

    :global(.agency-metric-grid .gc-table td:not(:first-child)) {
      padding-left: 0.24rem !important;
      padding-right: 0.24rem !important;
    }

    :global(.agency-metric-grid .gc-table th:not(:first-child)) {
      padding-left: 0.24rem !important;
      padding-right: 0.24rem !important;
    }

    :global(.agency-metric-grid .gc-header-tr th:nth-child(n + 3) .gc-th-col) {
      gap: 0.1rem;
      padding-right: 0.5rem;
    }
  }
</style>
