<svelte:head>
  <title>{data.data?.agency ?? data.slug} | {agency_title_suffix()}</title>
</svelte:head>

<script>
  import { Grid, PagingData, PlainTableCssTheme } from "@mediakular/gridcraft";
  import AgencyMap from "$lib/components/AgencyMap.svelte";
  import AgencyRateScatter from "$lib/components/AgencyRateScatter.svelte";
  import GridMetricCell from "$lib/components/grid/GridMetricCell.svelte";
  import GridTextCell from "$lib/components/grid/GridTextCell.svelte";
  import GridValueCell from "$lib/components/grid/GridValueCell.svelte";
  import MetricChartModal from "$lib/components/MetricChartModal.svelte";
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import { onMount, tick } from "svelte";
  import * as m from "$lib/paraglide/messages";
  import { getLocale } from "$lib/paraglide/runtime";
  import {
    agency_location_heading,
    agency_map_loading,
    agency_address_label,
    agency_type_label,
    agency_phone_label,
    agency_jurisdiction_label,
    agency_metric_header,
    agency_no_rows,
    agency_title_suffix,
    agency_yearly_data_heading,
    race_asian,
    race_black,
    race_hispanic,
    race_native_american,
    race_other,
    race_total,
    race_white,
  } from "$lib/paraglide/messages";

  /** @type {import('./$types').PageData} */
  export let data;

  const compareStrings = (a, b) => (a === b ? 0 : a < b ? -1 : 1);

  const numberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  });
  const stopCountFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });
  const percentFormatter = new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const formatPercentTick = (value, { isMax } = { isMax: false }) =>
    value === null || value === undefined || Number.isNaN(value)
      ? "—"
      : `${numberFormatter.format(value)}${isMax ? "%" : ""}`;

  let agencyData;
  let metadata;
  let geocodeAddressResponse;
  let geocodeJurisdictionResponse;
  let baselines = [];
  let rows = [];
  let rowsByYear = {};
  let years = [];
  let selectedYear = "";
  let selectedEntries = [];
  let metricGroups = [];
  let gridRows = [];
  let gridColumns = [];
  let gridFilters = [];
  let gridPaging = new PagingData(1, 10000, [10000]);
  let groupBy = "group_id";
  let metricSearch = "";
  let groupOrderMap = new Map();
  let autoExpandVersion = 0;
  let isSearchActive = false;
  let preSearchExpandedGroups = new Set();
  let gridTableEl;
  let agencyCount = 0;
  let locale = "en";
  let basemapStyleUrl = "/map/style.en.json";
  let metricSearchTimeout;
  let lastTrackedMetricSearch = "";
  let neighborsExpanded = false;
  const scatterExcludedAgencies = ["Missouri State Highway Patrol"];

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  const toggleNeighbors = () => {
    const next = !neighborsExpanded;
    neighborsExpanded = next;
    trackEvent(next ? "agency_neighbors_expand" : "agency_neighbors_collapse", {
      agency: agencyData?.agency ?? data.slug,
      touchingCount: touchingAgencies.length,
      containedCount: containedAgencies.length,
    });
  };

  $: agencyData = data.data;
  $: baselines = Array.isArray(data.baselines) ? data.baselines : [];
  $: agencyCount = Number(data?.agencyCount) || 0;
  $: metadata = agencyData?.agency_metadata;
  $: ({
    geocode_address_response: geocodeAddressResponse,
    geocode_jurisdiction_response: geocodeJurisdictionResponse,
  } = metadata || {});

  $: rows = Array.isArray(agencyData?.rows) ? agencyData.rows : [];
  $: rowsByYear = rows.reduce((acc, row) => {
    const year = row?.year ?? "Unknown";
    if (!acc[year]) acc[year] = [];
    acc[year].push(row);
    return acc;
  }, {});

  $: {
    try {
      locale = getLocale();
    } catch {
      locale = "en";
    }
    basemapStyleUrl = `/map/style.${locale}.json`;
  }

  $: years = Object.keys(rowsByYear).sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numB - numA;
    return compareStrings(String(a), String(b));
  });

  $: if (years.length && (!selectedYear || !years.includes(selectedYear))) {
    selectedYear = years[0];
  }

  $: selectedEntries = selectedYear ? rowsByYear[selectedYear] ?? [] : [];
  $: metricGroups = getMetricGroups(selectedEntries);
  $: {
    const priorityGroups = [
      "rates-by-race__totals",
      "rates-by-race__rates",
      "rates-by-race__population",
    ];
    groupOrderMap = new Map();
    let nextIndex = 0;
    priorityGroups.forEach((key) => {
      if (!groupOrderMap.has(key)) {
        groupOrderMap.set(key, nextIndex++);
      }
    });
    metricGroups.forEach((metric) => {
      const tableId = metric.base?.table_id ?? "";
      const sectionId = metric.base?.section_id ?? "";
      const key = `${tableId}__${sectionId}`;
      if (!groupOrderMap.has(key)) {
        groupOrderMap.set(key, nextIndex++);
      }
    });
  }
  $: gridRows = metricGroups.map((metric) => {
    const isPercentageMetric = metric.key.endsWith("-percentage");
    const columns = normalizeMetric(metric.base, { isPercentage: isPercentageMetric });
    const tableId = metric.base?.table_id ?? "";
    const sectionId = metric.base?.section_id ?? "";
    const groupLabelParts = [
      tableLabelForId(tableId),
      sectionLabelForId(sectionId),
    ].filter(Boolean);
    const groupLabel = groupLabelParts.length ? groupLabelParts.join(": ") : "—";
    const groupId = `${tableId}__${sectionId}`;
    const row = {
      id: metric.base?.row_id ?? metric.key,
      metricKey: metric.key,
      group_label: groupLabel,
      group_id: groupId,
      metric: metricLabelForKey(metric.key, metric.base?.metric_id),
    };

    columnKeys.forEach((label) => {
      const rankValue = getMetricValue(metric.rank, label);
      let rankDisplay = "";
      if (hasSupplementValue(rankValue)) {
        const numeric = typeof rankValue === "string" ? Number(rankValue) : rankValue;
        const rankFormatted = Number.isFinite(numeric)
          ? stopCountFormatter.format(Math.round(numeric))
          : formatValue(rankValue);
        if (rankFormatted && rankFormatted !== "—") {
          if (agencyCount > 0) {
            rankDisplay = `#${rankFormatted}/${stopCountFormatter.format(agencyCount)}`;
          } else {
            rankDisplay = `#${rankFormatted}`;
          }
        }
      }
      row[label] = {
        value: columns[label],
        rank: rankDisplay,
      };
    });

    return row;
  });

  $: gridColumns = [
    {
      key: "group_id",
      title: sectionLabel(),
      width: 180,
      sortable: false,
      accessor: (row) => ({
        value: row.group_label,
        id: row.group_id,
      }),
      sortValue: (row) => groupOrderMap.get(row.group_id) ?? Number.MAX_SAFE_INTEGER,
      renderComponent: GridTextCell,
    },
    {
      key: "metric",
      title: agency_metric_header(),
      width: 100,
      sortable: false,
      accessor: (row) => ({
        value: row.metric,
        metricKey: row.metricKey,
        onOpen: handleMetricOpen,
      }),
      renderComponent: GridMetricCell,
    },
    ...columnKeys.map((label) => ({
      key: label,
      title: raceLabel(label),
      width: 96,
      sortable: false,
      accessor: (row) => ({
        ...row[label],
        metricKey: row.metricKey,
        onOpen: handleMetricOpen,
      }),
      renderComponent: GridValueCell,
    })),
  ];
  $: {
    const pageSize = Math.max(gridRows.length, 10000);
    gridPaging.itemsPerPage = pageSize;
    gridPaging.itemsPerPageOptions = [pageSize];
    gridPaging.currentPage = 1;
  }

  const expandDefaultGroups = () => setAllGroupsExpanded(true);

  const setAllGroupsExpanded = async (expand) => {
    if (typeof document === "undefined") return;
    await tick();
    const groupRows = Array.from(document.querySelectorAll(".gridcraft-table .gc-tr__groupby"));
    groupRows.forEach((row) => {
      const toggle = row.querySelector("button");
      if (!toggle) return;
      const isCollapsed = row.querySelector(".feather-chevron-right");
      const isExpanded = row.querySelector(".feather-chevron-down");
      if (expand && isCollapsed) {
        toggle.click();
      } else if (!expand && isExpanded) {
        toggle.click();
      }
    });
  };

  const getGroupRows = () =>
    Array.from(document.querySelectorAll(".gridcraft-table [data-group-id]")).map((label) => {
      const groupId = label.getAttribute("data-group-id") || "";
      const row = label.closest("tr");
      return { groupId, row };
    });

  const getExpandedGroupIds = () => {
    if (typeof document === "undefined") return new Set();
    const expanded = new Set();
    getGroupRows().forEach(({ groupId, row }) => {
      if (!groupId || !row) return;
      if (row.querySelector(".feather-chevron-down")) {
        expanded.add(groupId);
      }
    });
    return expanded;
  };

  const restoreGroupExpansion = async (desiredExpanded) => {
    if (typeof document === "undefined") return;
    await tick();
    getGroupRows().forEach(({ groupId, row }) => {
      if (!groupId || !row) return;
      const toggle = row.querySelector("button");
      if (!toggle) return;
      const isCollapsed = row.querySelector(".feather-chevron-right");
      const isExpanded = row.querySelector(".feather-chevron-down");
      if (desiredExpanded.has(groupId) && isCollapsed) {
        toggle.click();
      } else if (!desiredExpanded.has(groupId) && isExpanded) {
        toggle.click();
      }
    });
  };

  const expandAllGroups = () => setAllGroupsExpanded(true);
  const collapseAllGroups = () => setAllGroupsExpanded(false);

  $: {
    const trimmed = metricSearch.trim().toLowerCase();
    if (!trimmed) {
      gridFilters = [];
    } else {
      gridFilters = [
        {
          key: "metric-search",
          columns: ["metric"],
          filter: (columnValue) => {
            if (columnValue === null || columnValue === undefined) return false;
            const value =
              typeof columnValue === "object" && columnValue !== null
                ? columnValue.value
                : columnValue;
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(trimmed);
          },
          active: true,
        },
      ];
    }
  }

  const formatValue = (value, { isPercentage = false } = {}) => {
    if (value === null || value === undefined) return "—";
    const formatNumeric = (numeric) =>
      isPercentage ? percentFormatter.format(numeric) : numberFormatter.format(numeric);
    if (typeof value === "number" && Number.isFinite(value)) {
      return formatNumeric(value);
    }
    if (typeof value === "string") {
      const numeric = Number(value);
      if (value.trim() !== "" && Number.isFinite(numeric)) {
        return formatNumeric(numeric);
      }
      return value;
    }
    if (typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  };

  const cleanMetadataValue = (value) => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value).trim();
    if (!stringValue || stringValue.toLowerCase() === "nan") return "";
    return stringValue;
  };

  let agencyType = "";
  let addressLine = "";
  let addressCityLine = "";
  let addressDisplay = [];
  let mapHref = "";
  let rawPhone = "";
  let phoneHref = "";
  let jurisdictionDisplay = "";
  let jurisdictionCountyDisplay = "";
  let showJurisdiction = false;
  let showJurisdictionCounty = false;
  let touchingAgencies = [];
  let containedAgencies = [];
  let boundaryData = null;
  let addressState = "";
  let stopVolumeLead = "";
  let stopVolumeSegmentLabel = "";
  let stopVolumeSegmentPrefix = "";
  let stopVolumeSegmentSuffix = "";
  let stopVolumeRankClause = "";
  const formatPhone = (value) => {
    const digits = value.replace(/\D+/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return value;
  };
  $: agencyType = cleanMetadataValue(metadata?.AgencyType);
  $: boundaryData = data?.boundary ?? null;
  $: {
    const typeKey = agencyType.toLowerCase();
    const cityValue =
      cleanMetadataValue(metadata?.AddressCity) ||
      cleanMetadataValue(metadata?.geocode_jurisdiction_response?.results?.[0]?.address_components?.city) ||
      cleanMetadataValue(metadata?.geocode_address_response?.results?.[0]?.address_components?.city);
    const countyValue =
      cleanMetadataValue(metadata?.geocode_jurisdiction_county) ||
      cleanMetadataValue(metadata?.geocode_address_county) ||
      cleanMetadataValue(metadata?.County);
    const stateValue =
      cleanMetadataValue(metadata?.geocode_jurisdiction_response?.results?.[0]?.address_components?.state) ||
      cleanMetadataValue(metadata?.geocode_address_response?.results?.[0]?.address_components?.state) ||
      cleanMetadataValue(metadata?.geocode_address_response?.input?.address_components?.state);
    addressState = stateValue;
    const isRail = typeKey.includes("rail");
    const isAirport = typeKey.includes("airport");
    const isMunicipal = typeKey.includes("municipal");
    const isCounty = typeKey.includes("county");
    const isStateAgency = typeKey.includes("state");
    const supportsCounty = !isStateAgency;

    if (isRail) {
      jurisdictionDisplay = "";
      showJurisdiction = false;
    } else if (isAirport) {
      jurisdictionDisplay = "airport";
      showJurisdiction = true;
    } else if (isMunicipal) {
      jurisdictionDisplay = cityValue || countyValue || stateValue;
      showJurisdiction = Boolean(jurisdictionDisplay);
    } else if (isCounty) {
      jurisdictionDisplay = countyValue || cityValue || stateValue;
      showJurisdiction = Boolean(jurisdictionDisplay);
    } else if (isStateAgency) {
      jurisdictionDisplay = stateValue || "state";
      showJurisdiction = Boolean(jurisdictionDisplay);
    } else {
      jurisdictionDisplay = countyValue || cityValue || stateValue;
      showJurisdiction = Boolean(jurisdictionDisplay);
    }
    jurisdictionCountyDisplay = countyValue;
    showJurisdictionCounty = supportsCounty;
  }
  $: {
    const line1 = cleanMetadataValue(metadata?.AddressLine1);
    const line2 = cleanMetadataValue(metadata?.AddressLine2);
    const city = cleanMetadataValue(metadata?.AddressCity);
    const zip = cleanMetadataValue(metadata?.AddressZip);
    addressLine = [line1, line2].filter(Boolean).join(" ");
    const cityState = [city, addressState].filter(Boolean).join(", ");
    addressCityLine = [cityState, zip].filter(Boolean).join(" ");
    addressDisplay = [addressLine, addressCityLine].filter(Boolean);
    const addressQuery =
      cleanMetadataValue(metadata?.geocode_address_query) ||
      [addressLine, cityState, zip].filter(Boolean).join(", ");
    mapHref = addressQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`
      : "";
  }
  $: rawPhone = cleanMetadataValue(metadata?.AgencyPhone);
  $: {
    const phoneDigits = rawPhone.replace(/\D+/g, "");
    phoneHref = phoneDigits ? `tel:${phoneDigits}` : "";
  }

  const normalizeAgencies = (entries) => {
    if (!Array.isArray(entries) || !entries.length) return [];
    const seen = new Set();
    return entries
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const slug = entry.agency_slug || entry.slug || entry.id;
        if (!slug || seen.has(slug)) return null;
        seen.add(slug);
        return {
          slug,
          label: entry.agency_name || entry.name || entry.agency || slug,
        };
      })
      .filter(Boolean);
  };

  $: touchingAgencies = (() => {
    const props = boundaryData?.features?.[0]?.properties ?? {};
    return normalizeAgencies(props.touching_agencies);
  })();

  $: containedAgencies = (() => {
    const props = boundaryData?.features?.[0]?.properties ?? {};
    return normalizeAgencies(props.contained_agencies);
  })();
  $: phoneDisplay = rawPhone ? formatPhone(rawPhone) : "";

  $: {
    const latestYear = years.find((year) => Number.isFinite(Number(year)));
    stopVolumeLead = "";
    stopVolumeSegmentLabel = "";
    stopVolumeSegmentPrefix = "";
    stopVolumeSegmentSuffix = "";
    stopVolumeRankClause = "";
    if (!latestYear) {
      stopVolumeLead = "";
    } else {
      const yearValue = Number(latestYear);
      const totalEntry = rows.find(
        (row) =>
          Number(row?.year) === yearValue &&
          row?.row_key === "rates-by-race--totals--all-stops"
      );
      const percentileEntry =
        rows.find(
          (row) =>
            Number(row?.year) === yearValue &&
            row?.row_key === "rates-by-race--totals--all-stops-percentile"
        ) ||
        rows.find(
          (row) =>
            Number(row?.year) === yearValue &&
            row?.row_key === "rates-by-race--totals--all-stops-percentile-no-mshp"
        );
      const rankEntry =
        rows.find(
          (row) =>
            Number(row?.year) === yearValue &&
            row?.row_key === "rates-by-race--totals--all-stops-rank"
        ) ||
        rows.find(
          (row) =>
            Number(row?.year) === yearValue &&
            row?.row_key === "rates-by-race--totals--all-stops-rank-no-mshp"
        );
      const totalValue = getMetricValue(totalEntry, "Total");
      const totalNumeric = typeof totalValue === "string" ? Number(totalValue) : totalValue;
      if (!Number.isFinite(totalNumeric)) {
        stopVolumeLead = "";
      } else {
        const agencyName = agencyData?.agency ?? data.slug;
        const totalStops = stopCountFormatter.format(totalNumeric);
        const leadFn = m?.agency_stop_volume_lead;
        const leadRaw =
          typeof leadFn === "function"
            ? leadFn({ agency: agencyName, stops: totalStops, year: latestYear })
            : `${agencyName} had ${totalStops} stops in ${latestYear}`;
        const lead = leadRaw.replace(/[.!?]+$/, "").trim();
        stopVolumeLead = lead;

        const percentileValue = getMetricValue(percentileEntry, "Total");
        const percentileNumeric =
          typeof percentileValue === "string" ? Number(percentileValue) : percentileValue;
        let segmentSentence = "";
        let segmentLabel = "";
        if (Number.isFinite(percentileNumeric)) {
          const topThreshold = 80;
          const bottomThreshold = 20;
          let segmentKey = "middle";
          if (percentileNumeric >= topThreshold) segmentKey = "top";
          else if (percentileNumeric <= bottomThreshold) segmentKey = "bottom";
          segmentLabel =
            segmentKey === "top"
              ? typeof m?.agency_stop_volume_segment_top === "function"
                ? m.agency_stop_volume_segment_top()
                : "top 20%"
              : segmentKey === "bottom"
              ? typeof m?.agency_stop_volume_segment_bottom === "function"
                ? m.agency_stop_volume_segment_bottom()
                : "bottom 20%"
              : typeof m?.agency_stop_volume_segment_middle === "function"
              ? m.agency_stop_volume_segment_middle()
              : "middle 60%";
          const segmentFn = m?.agency_stop_volume_segment_sentence;
          segmentSentence =
            typeof segmentFn === "function"
              ? segmentFn({ segment: segmentLabel })
              : `putting it in the ${segmentLabel} of departments by stop volume`;
        }
        segmentSentence = segmentSentence.replace(/[.!?]+$/, "").trim();
        const rankValue = getMetricValue(rankEntry, "Total");
        const rankNumeric = typeof rankValue === "string" ? Number(rankValue) : rankValue;
        let rankClause = "";
        if (Number.isFinite(rankNumeric)) {
          const rankRounded = Math.round(rankNumeric);
          if (rankRounded === 1) {
            const rankHighestFn = m?.agency_stop_volume_rank_clause_highest;
            rankClause =
              typeof rankHighestFn === "function"
                ? rankHighestFn()
                : "the highest volume agency in the state";
          } else {
            const rankDisplay = stopCountFormatter.format(rankRounded);
            const agencyCount = Number(data?.agencyCount);
            const totalDisplay =
              Number.isFinite(agencyCount) && agencyCount > 0
                ? stopCountFormatter.format(agencyCount)
                : "";
            const rankFn = m?.agency_stop_volume_rank_clause;
            const rankSimpleFn = m?.agency_stop_volume_rank_clause_simple;
            if (totalDisplay) {
              rankClause =
                typeof rankFn === "function"
                  ? rankFn({ rank: rankDisplay, total: totalDisplay })
                  : `ranked #${rankDisplay} out of ${totalDisplay} departments`;
            } else {
              rankClause =
                typeof rankSimpleFn === "function"
                  ? rankSimpleFn({ rank: rankDisplay })
                  : `ranked #${rankDisplay}`;
            }
          }
        }
        rankClause = rankClause.replace(/[.!?]+$/, "").trim();

        if (segmentSentence && segmentLabel) {
          const segmentIndex = segmentSentence.indexOf(segmentLabel);
          if (segmentIndex >= 0) {
            stopVolumeSegmentPrefix = segmentSentence.slice(0, segmentIndex).trim();
            stopVolumeSegmentLabel = segmentLabel;
            stopVolumeSegmentSuffix = segmentSentence
              .slice(segmentIndex + segmentLabel.length)
              .trim();
          } else {
            stopVolumeSegmentPrefix = segmentSentence.trim();
            stopVolumeSegmentLabel = "";
            stopVolumeSegmentSuffix = "";
          }
        }
        stopVolumeRankClause = rankClause;
      }
    }
  }

  const columnKeys = [
    "Total",
    "White",
    "Black",
    "Hispanic",
    "Native American",
    "Asian",
    "Other",
  ];
  const chartRaceKeys = columnKeys.filter((label) => label !== "Total");
  const priorityPrefix = "rates--totals-";

  const translationKeyForId = (prefix, id) =>
    `${prefix}_${id}`
      .replace(/[^a-z0-9]/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase();

  const titleToken = (token) => {
    const lower = token.toLowerCase();
    if (lower === "acs") return "ACS";
    if (lower === "bac") return "BAC";
    if (lower === "dwi") return "DWI";
    if (lower === "hwy") return "Hwy";
    if (lower === "pct") return "Pct";
    if (lower === "us") return "US";
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  };

  const humanizeId = (id) => {
    if (!id) return "—";
    const rawTokens = String(id).split("-").filter(Boolean);
    const tokens = [];

    for (let i = 0; i < rawTokens.length; i += 1) {
      const token = rawTokens[i];
      const nextToken = rawTokens[i + 1];
      if (/^\d+$/.test(token) && /^\d+$/.test(nextToken)) {
        tokens.push(`${token}-${nextToken}`);
        i += 1;
        continue;
      }
      tokens.push(titleToken(token));
    }

    return tokens.join(" ");
  };

  const labelForId = (prefix, id) => {
    if (!id) return "";
    const key = translationKeyForId(prefix, id);
    const labelFn = m?.[key];
    return labelFn ? labelFn() : humanizeId(id);
  };

  const metricLabelForKey = (rowKey, metricId) => {
    const id = metricId || rowKey?.split("--").pop() || rowKey;
    return labelForId("metric", id) || humanizeId(id);
  };

  const tableLabelForId = (id) => labelForId("table", id);
  const sectionLabelForId = (id) => labelForId("section", id);

  const sectionLabel = () =>
    typeof m.agency_section_label === "function" ? m.agency_section_label() : "Section";
  const tableLabel = () =>
    typeof m.agency_table_label === "function" ? m.agency_table_label() : "Table";

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
      case "Native American":
        return race_native_american();
      case "Asian":
        return race_asian();
      case "Other":
        return race_other();
      default:
        return key;
    }
  };

  const metricSuffixes = [
    { suffix: "-percentage", type: "percentage", priority: 0 },
    { suffix: "-rank", type: "rank", priority: 0 },
    { suffix: "-rank-no-mshp", type: "rank", priority: 1 },
    { suffix: "-percentile", type: "percentile", priority: 0 },
    { suffix: "-percentile-no-mshp", type: "percentile", priority: 1 },
  ];

  const getMetricGroups = (entries) => {
    const groups = {};

    (entries || []).forEach((entry) => {
      const key = entry?.row_key;
      if (!key) return;
      let baseKey = key;
      let type = "base";
      let priority = 0;

      for (const suffix of metricSuffixes) {
        if (key.endsWith(suffix.suffix)) {
          baseKey = key.slice(0, -suffix.suffix.length);
          type = suffix.type;
          priority = suffix.priority;
          break;
        }
      }

      if (!groups[baseKey]) {
        groups[baseKey] = {
          key: baseKey,
          base: undefined,
          percentage: undefined,
          rank: undefined,
          percentile: undefined,
          percentagePriority: Infinity,
          rankPriority: Infinity,
          percentilePriority: Infinity,
        };
      }

      const group = groups[baseKey];

      if (type === "base") {
        group.base = entry;
      } else if (type === "percentage") {
        if (priority < group.percentagePriority) {
          group.percentage = entry;
          group.percentagePriority = priority;
        }
      } else if (type === "rank") {
        if (priority < group.rankPriority) {
          group.rank = entry;
          group.rankPriority = priority;
        }
      } else if (type === "percentile") {
        if (priority < group.percentilePriority) {
          group.percentile = entry;
          group.percentilePriority = priority;
        }
      }
    });

    return Object.values(groups)
      .filter((group) => group.base !== undefined)
      .sort((a, b) => {
        const aPriority = a.key.startsWith(priorityPrefix) ? 0 : 1;
        const bPriority = b.key.startsWith(priorityPrefix) ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return compareStrings(a.key, b.key);
      });
  };

  const normalizeMetric = (value, { isPercentage = false } = {}) => {
    const base = {
      Total: "—",
      White: "—",
      Black: "—",
      Hispanic: "—",
      "Native American": "—",
      Asian: "—",
      Other: "—",
    };

    if (value === null || value === undefined) {
      return base;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
      return { ...base, Total: formatValue(value, { isPercentage }) };
    }

    const record = value;
    return {
      Total: formatValue(record.Total ?? record.total, { isPercentage }),
      White: formatValue(record.White ?? record.white, { isPercentage }),
      Black: formatValue(record.Black ?? record.black, { isPercentage }),
      Hispanic: formatValue(record.Hispanic ?? record.hispanic, { isPercentage }),
      "Native American": formatValue(
        record["Native American"] ?? record.native_american ?? record["native american"],
        { isPercentage }
      ),
      Asian: formatValue(record.Asian ?? record.asian, { isPercentage }),
      Other: formatValue(record.Other ?? record.other, { isPercentage }),
    };
  };

  const hasSupplementValue = (value) =>
    value !== null && value !== undefined && value !== "—" && value !== "";

  const getMetricValue = (entry, label) => {
    if (entry === null || entry === undefined) return null;
    if (typeof entry !== "object" || Array.isArray(entry)) return entry;
    if (label === "Native American") {
      return entry["Native American"] ?? entry.native_american ?? entry["native american"];
    }
    const lower = label.toLowerCase();
    return entry[label] ?? entry[lower];
  };

  let activeMetricKey = "";
  let activeMetricLabel = "";

  const hasMetricKey = (metricKey) => rows.some((row) => row?.row_key === metricKey);

  const setHash = (metricKey) => {
    if (typeof window === "undefined") return;
    if (!metricKey) return;
    const encoded = encodeURIComponent(metricKey);
    if (window.location.hash === `#${encoded}`) return;
    window.location.hash = encoded;
  };

  const clearHash = () => {
    if (typeof window === "undefined") return;
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", `${pathname}${search}`);
  };

  const openMetric = (metricKey, { updateHash = true } = {}) => {
    if (!metricKey) return;
    activeMetricKey = metricKey;
    activeMetricLabel = metricLabelForKey(metricKey);
    if (updateHash) {
      setHash(metricKey);
    }
  };

  const closeMetric = ({ updateHash = true } = {}) => {
    activeMetricKey = "";
    activeMetricLabel = "";
    if (updateHash) {
      clearHash();
    }
  };

  const selectYear = (year, source = "unknown") => {
    selectedYear = year;
    trackEvent("agency_year_select", {
      year,
      source,
      agency: agencyData?.agency ?? data.slug,
    });
  };

  const handleMetricOpen = (metricKey) => {
    if (!metricKey) return;
    flushMetricSearch();
    trackEvent("metric_open", {
      metricKey,
      label: metricLabelForKey(metricKey),
      year: selectedYear,
      agency: agencyData?.agency ?? data.slug,
    });
    openMetric(metricKey);
  };

  const scheduleMetricSearch = (value) => {
    const term = value.trim();
    if (!term) {
      lastTrackedMetricSearch = "";
      if (metricSearchTimeout) clearTimeout(metricSearchTimeout);
      return;
    }
    if (term === lastTrackedMetricSearch) return;
    if (metricSearchTimeout) clearTimeout(metricSearchTimeout);
    metricSearchTimeout = setTimeout(() => {
      if (term !== metricSearch.trim()) return;
      lastTrackedMetricSearch = term;
      trackEvent("metric_search", {
        term,
        year: selectedYear,
        agency: agencyData?.agency ?? data.slug,
      });
    }, 1000);
  };

  const flushMetricSearch = () => {
    const term = metricSearch.trim();
    if (!term || term === lastTrackedMetricSearch) return;
    if (metricSearchTimeout) clearTimeout(metricSearchTimeout);
    lastTrackedMetricSearch = term;
    trackEvent("metric_search", {
      term,
      year: selectedYear,
      agency: agencyData?.agency ?? data.slug,
    });
  };


  const getHashMetric = () => {
    if (typeof window === "undefined") return "";
    const raw = window.location.hash.replace(/^#/, "");
    return raw ? decodeURIComponent(raw) : "";
  };

  const syncFromHash = () => {
    const metricKey = getHashMetric();
    if (metricKey && hasMetricKey(metricKey)) {
      openMetric(metricKey, { updateHash: false });
    } else if (!metricKey && activeMetricKey) {
      closeMetric({ updateHash: false });
    }
  };

  onMount(() => {
    syncFromHash();
    const handleHashChange = () => syncFromHash();
    window.addEventListener("hashchange", handleHashChange);
    expandDefaultGroups();
    const handleGroupRowClick = (event) => {
      if (!gridTableEl) return;
      if (!(event.target instanceof HTMLElement)) return;
      const row = event.target.closest(".gc-tr__groupby");
      if (!row) return;
      if (event.target.closest("button, a, input, select, textarea, [role='button']")) {
        return;
      }
      const toggle = row.querySelector("button");
      if (toggle) {
        toggle.click();
      }
    };
    if (gridTableEl) {
      gridTableEl.addEventListener("click", handleGroupRowClick);
    }
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      if (gridTableEl) {
        gridTableEl.removeEventListener("click", handleGroupRowClick);
      }
    };
  });

  $: if (typeof window !== "undefined" && rows.length) {
    syncFromHash();
  }

  $: if (gridRows.length) {
    autoExpandVersion += 1;
    const version = autoExpandVersion;
    tick().then(() => {
      if (version !== autoExpandVersion) return;
      expandDefaultGroups();
    });
  }

  $: {
    const trimmed = metricSearch.trim();
    if (trimmed && !isSearchActive) {
      isSearchActive = true;
      preSearchExpandedGroups = getExpandedGroupIds();
      expandAllGroups();
    } else if (!trimmed && isSearchActive) {
      isSearchActive = false;
      restoreGroupExpansion(preSearchExpandedGroups);
    }
  }
