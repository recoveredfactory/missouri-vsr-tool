<script>
  import { Grid, PagingData, PlainTableCssTheme } from "@mediakular/gridcraft";
  import AgencyMap from "$lib/components/AgencyMap.svelte";
  import GridMetricCell from "$lib/components/grid/GridMetricCell.svelte";
  import GridTextCell from "$lib/components/grid/GridTextCell.svelte";
  import GridValueCell from "$lib/components/grid/GridValueCell.svelte";
  import MetricChartModal from "$lib/components/MetricChartModal.svelte";
  import CensusPanel from "$lib/components/CensusPanel.svelte";
  import NeighborsPanel from "$lib/components/NeighborsPanel.svelte";
  import ScatterSection from "$lib/components/ScatterSection.svelte";
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount, tick } from "svelte";
  import * as m from "$lib/paraglide/messages";
  import { withDataBase } from "$lib/dataBase";
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
    census_stat_population,
    census_stat_median_age,
    census_stat_median_income,
    agency_annual_stops_heading,
    agency_comment_heading,
    agency_comment_heading_year,
    agency_comment_none,
    agency_comment_none_year,
    agency_comment_source_pdf,
    agency_rankings_ties_note,
    agency_reporting_count,
    agency_county_label,
    agency_download_data_for,
    agency_download_all_data,
    agency_metric_search_label,
    agency_stop_volume_lead,
    agency_stop_volume_segment_sentence,
    agency_stop_volume_rank_clause_highest,
    agency_stop_volume_rank_clause,
    agency_stop_volume_rank_clause_simple,
  } from "$lib/paraglide/messages";

  /** @type {import('./$types').LayoutData} */
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
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
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
  let localeBase = "/en";
  let basemapStyleUrl = "/map/style.en.json";
  let metricSearchTimeout;
  let lastTrackedMetricSearch = "";
  let agencyComments = [];
  let selectedAgencyComment = null;
  let selectedCommentText = "";
  let selectedCommentParagraphs = [];
  let commentHeading = "";
  let noCommentText = "";
  const scatterExcludedAgencies = ["Missouri State Highway Patrol"];
  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? "https://vsr.recoveredfactory.net";

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
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

  $: reportingAgencyCount = (() => {
    if (!selectedYear) return null;
    const yearRows = rowsByYear?.[selectedYear] ?? [];
    const totalRow = yearRows.find(
      (row) => row?.row_key === "rates-by-race--totals--all-stops"
    );
    const rankCountRaw = totalRow?.rank_count;
    const rankCount = typeof rankCountRaw === "string" ? Number(rankCountRaw) : rankCountRaw;
    if (Number.isFinite(rankCount) && rankCount > 0) return rankCount;
    const agencyCount = Number(data?.agencyCount);
    return Number.isFinite(agencyCount) && agencyCount > 0 ? agencyCount : null;
  })();

  $: {
    try {
      locale = getLocale();
    } catch {
      locale = "en";
    }
    localeBase = `/${locale || "en"}`;
    basemapStyleUrl = `/map/style.${locale}.json`;
  }
  $: canonicalAgencyUrl = `${siteUrl}${localeBase}/agency/${data.slug}`;
  $: agencyHrefEn = `${siteUrl}/en/agency/${data.slug}`;
  $: agencyHrefEs = `${siteUrl}/es/agency/${data.slug}`;

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
  $: agencyComments = Array.isArray(agencyData?.agency_comments)
    ? agencyData.agency_comments
    : [];
  $: selectedAgencyComment =
    agencyComments.find((entry) => String(entry?.year) === String(selectedYear)) ??
    null;
  $: selectedCommentText = selectedAgencyComment?.comment
    ? String(selectedAgencyComment.comment).trim()
    : "";
  $: selectedCommentParagraphs = selectedCommentText
    ? selectedCommentText
        .split(/\r?\n+/)
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];
  $: commentHeading = selectedYear
    ? agency_comment_heading_year({ year: selectedYear })
    : agency_comment_heading();
  $: noCommentText = selectedYear
    ? agency_comment_none_year({ year: selectedYear })
    : agency_comment_none();
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
      const rankValue = metric.rank
        ? getMetricValue(metric.rank, label)
        : metric.base?.rank_dense;
      const rankCountRaw = metric.base?.rank_count;
      const rankCount =
        typeof rankCountRaw === "string" ? Number(rankCountRaw) : rankCountRaw;
      let rankDisplay = "";
      if (hasSupplementValue(rankValue)) {
        const numeric = typeof rankValue === "string" ? Number(rankValue) : rankValue;
        const rankFormatted = Number.isFinite(numeric)
          ? stopCountFormatter.format(Math.round(numeric))
          : formatValue(rankValue);
        if (rankFormatted && rankFormatted !== "—") {
          if (Number.isFinite(rankCount) && rankCount > 0) {
            rankDisplay = `#${rankFormatted}/${stopCountFormatter.format(rankCount)}`;
          } else if (agencyCount > 0) {
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

  const toFiniteNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
  };

  const getSelectedGeocodeResult = (response, selectedIndexRaw) => {
    const results = Array.isArray(response?.results) ? response.results : [];
    if (!results.length) return null;
    const selectedIndex = Number.isFinite(Number(selectedIndexRaw))
      ? Number(selectedIndexRaw)
      : 0;
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      return results[selectedIndex];
    }
    return results[0];
  };

  const getLatestCensusRow = (censusByYear) => {
    if (!censusByYear || typeof censusByYear !== "object") return null;
    const entries = Object.values(censusByYear).filter((entry) => entry && typeof entry === "object");
    if (!entries.length) return null;
    entries.sort((a, b) => {
      const aYear = Number(a?.census_year);
      const bYear = Number(b?.census_year);
      if (Number.isFinite(aYear) && Number.isFinite(bYear)) return bYear - aYear;
      return 0;
    });
    return entries[0];
  };

  const readAcsRaceRows = (raceTable) => {
    if (!raceTable || typeof raceTable !== "object") return [];
    const raceConfig = [
      {
        label: race_white(),
        keys: ["Not Hispanic or Latino: White alone", "White alone"],
      },
      {
        label: race_black(),
        keys: ["Not Hispanic or Latino: Black or African American alone", "Black or African American alone"],
      },
      {
        label: race_hispanic(),
        keys: ["Hispanic or Latino"],
      },
      {
        label: race_native_american(),
        keys: [
          "Not Hispanic or Latino: American Indian and Alaska Native alone",
          "American Indian and Alaska Native alone",
        ],
      },
      {
        label: race_asian(),
        keys: ["Not Hispanic or Latino: Asian alone", "Asian alone"],
      },
      {
        label: race_other(),
        keys: [
          "Not Hispanic or Latino: Native Hawaiian and Other Pacific Islander alone",
          "Native Hawaiian and Other Pacific Islander alone",
          "Not Hispanic or Latino: Some other race alone",
          "Some other race alone",
          "Not Hispanic or Latino: Two or more races",
          "Two or more races",
        ],
      },
    ];

    return raceConfig
      .map((entry) => {
        for (const key of entry.keys) {
          const percentage = toFiniteNumber(raceTable?.[key]?.percentage);
          if (percentage === null) continue;
          return {
            label: entry.label,
            value: percentage,
            display: percentFormatter.format(percentage),
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const formatAcsNumber = (value) => {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value)) {
      return stopCountFormatter.format(value);
    }
    return numberFormatter.format(value);
  };

  const formatAcsCell = (value) => {
    if (!Number.isFinite(value)) return "";
    return formatAcsNumber(value);
  };

  const buildAcsTableGroups = (acs) => {
    if (!acs || typeof acs !== "object") return [];
    const sectionOrder = ["demographics", "economics", "housing", "social", "families"];

    return sectionOrder
      .map((sectionKey) => {
        const section = acs?.[sectionKey];
        if (!section || typeof section !== "object") return null;

        const tables = Object.entries(section)
          .filter(([tableTitle]) => tableTitle !== "meta")
          .filter(([tableTitle]) => !(sectionKey === "demographics" && tableTitle === "Race and ethnicity"))
          .map(([tableTitle, tableData]) => {
            if (!tableData || typeof tableData !== "object") return null;
            const isCurrencyTable = /median.*income|per capita income/i.test(tableTitle);
            const rows = Object.entries(tableData)
              .filter(([label]) => label !== "meta")
              .map(([label, rowData]) => {
                if (!rowData || typeof rowData !== "object") return null;
                const value = toFiniteNumber(rowData?.value);
                const percentage = toFiniteNumber(rowData?.percentage);
                const marginOfError = toFiniteNumber(rowData?.margin_of_error);
                if (value === null && percentage === null && marginOfError === null) return null;
                return {
                  label,
                  valueDisplay: value === null ? "" : isCurrencyTable ? currencyFormatter.format(Math.round(value)) : formatAcsCell(value),
                  percentDisplay: percentage === null ? "" : percentFormatter.format(percentage),
                  moeDisplay: marginOfError === null ? "" : isCurrencyTable ? currencyFormatter.format(Math.round(marginOfError)) : formatAcsCell(marginOfError),
                };
              })
              .filter(Boolean);

            if (!rows.length) return null;
            return {
              title: tableTitle,
              rowCount: rows.length,
              rows,
            };
          })
          .filter(Boolean);

        if (!tables.length) return null;
        return {
          id: sectionKey,
          label: sectionLabelForId(sectionKey) || sectionKey,
          tables,
        };
      })
      .filter(Boolean);
  };

  const normalizeDistrictNames = (entries) => {
    if (!Array.isArray(entries) || !entries.length) return [];
    const seen = new Set();
    return entries
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const name = cleanMetadataValue(entry?.name);
        const districtNumber = cleanMetadataValue(entry?.district_number);
        const fallback = districtNumber ? `District ${districtNumber}` : "";
        return name || fallback;
      })
      .filter(Boolean)
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  };

  const summarizeGeocodioResponse = (response, selectedIndexRaw) => {
    const selected = getSelectedGeocodeResult(response, selectedIndexRaw);
    if (!selected) return null;

    const fields = selected?.fields ?? {};
    const latestCensus = getLatestCensusRow(fields?.census);
    const acs = fields?.acs && typeof fields.acs === "object" ? fields.acs : null;
    if (!latestCensus && !acs) return null;

    const raceTable = acs?.demographics?.["Race and ethnicity"] ?? null;
    const raceRows = readAcsRaceRows(raceTable);
    const population = toFiniteNumber(raceTable?.Total?.value);
    const medianAge = toFiniteNumber(acs?.demographics?.["Median age"]?.Total?.value);
    const medianIncome = toFiniteNumber(acs?.economics?.["Median household income"]?.Total?.value);
    const acsMeta = acs?.meta ?? {};
    const acsTableGroups = buildAcsTableGroups(acs);
    const congressionalDistricts = normalizeDistrictNames(fields?.congressional_districts);
    const stateLegislativeHouseDistricts = normalizeDistrictNames(
      fields?.state_legislative_districts?.house
    );
    const stateLegislativeSenateDistricts = normalizeDistrictNames(
      fields?.state_legislative_districts?.senate
    );
    const stateLegislativeDistricts = [
      ...stateLegislativeHouseDistricts,
      ...stateLegislativeSenateDistricts,
    ];

    const summaryStats = [];
    if (population !== null) {
      summaryStats.push({
        label: census_stat_population(),
        value: stopCountFormatter.format(Math.round(population)),
      });
    }
    if (medianAge !== null) {
      summaryStats.push({
        label: census_stat_median_age(),
        value: numberFormatter.format(medianAge),
      });
    }
    if (medianIncome !== null) {
      summaryStats.push({
        label: census_stat_median_income(),
        value: currencyFormatter.format(Math.round(medianIncome)),
      });
    }

    return {
      formattedAddress: cleanMetadataValue(selected?.formatted_address),
      metroAreaName: cleanMetadataValue(latestCensus?.metro_micro_statistical_area?.name),
      censusYear: cleanMetadataValue(latestCensus?.census_year),
      surveyYears: cleanMetadataValue(acsMeta?.survey_years),
      surveyDurationYears: cleanMetadataValue(acsMeta?.survey_duration_years),
      congressionalDistricts,
      stateLegislativeDistricts,
      raceRows,
      acsTableGroups,
      summaryStats,
      hasAcs: Boolean(acs),
    };
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
  let geocodioDemographics = null;
  let boundaryData = null;
  let addressState = "";
  let stopVolumeLead = "";
  let stopVolumeSegmentLabel = "";
  let stopVolumeSegmentPrefix = "";
  let stopVolumeSegmentSuffix = "";
  let stopVolumeRankClause = "";
  let stopVolumeStopsDisplay = "";
  let metaTitle = "";
  let metaDescription = "";
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
  $: geocodioDemographics = summarizeGeocodioResponse(
    geocodeJurisdictionResponse,
    metadata?.geocode_jurisdiction_selected_index
  );
  $: phoneDisplay = rawPhone ? formatPhone(rawPhone) : "";

  $: {
    const latestYear = years.find((year) => Number.isFinite(Number(year)));
    stopVolumeLead = "";
    stopVolumeSegmentLabel = "";
    stopVolumeSegmentPrefix = "";
    stopVolumeSegmentSuffix = "";
    stopVolumeRankClause = "";
    stopVolumeStopsDisplay = "";
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
        stopVolumeStopsDisplay = totalStops;
        const leadRaw = agency_stop_volume_lead({ agency: agencyName, stops: totalStops, year: latestYear });
        const lead = leadRaw.replace(/[.!?]+$/, "").trim();
        stopVolumeLead = lead;

        const percentileValue = getMetricValue(percentileEntry, "Total");
        const percentileNumeric =
          typeof percentileValue === "string" ? Number(percentileValue) : percentileValue;
        let segmentSentence = "";
        let segmentLabel = "";
        if (Number.isFinite(percentileNumeric)) {
          const isTopHalf = percentileNumeric >= 50;
          const percentValue = isTopHalf
            ? Math.max(1, Math.round(100 - percentileNumeric))
            : Math.max(1, Math.round(percentileNumeric));
          segmentLabel = isTopHalf ? `top ${percentValue}%` : `bottom ${percentValue}%`;
          segmentSentence = agency_stop_volume_segment_sentence({ segment: segmentLabel });
        }
        segmentSentence = segmentSentence.replace(/[.!?]+$/, "").trim();
        const rankValue =
          totalEntry?.rank_dense ?? getMetricValue(rankEntry, "Total");
        const rankNumeric = typeof rankValue === "string" ? Number(rankValue) : rankValue;
        let rankClause = "";
        if (Number.isFinite(rankNumeric)) {
          const rankRounded = Math.round(rankNumeric);
          if (rankRounded === 1) {
            rankClause = agency_stop_volume_rank_clause_highest();
          } else {
            const rankDisplay = stopCountFormatter.format(rankRounded);
            const rankCountRaw = totalEntry?.rank_count;
            const rankCount =
              typeof rankCountRaw === "string" ? Number(rankCountRaw) : rankCountRaw;
            const agencyCount = Number(data?.agencyCount);
            const totalDisplay =
              Number.isFinite(rankCount) && rankCount > 0
                ? stopCountFormatter.format(rankCount)
                : Number.isFinite(agencyCount) && agencyCount > 0
                ? stopCountFormatter.format(agencyCount)
                : "";
            if (totalDisplay) {
              rankClause = agency_stop_volume_rank_clause({ rank: rankDisplay, total: totalDisplay });
            } else {
              rankClause = agency_stop_volume_rank_clause_simple({ rank: rankDisplay });
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

  $: {
    const agencyName = agencyData?.agency ?? data.slug;
    metaTitle = `Missouri Vehicle Stops - ${agencyName}`;
    if (agencyName && stopVolumeStopsDisplay && stopVolumeSegmentLabel) {
      metaDescription = `${agencyName} had ${stopVolumeStopsDisplay} stops, putting it in the ${stopVolumeSegmentLabel} of agencies in Missouri. Learn more about who got stopped and why.`;
    } else {
      metaDescription = `${agencyName} traffic stops data. Learn more about who got stopped and why.`;
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

  const sectionLabel = () => m.agency_section_label();
  const tableLabel = () => m.agency_table_label();

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

  const buildMetricPath = (metricKey) =>
    `${localeBase}/agency/${data.slug}/metric/${encodeURIComponent(metricKey)}`;
  const baseAgencyPath = () => `${localeBase}/agency/${data.slug}`;
  const getRouteMetricKey = (metricKey) =>
    typeof metricKey === "string" ? metricKey : "";

  const openMetric = (metricKey, { updateRoute = true } = {}) => {
    if (!metricKey) return;
    activeMetricKey = metricKey;
    activeMetricLabel = metricLabelForKey(metricKey);
    if (updateRoute) {
      goto(buildMetricPath(metricKey), {
        replaceState: false,
        keepfocus: true,
        noScroll: true,
      });
    }
  };

  const closeMetric = ({ updateRoute = true } = {}) => {
    activeMetricKey = "";
    activeMetricLabel = "";
    if (updateRoute) {
      goto(baseAgencyPath(), {
        replaceState: false,
        keepfocus: true,
        noScroll: true,
      });
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


  const syncFromRoute = (metricKey) => {
    if (typeof window === "undefined" || !rows.length) return;
    const routeKey = getRouteMetricKey(metricKey);
    if (routeKey && hasMetricKey(routeKey)) {
      openMetric(routeKey, { updateRoute: false });
      return;
    }
    if (routeKey && !hasMetricKey(routeKey)) {
      closeMetric({ updateRoute: false });
      goto(baseAgencyPath(), {
        replaceState: true,
        keepfocus: true,
        noScroll: true,
      });
    } else if (!metricKey && activeMetricKey) {
      closeMetric({ updateRoute: false });
    }
  };

  onMount(() => {
    syncFromRoute($page?.params?.metricKey);
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
      if (gridTableEl) {
        gridTableEl.removeEventListener("click", handleGroupRowClick);
      }
    };
  });

  $: if (typeof window !== "undefined" && rows.length) {
    syncFromRoute($page?.params?.metricKey);
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

<svelte:head>
  <title>{metaTitle}</title>
  <link rel="canonical" href={canonicalAgencyUrl} />
  <link rel="alternate" hreflang="en" href={agencyHrefEn} />
  <link rel="alternate" hreflang="es" href={agencyHrefEs} />
  <link rel="alternate" hreflang="x-default" href={agencyHrefEn} />
  <meta name="description" content={metaDescription} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={canonicalAgencyUrl} />
  <meta property="og:site_name" content="Missouri Vehicle Stops" />
  <meta property="og:title" content={metaTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:image" content="{siteUrl}/social-meta.png" />
  <meta property="og:image:secure_url" content="{siteUrl}/social-meta.png" />
  <meta property="og:image:alt" content="Missouri Vehicle Stops overview" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1600" />
  <meta property="og:image:height" content="838" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:image" content="{siteUrl}/social-meta.png" />
  <meta property="twitter:title" content={metaTitle} />
  <meta property="twitter:description" content={metaDescription} />
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${agencyData?.agency ?? data.slug} — Traffic Stop Data`,
    description: metaDescription,
    url: canonicalAgencyUrl,
    license: "https://www.missouri.gov/",
    temporalCoverage: "2020/2024",
    spatialCoverage: {
      "@type": "Place",
      name: [agencyData?.agency, jurisdictionDisplay, "Missouri"].filter(Boolean).join(", ")
    },
    publisher: {
      "@type": "Organization",
      name: "Recovered Factory",
      url: "https://recoveredfactory.net"
    },
    isBasedOn: {
      "@type": "CreativeWork",
      name: "Missouri Vehicle Stops Report",
      creator: {
        "@type": "GovernmentOrganization",
        name: "Missouri Attorney General"
      }
    }
  })}</script>`}
</svelte:head>

<StickyHeader
  agencies={data.agencies}
  selectedAgencyLabel={agencyData?.agency ?? data.data?.agency ?? data.slug}
/>

<main id="main-content" class="mx-auto w-full max-w-5xl bg-slate-50 px-4 pb-16 pt-12 sm:px-6">
  <header class="mb-10">
    <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
      {agencyData?.agency ?? data.slug}
    </h1>
  </header>

  <section class="mb-1 grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start">
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
              {agency_county_label()}
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
            href={withDataBase(`/data/dist/agency_year/${data.slug}.json`)}
            download
          >
            <span aria-hidden="true">↓</span>
            {agency_download_data_for({ agency: agencyData?.agency ?? data.slug })}
          </a>
          <a
            class="inline-flex items-center gap-1 underline"
            href={`${localeBase}/#download`}
          >
            <span aria-hidden="true">↓</span>
            {agency_download_all_data()}
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
      pmtilesUrl={withDataBase("/data/dist/tiles/mo_jurisdictions_2024_500k.pmtiles")}
      boundaryDataOverride={boundaryData}
    />
  </section>

  <NeighborsPanel
    {touchingAgencies}
    {containedAgencies}
    {localeBase}
    agencySlug={agencyData?.agency ?? data.slug}
  />

  <CensusPanel
    {geocodioDemographics}
    agencySlug={agencyData?.agency ?? data.slug}
  />


  <section class="mb-10">
    {#if years.length === 0}
      <p class="text-sm text-slate-500">{agency_no_rows()}</p>
    {:else}
      <article class="relative mb-8">
        {#if metricGroups.length === 0}
          <p class="mt-4 text-sm text-slate-500">{agency_no_rows()}</p>
        {:else}
          <div class="mb-6 max-w-full overflow-visible">
            <div class="mt-4">
              <div class="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {agency_annual_stops_heading()}
              </div>
              <div
                role="tablist"
                aria-label={agency_yearly_data_heading()}
                class="mt-10 flex flex-wrap items-center gap-2"
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
              <div class="mt-6 max-w-2xl">
                <div class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {commentHeading}
                </div>
                {#if selectedAgencyComment?.has_comment && selectedCommentParagraphs.length}
                  <div class="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">
                    {#each selectedCommentParagraphs as paragraph}
                      <p>{paragraph}</p>
                    {/each}
                  </div>
                  {#if selectedAgencyComment?.source_url}
                    <a
                      class="mt-2 inline-flex text-xs text-slate-500 underline"
                      href={selectedAgencyComment.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {agency_comment_source_pdf()}
                    </a>
                  {/if}
                {:else}
                  <p class="mt-2 text-sm text-slate-500">{noCommentText}</p>
                {/if}
              </div>
            </div>
            <div class="mt-8 mb-6">
              <input
                type="search"
                class="h-10 w-full rounded-md border border-slate-400 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none sm:w-80 md:w-96"
                placeholder={'Search for a metric ("citation", "contraband")'}
                aria-label={agency_metric_search_label()}
                bind:value={metricSearch}
                on:input={(event) => scheduleMetricSearch(event.currentTarget.value)}
                on:blur={flushMetricSearch}
              />
            </div>
            <div
              class="gridcraft-table agency-gridcraft-table--frame"
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
            <p class="mt-3 text-xs text-slate-500">
              {agency_rankings_ties_note()}
              {#if reportingAgencyCount && selectedYear}
                {" "}{agency_reporting_count({ count: stopCountFormatter.format(reportingAgencyCount), year: selectedYear })}
              {/if}
            </p>
            <ScatterSection
              {years}
              {selectedYear}
              agencyName={agencyData?.agency ?? data.slug}
              excludeAgencies={scatterExcludedAgencies}
              {formatPercentTick}
              on:yearselect={(e) => selectYear(e.detail.year, e.detail.source)}
            />
          </div>
        {/if}
      </article>
    {/if}
  </section>

</main>

<slot />

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

  @media (max-width: 640px) {
    .agency-gridcraft-table--frame {
      width: 100vw;
      margin-left: calc(50% - 50vw);
      margin-right: calc(50% - 50vw);
    }
  }
</style>
