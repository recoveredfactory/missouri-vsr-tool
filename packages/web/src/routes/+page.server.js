import { compile } from "mdsvex";
import aboutMarkdown from "../../content/about-the-data.md?raw";
import { withDataBase } from "$lib/dataBase";

const unwrapHtmlBlocks = (html) =>
  html.replace(/{@html\s+`([\s\S]*?)`}/g, (_match, inner) => inner);

const aboutDataHtmlPromise = compile(aboutMarkdown).then((compiled) =>
  unwrapHtmlBlocks(compiled.code),
);

const isStructuredSums = (data) =>
  data && !Array.isArray(data) && Array.isArray(data.years);

const buildRowsIndex = (rows) => {
  if (!Array.isArray(rows)) {
    return { years: [], rowsByKey: new Map(), rowKeySet: new Set() };
  }
  const yearsSet = new Set();
  const rowsByKey = new Map();
  const rowKeySet = new Set();
  for (const row of rows) {
    if (!row?.row_key || row?.year == null) continue;
    const yearKey = String(row.year);
    yearsSet.add(Number(row.year));
    rowKeySet.add(row.row_key);
    if (!rowsByKey.has(row.row_key)) {
      rowsByKey.set(row.row_key, new Map());
    }
    rowsByKey.get(row.row_key).set(yearKey, row.Total ?? 0);
  }
  const years = Array.from(yearsSet).sort((a, b) => a - b);
  return { years, rowsByKey, rowKeySet };
};

const buildHistoricalData = (statewideYearSums) => {
  if (!statewideYearSums) {
    return { historicalData: null, historicalOutcomes: null };
  }

  const structured = isStructuredSums(statewideYearSums);
  const fallbackIndex = structured ? null : buildRowsIndex(statewideYearSums);
  const years = structured
    ? statewideYearSums.years.map((y) => Number(y))
    : fallbackIndex.years;

  if (!years.length) {
    return { historicalData: null, historicalOutcomes: null };
  }

  const { rowsByKey, rowKeySet } = structured
    ? {
        rowsByKey: null,
        rowKeySet: new Set(Object.keys(statewideYearSums.data ?? {})),
      }
    : fallbackIndex;

  const getSeries = (rowKey) =>
    structured
      ? (statewideYearSums.data?.[rowKey] &&
          years.map(
            (y) => statewideYearSums.data[rowKey]?.[String(y)]?.Total ?? 0
          )) ||
        []
      : years.map((y) => rowsByKey.get(rowKey)?.get(String(y)) ?? 0);

  const totalStopsKey = "rates-by-race--totals--all-stops";
  const consentSearchesKey = "search-statistics--search-reason--consent";
  const hasHistoricalRows =
    rowKeySet.has(totalStopsKey) && rowKeySet.has(consentSearchesKey);

  const historicalData = hasHistoricalRows
    ? {
        years,
        totalStops: getSeries(totalStopsKey),
        consentSearches: getSeries(consentSearchesKey),
      }
    : null;

  const outcomeKeys = [
    "number-of-stops-by-race--stop-outcome--arrests",
    "number-of-stops-by-race--stop-outcome--citation",
    "number-of-stops-by-race--stop-outcome--warning",
    "number-of-stops-by-race--stop-outcome--no-action",
  ];

  if (!outcomeKeys.every((key) => rowKeySet.has(key))) {
    return { historicalData, historicalOutcomes: null };
  }

  const [outcomeArrests, outcomeCitations, outcomeWarnings, outcomeNoAction] =
    outcomeKeys.map((rowKey) => getSeries(rowKey));

  const historicalOutcomes = {
    years,
    data: years.map((y, idx) => {
      const arrests = outcomeArrests[idx] ?? 0;
      const citations = outcomeCitations[idx] ?? 0;
      const warnings = outcomeWarnings[idx] ?? 0;
      const noAction = outcomeNoAction[idx] ?? 0;

      const total = arrests + citations + warnings + noAction;
      if (!total) {
        return { year: y, arrests: 0, citations: 0, warnings: 0, noAction: 0 };
      }

      return {
        year: y,
        arrests: (arrests / total) * 100,
        citations: (citations / total) * 100,
        warnings: (warnings / total) * 100,
        noAction: (noAction / total) * 100,
      };
    }),
  };

  return { historicalData, historicalOutcomes };
};

const fetchJson = async (fetch, path, dataBaseUrl) => {
  try {
    const response = await fetch(withDataBase(path, dataBaseUrl));
    if (!response.ok) {
      console.error(`Failed to load ${path}:`, response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to load ${path}:`, error);
    return null;
  }
};

export async function load({ fetch }) {
  const dataBaseUrl = import.meta.env.PUBLIC_DATA_BASE_URL;
  const [statsData, statewideYearSums, downloadManifest] = await Promise.all([
    fetchJson(fetch, "/data/homepage_2024_stats.json", dataBaseUrl),
    fetchJson(fetch, "/data/statewide_year_sums_subset.json", dataBaseUrl),
    fetchJson(
      fetch,
      "/data/downloads/missouri_vsr_2020_2024_downloads_manifest.json",
      dataBaseUrl
    ),
  ]);

  const { historicalData, historicalOutcomes } = buildHistoricalData(statewideYearSums);

  return {
    aboutDataHtml: await aboutDataHtmlPromise,
    downloadManifest,
    statsData,
    historicalData,
    historicalOutcomes,
  };
}
