<script lang="ts">
  import { onMount } from "svelte";
  import * as m from "$lib/paraglide/messages";
  import { scatterDomainGroupStore, type ScatterDomainRange } from "$lib/stores/scatter";

  type MetricYearSubset = {
    agencies: string[];
    years: Array<number | string>;
    columns: string[];
    rows: Record<string, Array<Array<number | null>>>;
  };

  type AxisScaleType = "linear" | "log";
  type DomainRange = ScatterDomainRange;

  const RATE_MULTIPLIER = 100;
  const RATE_METRIC_MAP: Record<string, string> = {
    "search-rate": "searches",
    "searches-rate": "searches",
    "arrest-rate": "arrests",
    "arrests-rate": "arrests",
    "citation-rate": "citations",
    "citations-rate": "citations",
    "contraband-hit-rate": "contraband",
    "contraband-rate": "contraband",
  };
  const metricDataCache = new Map<string, Promise<MetricYearSubset>>();

  const normalizePayload = (payload: unknown): MetricYearSubset => {
    if (!payload || typeof payload !== "object") {
      return { agencies: [], years: [], columns: [], rows: {} };
    }
    const record = payload as Record<string, unknown>;
    return {
      agencies: Array.isArray(record.agencies)
        ? record.agencies.map((agency) => String(agency))
        : [],
      years: Array.isArray(record.years) ? record.years : [],
      columns: Array.isArray(record.columns)
        ? record.columns.map((column) => String(column))
        : [],
      rows:
        record.rows && typeof record.rows === "object"
          ? (record.rows as Record<string, Array<Array<number | null>>>)
          : {},
    };
  };

  const fetchMetricData = (url: string) => {
    const cached = metricDataCache.get(url);
    if (cached) return cached;
    const request = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load rate data.");
        }
        return response.json();
      })
      .then((payload) => normalizePayload(payload))
      .catch((error) => {
        metricDataCache.delete(url);
        throw error;
      });
    metricDataCache.set(url, request);
    return request;
  };

  export let selectedYear: number | string;
  export let agencyName = "";
  export let title = "";
  export let xLabel = "";
  export let yLabel = "";
  export let excludeAgencies: string[] = [];
  export let minX: number | null = null;
  export let minY: number | null = null;
  export let maxX: number | null = null;
  export let maxY: number | null = null;
  export let minStops: number | null = null;
  export let sizeByStops = false;
  export let minCount: number | null = null;
  export let minCountKey = "rates-by-race--totals--searches";
  export let minCountColumn: string | null = null;
  export let minCountMessage = "Not enough records to display this chart.";
  export let excludeExactValue: number | null = null;
  export let excludeAboveX: number | null = null;
  export let xCountKey: string | null = null;
  export let yCountKey: string | null = null;
  export let xCountColumn: string | null = null;
  export let yCountColumn: string | null = null;
  export let xCountLabel = "";
  export let yCountLabel = "";
  export let stopsLabel = "Total stops";
  export let dotRadiusScale = 1;
  export let xScaleType: AxisScaleType = "linear";
  export let yScaleType: AxisScaleType = "linear";
  export let formatXAxisTick: (
    value: number | null | undefined,
    meta?: { isMax?: boolean }
  ) => string = (value) => formatValue(value);
  export let formatYAxisTick: (
    value: number | null | undefined,
    meta?: { isMax?: boolean }
  ) => string = (value) => formatValue(value);
  export let note = "";
  export let domainGroup: string | null = null;
  export let showMeanLines = false;
  export let dataUrl = "/data/dist/metric_year_subset.json";
  export let xMetricKey = "rates-by-race--totals--contraband-rate";
  export let yMetricKey = "rates-by-race--totals--searches-rate";
  export let xColumn: string | null = null;
  export let yColumn: string | null = null;
  export let stopsMetricKey = "rates-by-race--totals--all-stops";
  export let stopsColumn: string | null = null;

  let isLoading = true;
  let loadError = "";
  let chartLoadError: unknown = null;
  let ChartComponent: typeof import("./AgencyRateScatterChart.svelte").default | null =
    null;
  let allPoints: Array<{
    agency: string;
    year: number;
    x: number;
    y: number;
    stops?: number;
    xCount?: number;
    yCount?: number;
  }> = [];
  let yearPoints: typeof allPoints = [];
  let activePoint: (typeof allPoints)[number] | null = null;
  let sharedDomainPoints: typeof allPoints | null = null;
  let localDomain: DomainRange | null = null;
  let minCountMap: Map<number, Map<string, number>> | null = null;
  let minCountError = "";
  let excludeAboveXCounts: Map<number, number> | null = null;
  let excludeAboveXCount = 0;
  let excludeAboveXNote = "";
  let meanX: number | null = null;
  let meanY: number | null = null;
  let meanXLabel = "";
  let meanYLabel = "";
  let resolvedXLabel = "";
  let resolvedYLabel = "";
  let shownAgencyCount = 0;
  let legendMinStops: number | null = null;
  let legendMaxStops: number | null = null;
  let legendStopsDescriptor = "stops";
  let summaryNote = "";
  let combinedNote = "";
  let legendMinDotSizePx = 0;
  let legendMaxDotSizePx = 0;
  let legendMinRadiusPx = 0;
  let legendMaxRadiusPx = 0;
  const LEGEND_MIN_DOT_RADIUS_PX = 2.1;
  const LEGEND_MAX_DOT_RADIUS_PX = 12.5;

  const numberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
  const stopsFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });
  const countFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });

  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const formatValue = (value: number | null | undefined) =>
    value === null || value === undefined || Number.isNaN(value)
      ? "—"
      : numberFormatter.format(value);
  const formatStops = (value: number | null | undefined) =>
    value === null || value === undefined || Number.isNaN(value)
      ? "—"
      : stopsFormatter.format(value);
  const formatCount = (value: number | null | undefined) =>
    value === null || value === undefined || Number.isNaN(value)
      ? "—"
      : countFormatter.format(value);

  const buildDomainFromPoints = (points: typeof allPoints) => {
    if (!points.length) return null;
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    points.forEach((point) => {
      if (Number.isFinite(point.x)) {
        xMin = Math.min(xMin, point.x);
        xMax = Math.max(xMax, point.x);
      }
      if (Number.isFinite(point.y)) {
        yMin = Math.min(yMin, point.y);
        yMax = Math.max(yMax, point.y);
      }
    });
    if (!Number.isFinite(xMax) || !Number.isFinite(yMax)) return null;
    const resolvedXMin =
      xScaleType === "log"
        ? Number.isFinite(xMin) && xMin > 0
          ? xMin
          : 1
        : 0;
    const resolvedYMin =
      yScaleType === "log"
        ? Number.isFinite(yMin) && yMin > 0
          ? yMin
          : 1
        : 0;
    const resolvedXMax =
      xScaleType === "log"
        ? Number.isFinite(xMax) && xMax > 0
          ? xMax
          : 1
        : xMax;
    const resolvedYMax =
      yScaleType === "log"
        ? Number.isFinite(yMax) && yMax > 0
          ? yMax
          : 1
        : yMax;
    return {
      xMin: resolvedXMin,
      xMax: resolvedXMax,
      yMin: resolvedYMin,
      yMax: resolvedYMax,
    };
  };

  const computeMean = (points: typeof allPoints, key: "x" | "y") => {
    let total = 0;
    let count = 0;
    points.forEach((point) => {
      const value = point[key];
      if (!Number.isFinite(value)) return;
      total += value;
      count += 1;
    });
    return count ? total / count : null;
  };

  const shouldExcludeValue = (value: number) =>
    excludeExactValue !== null &&
    Number.isFinite(value) &&
    Math.abs(value - excludeExactValue) < 1e-9;

  const findAgencyValue = (yearMap: Map<string, number>, agency: string) => {
    const normalizedAgency = normalize(agency);
    if (!normalizedAgency) return null;
    for (const [name, value] of yearMap.entries()) {
      if (normalize(name) === normalizedAgency) {
        return value;
      }
    }
    return null;
  };

  const NON_WHITE_COLUMN = "Non-white";
  const buildValueMapFromRows = (
    payload: MetricYearSubset,
    rowKey: string,
    columnName = "Total"
  ) => {
    const byYear = new Map<number, Map<string, number>>();
    const rowData = payload.rows?.[rowKey];
    if (!Array.isArray(rowData)) return byYear;
    const valueIndex = payload.columns.indexOf(columnName);
    const totalIndex = payload.columns.indexOf("Total");
    const whiteIndex = payload.columns.indexOf("White");
    const useNonWhite =
      columnName === NON_WHITE_COLUMN && totalIndex !== -1 && whiteIndex !== -1;
    if (!useNonWhite && valueIndex === -1) return byYear;
    rowData.forEach((row) => {
      if (!Array.isArray(row)) return;
      const agencyIndex = Number(row[0]);
      const yearIndex = Number(row[1]);
      const agency = payload.agencies?.[agencyIndex]?.trim() ?? "";
      const year = Number(payload.years?.[yearIndex]);
      let value = NaN;
      if (useNonWhite) {
        const totalRaw = row[totalIndex];
        const whiteRaw = row[whiteIndex];
        const totalValue =
          totalRaw === null || totalRaw === undefined ? NaN : Number(totalRaw);
        const whiteValue =
          whiteRaw === null || whiteRaw === undefined ? NaN : Number(whiteRaw);
        value = totalValue - whiteValue;
      } else {
        if (row.length <= valueIndex) return;
        const rawValue = row[valueIndex];
        value = rawValue === null || rawValue === undefined ? NaN : Number(rawValue);
      }
      if (!agency || !Number.isFinite(year) || !Number.isFinite(value)) return;
      let yearMap = byYear.get(year);
      if (!yearMap) {
        yearMap = new Map();
        byYear.set(year, yearMap);
      }
      yearMap.set(agency, value);
    });
    return byYear;
  };

  const buildRateMap = (
    numeratorMap: Map<number, Map<string, number>>,
    denominatorMap: Map<number, Map<string, number>>
  ) => {
    const byYear = new Map<number, Map<string, number>>();
    numeratorMap.forEach((numeratorYearMap, year) => {
      const denominatorYearMap = denominatorMap.get(year);
      if (!denominatorYearMap) return;
      numeratorYearMap.forEach((numeratorValue, agency) => {
        const denominatorValue = denominatorYearMap.get(agency);
        if (!Number.isFinite(denominatorValue) || !denominatorValue) return;
        const value = (numeratorValue / denominatorValue) * RATE_MULTIPLIER;
        if (!Number.isFinite(value)) return;
        let yearMap = byYear.get(year);
        if (!yearMap) {
          yearMap = new Map();
          byYear.set(year, yearMap);
        }
        yearMap.set(agency, value);
      });
    });
    return byYear;
  };

  const getRateKeys = (rowKey: string) => {
    const parts = rowKey.split("--");
    if (parts.length !== 3) return null;
    const [tableId, sectionId, metricId] = parts;
    const numeratorMetricId = RATE_METRIC_MAP[metricId];
    if (!numeratorMetricId) return null;
    const totalsSectionId = sectionId === "rates" ? "totals" : sectionId;
    return {
      numeratorKey: `${tableId}--${totalsSectionId}--${numeratorMetricId}`,
      denominatorKey: `${tableId}--${totalsSectionId}--all-stops`,
    };
  };

  const buildMetricValueMap = (
    payload: MetricYearSubset,
    rowKey: string,
    columnName = "Total"
  ) => {
    if (!rowKey) return new Map<number, Map<string, number>>();
    if (payload.rows?.[rowKey]) {
      return buildValueMapFromRows(payload, rowKey, columnName);
    }
    const rateKeys = getRateKeys(rowKey);
    if (!rateKeys) return new Map<number, Map<string, number>>();
    const numeratorMap = buildValueMapFromRows(
      payload,
      rateKeys.numeratorKey,
      columnName
    );
    const denominatorMap = buildValueMapFromRows(
      payload,
      rateKeys.denominatorKey,
      columnName
    );
    if (!numeratorMap.size || !denominatorMap.size) {
      return new Map<number, Map<string, number>>();
    }
    return buildRateMap(numeratorMap, denominatorMap);
  };

  const buildPoints = (
    yMap: Map<number, Map<string, number>>,
    xMap: Map<number, Map<string, number>>,
    stopsMap?: Map<number, Map<string, number>>,
    minStopCount?: number | null,
    countMap?: Map<number, Map<string, number>>,
    minCountValue?: number | null,
    xCountMap?: Map<number, Map<string, number>>,
    yCountMap?: Map<number, Map<string, number>>,
    excludeAboveXValue?: number | null,
    excludeAboveXCountMap?: Map<number, number>
  ) => {
    const points: typeof allPoints = [];
    const excluded = new Set(excludeAgencies.map((agency) => normalize(agency)));
    const audit = [];
    yMap.forEach((yYearMap, year) => {
      const xYearMap = xMap.get(year);
      const stopsYearMap = stopsMap?.get(year);
      const countYearMap = countMap?.get(year);
      const xCountYearMap = xCountMap?.get(year);
      const yCountYearMap = yCountMap?.get(year);
      if (!xYearMap) return;
      yYearMap.forEach((yValue, agency) => {
        const xValue = xYearMap.get(agency);
        if (!Number.isFinite(xValue)) return;
        if (excluded.has(normalize(agency))) return;
        const stopValue = stopsYearMap?.get(agency);
        const countValue = countYearMap?.get(agency);
        const xCountValue = xCountYearMap?.get(agency);
        const yCountValue = yCountYearMap?.get(agency);
        if (
          minStopCount !== null &&
          minStopCount !== undefined &&
          (!Number.isFinite(stopValue) || stopValue < minStopCount)
        ) {
          return;
        }
        if (
          minCountValue !== null &&
          minCountValue !== undefined &&
          (!Number.isFinite(countValue) || countValue < minCountValue)
        ) {
          return;
        }
        if (
          excludeAboveXValue !== null &&
          excludeAboveXValue !== undefined &&
          Number.isFinite(xValue) &&
          xValue > excludeAboveXValue
        ) {
          if (excludeAboveXCountMap) {
            excludeAboveXCountMap.set(
              year,
              (excludeAboveXCountMap.get(year) ?? 0) + 1
            );
          }
          return;
        }
        if (shouldExcludeValue(xValue) || shouldExcludeValue(yValue)) {
          return;
        }
        if (sizeByStops && (!Number.isFinite(stopValue) || stopValue <= 0)) {
          return;
        }
        if (xScaleType === "log" && xValue <= 0) {
          return;
        }
        if (yScaleType === "log" && yValue <= 0) {
          return;
        }
        if (minX !== null && xValue <= minX) {
          audit.push({ agency, year, x: xValue, y: yValue });
          return;
        }
        if (minY !== null && yValue <= minY) {
          audit.push({ agency, year, x: xValue, y: yValue });
          return;
        }
        if (maxX !== null && xValue > maxX) {
          audit.push({ agency, year, x: xValue, y: yValue });
          return;
        }
        if (maxY !== null && yValue > maxY) {
          audit.push({ agency, year, x: xValue, y: yValue });
          return;
        }
        points.push({
          agency,
          year,
          x: xValue,
          y: yValue,
          stops: Number.isFinite(stopValue) ? stopValue : undefined,
          xCount: Number.isFinite(xCountValue) ? xCountValue : undefined,
          yCount: Number.isFinite(yCountValue) ? yCountValue : undefined,
        });
      });
    });
    if (audit.length) {
      console.warn(
        `[agency scatter] ${title || "scatter"} excluded ${audit.length} out-of-range values`,
        audit.slice(0, 8)
      );
    }
    return points;
  };

  const buildDomainPoints = (domain: DomainRange, year: number) => [
    {
      agency: "",
      year,
      x: domain.xMin,
      y: domain.yMin,
    },
    {
      agency: "",
      year,
      x: domain.xMax,
      y: domain.yMax,
    },
  ];

  const loadData = async () => {
    isLoading = true;
    loadError = "";
    try {
      const payload = await fetchMetricData(dataUrl);
      const xMap = buildMetricValueMap(payload, xMetricKey, xColumn ?? "Total");
      const yMap = buildMetricValueMap(payload, yMetricKey, yColumn ?? "Total");
      const needsStops = sizeByStops || minStops !== null;
      const stopsMap = needsStops
        ? buildMetricValueMap(payload, stopsMetricKey, stopsColumn ?? "Total")
        : undefined;
      const xCountMap = xCountKey
        ? buildMetricValueMap(payload, xCountKey, xCountColumn ?? "Total")
        : undefined;
      const yCountMap = yCountKey
        ? buildMetricValueMap(payload, yCountKey, yCountColumn ?? "Total")
        : undefined;
      minCountMap =
        minCount !== null
          ? buildMetricValueMap(payload, minCountKey, minCountColumn ?? "Total")
          : null;
      excludeAboveXCounts = excludeAboveX !== null ? new Map() : null;
      allPoints = buildPoints(
        yMap,
        xMap,
        stopsMap,
        minStops,
        minCountMap ?? undefined,
        minCount,
        xCountMap,
        yCountMap,
        excludeAboveX,
        excludeAboveXCounts ?? undefined
      );
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Unable to load data.";
      allPoints = [];
      minCountMap = null;
      excludeAboveXCounts = null;
    } finally {
      isLoading = false;
    }
  };

  onMount(() => {
    import("$lib/components/AgencyRateScatterChart.svelte")
      .then((module) => {
        ChartComponent = module.default;
      })
      .catch((error) => {
        chartLoadError = error;
      });
    loadData();
  });

  $: domainGroupKey =
    domainGroup && Number.isFinite(Number(selectedYear))
      ? `${domainGroup}-${Number(selectedYear)}`
      : null;
  $: {
    const year = Number(selectedYear);
    minCountError = "";
    if (minCount !== null && minCountMap && Number.isFinite(year)) {
      const yearMap = minCountMap.get(year);
      if (yearMap) {
        const value = findAgencyValue(yearMap, agencyName || "");
        if (value !== null && value < minCount) {
          minCountError = minCountMessage;
        }
      }
    }
    if (!Number.isFinite(year) || !allPoints.length) {
      yearPoints = [];
      activePoint = null;
      excludeAboveXCount = 0;
      meanX = null;
      meanY = null;
    } else {
      yearPoints = allPoints.filter((point) => point.year === year);
      const normalizedAgency = normalize(agencyName || "");
      activePoint =
        yearPoints.find((point) => normalize(point.agency) === normalizedAgency) ||
        null;
      excludeAboveXCount = excludeAboveXCounts?.get(year) ?? 0;
      meanX = showMeanLines ? computeMean(yearPoints, "x") : null;
      meanY = showMeanLines ? computeMean(yearPoints, "y") : null;
    }
    localDomain = buildDomainFromPoints(yearPoints);
  }

  $: if (domainGroupKey && localDomain) {
    const currentMap = $scatterDomainGroupStore;
    const existing = currentMap.get(domainGroupKey);
    const merged = existing
      ? {
          xMin: Math.min(existing.xMin, localDomain.xMin),
          xMax: Math.max(existing.xMax, localDomain.xMax),
          yMin: Math.min(existing.yMin, localDomain.yMin),
          yMax: Math.max(existing.yMax, localDomain.yMax),
        }
      : localDomain;
    if (
      !existing ||
      existing.xMin !== merged.xMin ||
      existing.xMax !== merged.xMax ||
      existing.yMin !== merged.yMin ||
      existing.yMax !== merged.yMax
    ) {
      scatterDomainGroupStore.update((map) => {
        map.set(domainGroupKey, merged);
        return map;
      });
    }
  }

  $: if (domainGroupKey) {
    const domain = $scatterDomainGroupStore.get(domainGroupKey) ?? localDomain;
    const year = Number(selectedYear);
    sharedDomainPoints =
      domain && Number.isFinite(year) ? buildDomainPoints(domain, year) : null;
  } else {
    sharedDomainPoints = null;
  }

  $: excludeAboveXNote =
    excludeAboveX !== null && excludeAboveXCount > 0
      ? `Removes ${formatCount(excludeAboveXCount)} ${
          excludeAboveXCount === 1 ? "department" : "departments"
        } with search rates over 50% while we investigate.`
      : "";
  $: resolvedXLabel =
    (xLabel || m?.agency_scatter_hit_rate_label?.()) ?? "Hit rate";
  $: resolvedYLabel =
    (yLabel || m?.agency_scatter_search_rate_label?.()) ?? "Search rate";
  $: meanXLabel = showMeanLines
    ? (m?.agency_scatter_mean_label?.({ label: resolvedXLabel }) ??
      `Mean ${resolvedXLabel}`)
    : "";
  $: meanYLabel = showMeanLines
    ? (m?.agency_scatter_mean_label?.({ label: resolvedYLabel }) ??
      `Mean ${resolvedYLabel}`)
    : "";
  $: shownAgencyCount = yearPoints.length;
  $: legendStopsDescriptor = (stopsLabel || "stops")
    .toLowerCase()
    .replace(/\btotal\s+/g, "")
    .trim();
  $: {
    const shownLabel = `${formatCount(shownAgencyCount)} ${
      shownAgencyCount === 1 ? "agency" : "agencies"
    } shown.`;
    if (!note) {
      summaryNote = `Showing ${formatCount(shownAgencyCount)} ${
        shownAgencyCount === 1 ? "agency" : "agencies"
      }.`;
    } else {
      const thresholdMatch = note.match(/^Requires at least\s+(.+?)\s+to display\.?$/i);
      summaryNote = thresholdMatch
        ? `Showing agencies with at least ${thresholdMatch[1]}; ${shownLabel}`
        : `${note.replace(/\.$/, "")}; ${shownLabel}`;
    }
  }
  $: legendMinDotSizePx = LEGEND_MIN_DOT_RADIUS_PX * 2 * dotRadiusScale;
  $: legendMaxDotSizePx = LEGEND_MAX_DOT_RADIUS_PX * 2 * dotRadiusScale;
  $: legendMinRadiusPx = legendMinDotSizePx / 2;
  $: legendMaxRadiusPx = legendMaxDotSizePx / 2;
  $: combinedNote = [summaryNote, excludeAboveXNote].filter(Boolean).join(" ");
  $: {
    legendMinStops = null;
    legendMaxStops = null;
    if (sizeByStops && yearPoints.length) {
      const stops = yearPoints
        .map((point) => point.stops)
        .filter((value) => Number.isFinite(value)) as number[];
      if (stops.length) {
        legendMinStops = Math.min(...stops);
        legendMaxStops = Math.max(...stops);
      }
    }
  }