</script>

<StickyHeader agencies={data.agencies} />

<main class="mx-auto w-full max-w-5xl px-4 pb-16 pt-12 sm:px-6">
  <header class="mb-10">
    <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
      {agencyData?.agency ?? data.slug}
    </h1>
  </header>

  <section class="mb-10 grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start">
    <div class="rounded-2xl border border-slate-200 bg-white p-3">
      {#if stopVolumeLead}
        <p class="mb-4 text-xl font-normal text-slate-800 leading-snug">
          {stopVolumeLead}
          {#if stopVolumeSegmentLabel}
            {" "}
            {stopVolumeSegmentPrefix}
            {" "}
            <strong class="font-semibold text-slate-900">{stopVolumeSegmentLabel}</strong>
            {#if stopVolumeSegmentSuffix}
              {" "}
              {stopVolumeSegmentSuffix}
            {/if}
          {/if}
          {#if stopVolumeRankClause}
            {" "}
            ({stopVolumeRankClause})
          {/if}
          .
        </p>
      {/if}
      <dl class="divide-y divide-slate-100">
        {#if showJurisdiction}
          <div class="grid gap-1 py-1.5 grid-cols-[110px_1fr] items-start">
            <dt class="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {agency_jurisdiction_label()}
            </dt>
            <dd class="text-sm font-medium text-slate-700">
              {jurisdictionDisplay}
            </dd>
          </div>
        {/if}
        {#if showJurisdictionCounty}
          <div class="grid gap-1 py-1.5 grid-cols-[110px_1fr] items-start">
            <dt class="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {m?.agency_county_label?.() ?? "County"}
            </dt>
            <dd class="text-sm font-medium text-slate-700">
              {jurisdictionCountyDisplay || "—"}
            </dd>
          </div>
        {/if}
        <div class="grid gap-1 py-1.5 grid-cols-[110px_1fr] items-start">
          <dt class="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            {agency_type_label()}
          </dt>
          <dd class="text-sm font-medium text-slate-700">
            {agencyType || "—"}
          </dd>
        </div>
        <div class="grid gap-1 py-1.5 grid-cols-[110px_1fr] items-start">
          <dt class="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            {agency_address_label()}
          </dt>
          <dd class="text-sm font-medium text-slate-700">
            {#if addressDisplay.length}
              {#if mapHref}
                <a
                  class="block"
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {#each addressDisplay as line}
                    <span class="block">{line}</span>
                  {/each}
                </a>
              {:else}
                {#each addressDisplay as line}
                  <span class="block">{line}</span>
                {/each}
              {/if}
            {:else}
              —
            {/if}
          </dd>
        </div>
        <div class="grid gap-1 py-1.5 grid-cols-[110px_1fr] items-start">
          <dt class="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            {agency_phone_label()}
          </dt>
          <dd class="text-sm font-medium text-slate-700">
            {#if phoneDisplay}
              {#if phoneHref}
                <a href={phoneHref}>
                  {phoneDisplay}
                </a>
              {:else}
                {phoneDisplay}
              {/if}
            {:else}
              —
            {/if}
          </dd>
        </div>
      </dl>
      <div class="mt-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <a
            class="inline-flex items-center gap-1 underline"
            href={`/data/dist/agency_year/${data.slug}.json`}
            download
          >
            <span aria-hidden="true">↓</span>
            {m?.agency_download_data_for?.({ agency: agencyData?.agency ?? data.slug }) ??
              `Download data for ${agencyData?.agency ?? data.slug}`}
          </a>
          <a
            class="inline-flex items-center gap-1 underline"
            href="/data/downloads/all_combined_output.parquet"
          >
            <span aria-hidden="true">↓</span>
            {m?.agency_download_all_data?.() ?? "Download all data"}
          </a>
        </div>
      </div>
    </div>
    <AgencyMap
      heading={agency_location_heading()}
      loadingLabel={agency_map_loading()}
      addressResponse={geocodeAddressResponse}
      fallbackResponse={geocodeJurisdictionResponse}
      showHeading={false}
      className="mb-0"
      heightClass="h-[280px] md:h-[380px]"
      agencyId={agencyData?.agency_metadata?.agency_id ??
        agencyData?.agency_metadata?.agency_slug ??
        data.slug}
      basemapPmtilesUrl="https://pmtiles.grupovisual.org/latest.pmtiles"
      basemapStyleUrl={basemapStyleUrl}
      pmtilesUrl="/data/tiles/mo_jurisdictions_2024_500k.pmtiles"
      boundaryDataOverride={boundaryData}
    />
  </section>

  {#if touchingAgencies.length || containedAgencies.length}
    <section class="mb-10">
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          class="flex w-full items-center gap-4 text-left"
          aria-expanded={neighborsExpanded}
          aria-controls="neighbors-panel"
          on:click={toggleNeighbors}
        >
          <span
            class={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition ${
              neighborsExpanded ? "rotate-180 bg-slate-100" : "bg-white"
            }`}
          >
            <svg
              aria-hidden="true"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 8l4 4 4-4" />
            </svg>
            <span class="sr-only">
              {neighborsExpanded ? "Hide" : "Show"}
            </span>
          </span>
          <div>
            <h2 class="text-lg font-semibold text-slate-900 sm:text-xl">
              {m?.agency_neighbors_heading?.() ?? "Nearby agencies"}
            </h2>
            <p class="mt-1 text-xs text-slate-500">
              {touchingAgencies.length} touching • {containedAgencies.length} contained
            </p>
          </div>
        </button>
        {#if neighborsExpanded}
          <div
            id="neighbors-panel"
            class="mt-4 space-y-4 border-t border-slate-100 pt-4"
          >
            {#if touchingAgencies.length}
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {m?.agency_neighbors_touching_label?.() ?? "Touching agencies"}
                </h3>
                <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                  {#each touchingAgencies as neighbor}
                    <a class="underline" href={`/agency/${neighbor.slug}`}>
                      {neighbor.label}
                    </a>
                  {/each}
                </div>
              </div>
            {/if}
            {#if containedAgencies.length}
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {m?.agency_neighbors_contained_label?.() ?? "Contained agencies"}
                </h3>
                <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                  {#each containedAgencies as neighbor}
                    <a class="underline" href={`/agency/${neighbor.slug}`}>
                      {neighbor.label}
                    </a>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </section>
  {/if}


  <section class="mb-10">
    {#if years.length === 0}
      <p class="text-sm text-slate-500">{agency_no_rows()}</p>
    {:else}
      <article class="relative mb-8">
        {#if metricGroups.length === 0}
          <p class="mt-4 text-sm text-slate-500">{agency_no_rows()}</p>
        {:else}
          <div class="mb-6 max-w-full overflow-visible rounded-xl border border-slate-200 bg-white md:mx-[calc(50%-50vw+2rem)] md:w-[calc(100vw-4rem)] md:max-w-none">
            <div class="border-b border-slate-200 bg-slate-50 px-3 py-4 sm:px-4">
              <div class="text-lg font-semibold text-slate-900 sm:text-xl">
                {m?.agency_annual_stops_heading?.() ?? "Annual statistics"}: {agencyData?.agency ?? data.slug}
              </div>
              <div
                role="tablist"
                aria-label={agency_yearly_data_heading()}
                class="mt-3 flex flex-wrap items-center gap-2"
              >
                {#each years as year}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={year === selectedYear}
                    class={`rounded-md border px-3 py-1.5 text-sm font-semibold tracking-wide transition sm:text-base ${
                      year === selectedYear
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                    on:click={() => selectYear(year, "top")}
                  >
                    {year}
                  </button>
                {/each}
              </div>
            </div>
            <div class="border-b border-slate-200 px-3 py-3 sm:px-4">
              <input
                type="search"
                class="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:w-64"
                placeholder={m?.agency_metric_search_placeholder?.() ?? "Search metrics"}
                aria-label={m?.agency_metric_search_label?.() ?? "Search metrics"}
                bind:value={metricSearch}
                on:input={(event) => scheduleMetricSearch(event.currentTarget.value)}
                on:blur={flushMetricSearch}
              />
            </div>
            <div
              class="gridcraft-table"
              bind:this={gridTableEl}
              style="
                --gc-main-color: #ffffff;
                --gc-secondary-color: #f8fafc;
                --gc-tertiary-color: #ffffff;
                --gc-text-color: #0f172a;
                --gc-th-font-size: 0.65rem;
                --gc-th-padding: 0.4rem 0.6rem;
                --gc-th-text-transform: uppercase;
                --gc-td-padding: 0.3rem 0.45rem;
                --gc-table-radius: 0px;
                --gc-tr-groupby-bg-color: #cbd5e1;
                --gc-tr-groupby-border: 0px solid transparent;
                --gc-td-groupby-content-font-size: 0.72rem;
                --gc-td-groupby-content-font-weight: 700;
                --gc-td-groupby-content-color: #0f172a;
                --gc-td-groupby-padding: 0px;
                --gc-groupby-sticky-width: 180px;
              "
            >
              <Grid
                data={gridRows}
                columns={gridColumns}
                filters={gridFilters}
                groupBy={groupBy}
                groupsExpandedDefault={true}
                paging={gridPaging}
                theme={PlainTableCssTheme}
              />
            </div>
            <div class="border-t border-slate-200 bg-slate-50">
              <div class="flex flex-col gap-3 px-3 py-4 sm:px-4">
                <div
                  role="tablist"
                  aria-label={agency_yearly_data_heading()}
                  class="flex flex-wrap items-center gap-2"
                >
                  {#each years as year}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={year === selectedYear}
                      class={`rounded-md border px-3 py-1.5 text-sm font-semibold tracking-wide transition sm:text-base ${
                        year === selectedYear
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`}
                      on:click={() => selectYear(year, "bottom")}
                    >
                      {year}
                    </button>
                  {/each}
                </div>
                <div class="space-y-4">
                  <div class="grid gap-7 lg:gap-8 lg:grid-cols-3">
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title="Total stops vs citations"
                      domainGroup="stops-citations"
                      showMeanLines={true}
                      xLabel={m?.agency_scatter_total_stops_label?.() ?? "Total stops"}
                      yLabel={m?.agency_scatter_citations_label?.() ?? "Citations"}
                      xMetricKey="rates-by-race--totals--all-stops"
                      yMetricKey="rates-by-race--totals--citations"
                      excludeAgencies={scatterExcludedAgencies}
                      minStops={500}
                      sizeByStops={true}
                      stopsLabel={m?.agency_scatter_total_stops_label?.() ?? "Total stops"}
                      minCount={50}
                      minCountKey="rates-by-race--totals--citations"
                      minCountMessage={
                        m?.agency_scatter_min_citations_note?.() ??
                          "Requires at least 50 citations to display."
                      }
                      note={
                        m?.agency_scatter_min_citations_note?.() ??
                          "Requires at least 50 citations to display."
                      }
                      xScaleType="log"
                      yScaleType="log"
                      minX={1}
                      minY={1}
                    />
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title="Non-white stops vs citations"
                      domainGroup="stops-citations"
                      showMeanLines={true}
                      xLabel="Non-white total stops"
                      yLabel="Non-white citations"
                      xMetricKey="rates-by-race--totals--all-stops"
                      yMetricKey="rates-by-race--totals--citations"
                      xColumn="Non-white"
                      yColumn="Non-white"
                      excludeAgencies={scatterExcludedAgencies}
                      minStops={500}
                      sizeByStops={true}
                      stopsColumn="Non-white"
                      stopsLabel="Non-white total stops"
                      minCount={25}
                      minCountKey="rates-by-race--totals--citations"
                      minCountColumn="Non-white"
                      minCountMessage={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      note={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      xScaleType="log"
                      yScaleType="log"
                      minX={1}
                      minY={1}
                    />
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title="White stops vs citations"
                      domainGroup="stops-citations"
                      showMeanLines={true}
                      xLabel="White total stops"
                      yLabel="White citations"
                      xMetricKey="rates-by-race--totals--all-stops"
                      yMetricKey="rates-by-race--totals--citations"
                      xColumn="White"
                      yColumn="White"
                      excludeAgencies={scatterExcludedAgencies}
                      minStops={500}
                      sizeByStops={true}
                      stopsColumn="White"
                      stopsLabel="White total stops"
                      minCount={25}
                      minCountKey="rates-by-race--totals--citations"
                      minCountColumn="White"
                      minCountMessage={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      note={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      xScaleType="log"
                      yScaleType="log"
                      minX={1}
                      minY={1}
                    />
                  </div>
                  <div class="grid gap-7 lg:gap-8 lg:grid-cols-3">
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title={
                        m?.agency_scatter_citation_vs_arrest_heading?.() ??
                          "Citation rate vs arrest rate"
                      }
                      domainGroup="citation-arrest"
                      showMeanLines={true}
                      xLabel={m?.agency_scatter_citation_rate_label?.() ?? "Citation rate (%)"}
                      yLabel={m?.agency_scatter_arrest_rate_label?.() ?? "Arrest rate (%)"}
                      xMetricKey="rates-by-race--totals--citations-rate"
                      yMetricKey="rates-by-race--totals--arrests-rate"
                      excludeAgencies={scatterExcludedAgencies}
                      formatXAxisTick={formatPercentTick}
                      formatYAxisTick={formatPercentTick}
                      xCountKey="rates-by-race--totals--citations"
                      yCountKey="rates-by-race--totals--arrests"
                      xCountLabel={m?.agency_scatter_citations_label?.() ?? "Citations"}
                      yCountLabel={m?.agency_scatter_arrests_label?.() ?? "Arrests"}
                      minStops={500}
                      sizeByStops={true}
                      stopsLabel={m?.agency_scatter_total_stops_label?.() ?? "Total stops"}
                      minCount={50}
                      minCountKey="rates-by-race--totals--citations"
                      minCountMessage={
                        m?.agency_scatter_min_citations_note?.() ??
                          "Requires at least 50 citations to display."
                      }
                      note={
                        m?.agency_scatter_min_citations_note?.() ??
                          "Requires at least 50 citations to display."
                      }
                      excludeExactValue={100}
                      minX={0}
                      minY={0}
                      maxX={100}
                      maxY={100}
                    />
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title={
                        m?.agency_scatter_citation_vs_arrest_nonwhite_heading?.() ??
                          "Non-white citation rate vs arrest rate"
                      }
                      domainGroup="citation-arrest"
                      showMeanLines={true}
                      xLabel={
                        m?.agency_scatter_citation_rate_nonwhite_label?.() ??
                          "Non-white citation rate"
                      }
                      yLabel={
                        m?.agency_scatter_arrest_rate_nonwhite_label?.() ??
                          "Non-white arrest rate"
                      }
                      xMetricKey="rates-by-race--totals--citations-rate"
                      yMetricKey="rates-by-race--totals--arrests-rate"
                      xColumn="Non-white"
                      yColumn="Non-white"
                      excludeAgencies={scatterExcludedAgencies}
                      formatXAxisTick={formatPercentTick}
                      formatYAxisTick={formatPercentTick}
                      xCountKey="rates-by-race--totals--citations"
                      yCountKey="rates-by-race--totals--arrests"
                      xCountColumn="Non-white"
                      yCountColumn="Non-white"
                      xCountLabel={
                        m?.agency_scatter_citations_nonwhite_label?.() ??
                          "Non-white citations"
                      }
                      yCountLabel={
                        m?.agency_scatter_arrests_nonwhite_label?.() ??
                          "Non-white arrests"
                      }
                      minStops={500}
                      sizeByStops={true}
                      stopsColumn="Non-white"
                      stopsLabel="Non-white total stops"
                      minCount={25}
                      minCountKey="rates-by-race--totals--citations"
                      minCountColumn="Non-white"
                      minCountMessage={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      note={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      excludeExactValue={100}
                      minX={0}
                      minY={0}
                      maxX={100}
                      maxY={100}
                    />
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title={
                        m?.agency_scatter_citation_vs_arrest_white_heading?.() ??
                          "White citation rate vs arrest rate"
                      }
                      domainGroup="citation-arrest"
                      showMeanLines={true}
                      xLabel={
                        m?.agency_scatter_citation_rate_white_label?.() ??
                          "White citation rate"
                      }
                      yLabel={
                        m?.agency_scatter_arrest_rate_white_label?.() ??
                          "White arrest rate"
                      }
                      xMetricKey="rates-by-race--totals--citations-rate"
                      yMetricKey="rates-by-race--totals--arrests-rate"
                      xColumn="White"
                      yColumn="White"
                      excludeAgencies={scatterExcludedAgencies}
                      formatXAxisTick={formatPercentTick}
                      formatYAxisTick={formatPercentTick}
                      xCountKey="rates-by-race--totals--citations"
                      yCountKey="rates-by-race--totals--arrests"
                      xCountColumn="White"
                      yCountColumn="White"
                      xCountLabel={m?.agency_scatter_citations_white_label?.() ?? "White citations"}
                      yCountLabel={m?.agency_scatter_arrests_white_label?.() ?? "White arrests"}
                      minStops={500}
                      sizeByStops={true}
                      stopsColumn="White"
                      stopsLabel="White total stops"
                      minCount={25}
                      minCountKey="rates-by-race--totals--citations"
                      minCountColumn="White"
                      minCountMessage={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      note={
                        m?.agency_scatter_min_citations_note_small?.() ??
                          "Requires at least 25 citations to display."
                      }
                      excludeExactValue={100}
                      minX={0}
                      minY={0}
                      maxX={100}
                      maxY={100}
                    />
                  </div>
                  <div class="grid gap-7 lg:gap-8 lg:grid-cols-3">
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title={
                        m?.agency_scatter_search_vs_hit_heading?.() ??
                          "Search rate vs contraband hit rate"
                      }
                      domainGroup="hits-searches"
                      showMeanLines={true}
                      xLabel={m?.agency_scatter_search_rate_label?.() ?? "Search rate"}
                      yLabel={m?.agency_scatter_hit_rate_label?.() ?? "Hit rate"}
                      xMetricKey="rates-by-race--totals--searches-rate"
                      yMetricKey="rates-by-race--totals--contraband-hit-rate"
                      formatXAxisTick={formatPercentTick}
                      formatYAxisTick={formatPercentTick}
                      xCountKey="rates-by-race--totals--searches"
                      yCountKey="rates-by-race--totals--contraband"
                      xCountLabel={m?.agency_scatter_searches_label?.() ?? "Searches"}
                      yCountLabel={
                        m?.agency_scatter_contraband_hits_label?.() ?? "Contraband hits"
                      }
                      excludeAgencies={scatterExcludedAgencies}
                      minStops={500}
                      sizeByStops={true}
                      stopsLabel={m?.agency_scatter_total_stops_label?.() ?? "Total stops"}
                      minCount={25}
                      minCountKey="rates-by-race--totals--searches"
                      excludeAboveX={50}
                      minCountMessage={
                        m?.agency_scatter_min_searches_note?.() ??
                          "Requires at least 25 searches to display."
                      }
                      note={
                        m?.agency_scatter_min_searches_note?.() ??
                          "Requires at least 25 searches to display."
                      }
                    />
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title={
                        m?.agency_scatter_search_vs_hit_nonwhite_heading?.() ??
                          "Non-white search rate vs contraband hit rate"
                      }
                      domainGroup="hits-searches"
                      showMeanLines={true}
                      xLabel={
                        m?.agency_scatter_search_rate_nonwhite_label?.() ??
                          "Non-white search rate"
                      }
                      yLabel={
                        m?.agency_scatter_hit_rate_nonwhite_label?.() ??
                          "Non-white hit rate"
                      }
                      xMetricKey="rates-by-race--totals--searches-rate"
                      yMetricKey="rates-by-race--totals--contraband-hit-rate"
                      xColumn="Non-white"
                      yColumn="Non-white"
                      formatXAxisTick={formatPercentTick}
                      formatYAxisTick={formatPercentTick}
                      xCountKey="rates-by-race--totals--searches"
                      yCountKey="rates-by-race--totals--contraband"
                      xCountColumn="Non-white"
                      yCountColumn="Non-white"
                      xCountLabel={
                        m?.agency_scatter_searches_nonwhite_label?.() ??
                          "Non-white searches"
                      }
                      yCountLabel={
                        m?.agency_scatter_contraband_hits_nonwhite_label?.() ??
                          "Non-white contraband hits"
                      }
                      excludeAgencies={scatterExcludedAgencies}
                      minStops={500}
                      sizeByStops={true}
                      stopsColumn="Non-white"
                      stopsLabel="Non-white total stops"
                      minCount={25}
                      minCountKey="rates-by-race--totals--searches"
                      minCountColumn="Non-white"
                      excludeAboveX={50}
                      minCountMessage={
                        m?.agency_scatter_min_searches_note_small?.() ??
                          "Requires at least 25 searches to display."
                      }
                      note={
                        m?.agency_scatter_min_searches_note_small?.() ??
                          "Requires at least 25 searches to display."
                      }
                    />
                    <AgencyRateScatter
                      selectedYear={selectedYear}
                      agencyName={agencyData?.agency ?? data.slug}
                      title={
                        m?.agency_scatter_search_vs_hit_white_heading?.() ??
                          "White search rate vs contraband hit rate"
                      }
                      domainGroup="hits-searches"
                      showMeanLines={true}
                      xLabel={
                        m?.agency_scatter_search_rate_white_label?.() ?? "White search rate"
                      }
                      yLabel={m?.agency_scatter_hit_rate_white_label?.() ?? "White hit rate"}
                      xMetricKey="rates-by-race--totals--searches-rate"
                      yMetricKey="rates-by-race--totals--contraband-hit-rate"
                      xColumn="White"
                      yColumn="White"
                      formatXAxisTick={formatPercentTick}
                      formatYAxisTick={formatPercentTick}
                      xCountKey="rates-by-race--totals--searches"
                      yCountKey="rates-by-race--totals--contraband"
                      xCountColumn="White"
                      yCountColumn="White"
                      xCountLabel={m?.agency_scatter_searches_white_label?.() ?? "White searches"}
                      yCountLabel={
                        m?.agency_scatter_contraband_hits_white_label?.() ??
                          "White contraband hits"
                      }
                      excludeAgencies={scatterExcludedAgencies}
                      minStops={500}
                      sizeByStops={true}
                      stopsColumn="White"
                      stopsLabel="White total stops"
                      minCount={25}
                      minCountKey="rates-by-race--totals--searches"
                      minCountColumn="White"
                      excludeAboveX={50}
                      minCountMessage={
                        m?.agency_scatter_min_searches_note_small?.() ??
                          "Requires at least 25 searches to display."
                      }
                      note={
                        m?.agency_scatter_min_searches_note_small?.() ??
                          "Requires at least 25 searches to display."
                      }
                    />
                  </div>
                </div>
                <div
                  role="tablist"
                  aria-label={agency_yearly_data_heading()}
                  class="flex flex-wrap items-center gap-2 pt-1"
                >
                  {#each years as year}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={year === selectedYear}
                      class={`rounded-md border px-3 py-1.5 text-sm font-semibold tracking-wide transition sm:text-base ${
                        year === selectedYear
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`}
                      on:click={() => selectYear(year, "bottom")}
                    >
                      {year}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </article>
    {/if}
  </section>

</main>

<MetricChartModal
  open={Boolean(activeMetricKey)}
  metricKey={activeMetricKey}
  metricLabel={activeMetricLabel}
  rows={rows}
  raceKeys={chartRaceKeys}
  baselines={baselines}
  agencyName={agencyData?.agency ?? data.slug}
  on:close={closeMetric}
/>

<style>
  :global(.gridcraft-table .gc-table-wrapper) {
    overflow: auto;
    max-height: min(70vh, 900px);
    position: relative;
    padding: 0;
  }

  :global(.gridcraft-table thead) {
    position: sticky;
    top: 0;
    z-index: 3;
  }

  :global(.gridcraft-table .gc-header-tr th) {
    position: sticky;
    top: 0;
    z-index: 3;
    background: #334155;
    border-color: #334155 !important;
    color: #ffffff !important;
    cursor: default;
  }

  :global(.gridcraft-table .gc-header-tr .gc-th-col-title) {
    color: #ffffff !important;
  }

  :global(.gridcraft-table .gc-header-tr th:first-child) {
    background: #1f2937;
    border-color: #1f2937 !important;
  }

  :global(.gridcraft-table .gc-table) {
    border-collapse: collapse;
    border-spacing: 0;
    margin: 0;
    table-layout: fixed;
    width: 100%;
  }

  :global(.gridcraft-table .gc-table th),
  :global(.gridcraft-table .gc-table td) {
    border: 0 !important;
  }

  :global(.gridcraft-table .gc-table td) {
    background: #ffffff;
  }

  :global(.gridcraft-table .gc-table th:first-child) {
    left: 0;
    z-index: 4;
  }

  :global(.gridcraft-table .gc-table td:first-child) {
    position: sticky;
    left: 0;
    z-index: 2;
    background: #f1f5f9;
    box-shadow: 6px 0 8px -6px rgba(15, 23, 42, 0.15);
  }

  :global(.gridcraft-table .gc-table tbody tr:not(.gc-tr__groupby):hover td) {
    background: #e2e8f0;
  }

  :global(.gridcraft-table .gc-table tbody tr:not(.gc-tr__groupby):hover td:first-child) {
    background: #e2e8f0;
  }

  :global(.gridcraft-table .gc-tr__groupby td:first-child) {
    background: var(--gc-tr-groupby-bg-color, var(--gc-main-color));
    border-right: none;
    box-shadow: none;
  }

  :global(.gridcraft-table .gc-td.gc-td__groupby) {
    position: relative;
    padding: 0 !important;
    background: var(--gc-tr-groupby-bg-color, var(--gc-main-color));
  }

  :global(.gridcraft-table .gc-td__groupby-container) {
    position: sticky;
    left: 0;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    min-width: var(--gc-groupby-sticky-width, 180px);
    max-width: var(--gc-groupby-sticky-width, 180px);
    padding: 0.3rem 0.45rem;
    background: var(--gc-tr-groupby-bg-color, var(--gc-main-color));
  }

  :global(.gridcraft-table .gc-td__groupby-content) {
    width: auto;
    justify-content: flex-start;
    gap: 0.5rem;
  }

  :global(.gridcraft-table .gc-tr__groupby) {
    cursor: pointer;
    border: 0 !important;
  }

  :global(.gridcraft-table .gc-tr__groupby:hover td) {
    background: #b6c2d1;
  }

  :global(.gridcraft-table .gc-tr__groupby:hover .gc-td__groupby-container) {
    background: #b6c2d1;
  }

  :global(.gridcraft-table .gc-td__groupby-count) {
    display: none;
  }
</style>
