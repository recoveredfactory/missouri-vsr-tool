import { compile } from "mdsvex";
import aboutMarkdown from "../../content/about-the-data.md?raw";
import statsData from "../../static/data/homepage_2024_stats.json";
import statewideYearSums from "../../static/data/dist/statewide_year_sums.json";

const unwrapHtmlBlocks = (html) =>
  html.replace(/{@html\s+`([\s\S]*?)`}/g, (_match, inner) => inner);

const aboutDataHtmlPromise = compile(aboutMarkdown).then((compiled) =>
  unwrapHtmlBlocks(compiled.code),
);

const hasStructuredSums =
  statewideYearSums &&
  !Array.isArray(statewideYearSums) &&
  Array.isArray(statewideYearSums.years);

const getStructuredSeries = (rowKey) =>
  (statewideYearSums.data?.[rowKey] &&
    statewideYearSums.years.map(
      (y) => statewideYearSums.data[rowKey]?.[String(y)]?.Total ?? 0
    )) ||
  [];

const buildRowsIndex = () => {
  if (!Array.isArray(statewideYearSums)) {
    return { years: [], rowsByKey: new Map() };
  }
  const yearsSet = new Set();
  const rowsByKey = new Map();
  for (const row of statewideYearSums) {
    if (!row?.row_key || row?.year == null) continue;
    const yearKey = String(row.year);
    yearsSet.add(Number(row.year));
    if (!rowsByKey.has(row.row_key)) {
      rowsByKey.set(row.row_key, new Map());
    }
    rowsByKey.get(row.row_key).set(yearKey, row.Total ?? 0);
  }
  const years = Array.from(yearsSet).sort((a, b) => a - b);
  return { years, rowsByKey };
};

const { years: fallbackYears, rowsByKey } = buildRowsIndex();
const getFallbackSeries = (rowKey) =>
  fallbackYears.map((y) => rowsByKey.get(rowKey)?.get(String(y)) ?? 0);

const yearsList = hasStructuredSums ? statewideYearSums.years : fallbackYears;

// Derive historical data from statewide year sums
const historicalData = {
  years: yearsList,
  totalStops: hasStructuredSums
    ? getStructuredSeries("rates-by-race--totals--all-stops")
    : getFallbackSeries("rates-by-race--totals--all-stops"),
  consentSearches: hasStructuredSums
    ? getStructuredSeries("search-statistics--probable-cause--consent")
    : getFallbackSeries("search-statistics--probable-cause--consent"),
};

// Derive historical outcomes (percentages) from statewide year sums
const getOutcomeSeries = (rowKey) =>
  hasStructuredSums ? getStructuredSeries(rowKey) : getFallbackSeries(rowKey);

const outcomeArrests = getOutcomeSeries("number-of-stops-by-race--stop-outcome--arrests");
const outcomeCitations = getOutcomeSeries("number-of-stops-by-race--stop-outcome--citation");
const outcomeWarnings = getOutcomeSeries("number-of-stops-by-race--stop-outcome--warning");
const outcomeNoAction = getOutcomeSeries("number-of-stops-by-race--stop-outcome--no-action");

const historicalOutcomes = {
  years: yearsList,
  data: yearsList.map((y, idx) => {
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

export async function load({ fetch }) {
  let downloadManifest = null;
  try {
    const response = await fetch(
      "/data/downloads/missouri_vsr_2020_2024_downloads_manifest.json"
    );
    if (response.ok) {
      downloadManifest = await response.json();
    } else {
      console.error("Failed to load downloads manifest:", response.status);
    }
  } catch (error) {
    console.error("Failed to load downloads manifest:", error);
  }

  return {
    aboutDataHtml: await aboutDataHtmlPromise,
    downloadManifest,
    statsData,
    historicalData,
    historicalOutcomes,
  };
}