</script>

<div class="rounded-lg border border-slate-200 bg-white p-3">
  <div class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
    {(title || m?.agency_scatter_heading?.()) ?? "Search rate vs contraband hit rate"}
  </div>
  {#if isLoading}
    <div class="text-xs text-slate-500">
      {m?.agency_scatter_loading?.() ?? "Loading rate comparison…"}
    </div>
  {:else if loadError}
    <div class="text-xs text-rose-600">{loadError}</div>
  {:else if minCountError}
    <div class="text-xs text-rose-600">{minCountError}</div>
  {:else if yearPoints.length === 0}
    <div class="text-xs text-slate-500">
      {m?.agency_scatter_no_data?.() ?? "No rate data available for this year."}
    </div>
  {:else if chartLoadError}
    <div class="text-xs text-slate-500">
      {m?.agency_scatter_chart_unavailable?.() ?? "Chart unavailable."}
    </div>
    {:else if ChartComponent}
      <div class="h-[280px] w-full">
        <svelte:component
          this={ChartComponent}
          points={yearPoints}
          domainPoints={sharedDomainPoints ?? undefined}
          activePoint={activePoint}
          meanX={meanX}
          meanY={meanY}
          meanXLabel={meanXLabel}
          meanYLabel={meanYLabel}
          formatValue={formatValue}
          formatStops={formatStops}
          formatCount={formatCount}
          formatXAxisTick={formatXAxisTick}
          formatYAxisTick={formatYAxisTick}
          xCountLabel={xCountLabel}
          yCountLabel={yCountLabel}
          stopsLabel={stopsLabel}
          dotRadiusScale={dotRadiusScale}
          sizeByStops={sizeByStops}
          xScaleType={xScaleType}
          yScaleType={yScaleType}
          xLabel={resolvedXLabel}
          yLabel={resolvedYLabel}
        />
      </div>
  {:else}
    <div class="text-xs text-slate-500">
      {m?.agency_scatter_chart_loading?.() ?? "Loading chart…"}
    </div>
  {/if}
  {#if combinedNote || (sizeByStops && yearPoints.length > 0)}
    <div class="mt-2.5 grid gap-y-1 gap-x-7 text-xs text-slate-500 sm:grid-cols-[minmax(0,1fr)_max-content] sm:items-start">
      <div class="max-w-[32ch]">
        {#if combinedNote}
          <div>{combinedNote}</div>
        {/if}
      </div>
      {#if sizeByStops && yearPoints.length > 0}
        <div class="justify-self-start text-[10px] text-slate-600 sm:justify-self-end">
          <div class="flex items-center gap-2 whitespace-nowrap">
            <svg
              width={legendMaxDotSizePx}
              height={legendMaxDotSizePx}
              viewBox={`0 0 ${legendMaxDotSizePx} ${legendMaxDotSizePx}`}
              class="shrink-0"
            >
              <circle
                cx={legendMaxRadiusPx}
                cy={legendMaxRadiusPx}
                r={legendMaxRadiusPx}
                fill="transparent"
                stroke="rgb(148 163 184 / 0.8)"
                stroke-width="1"
              />
              <circle
                cx={legendMaxRadiusPx}
                cy={legendMaxRadiusPx}
                r={legendMinRadiusPx}
                fill="transparent"
                stroke="rgb(148 163 184 / 0.8)"
                stroke-width="1"
              />
            </svg>
            <div>
              {formatStops(legendMaxStops)} {legendStopsDescriptor} ·{" "}
              {formatStops(legendMinStops)} {legendStopsDescriptor}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
