import { compile } from "mdsvex";
import aboutMarkdown from "../../content/about-the-data.md?raw";
import statsData from "../../static/data/homepage_2024_stats.json";
import statewideYearSums from "../../static/data/dist/statewide_year_sums.json";

const unwrapHtmlBlocks = (html) =>
  html.replace(/{@html\s+`([\s\S]*?)`}/g, (_match, inner) => inner);

const aboutDataHtmlPromise = compile(aboutMarkdown).then((compiled) =>
  unwrapHtmlBlocks(compiled.code),
);

// Derive historical data from statewide year sums
const historicalData = {
  years: statewideYearSums.years,
  totalStops: statewideYearSums.years.map(
    (y) => statewideYearSums.data["rates-by-race--totals--all-stops"][String(y)].Total
  ),
  consentSearches: statewideYearSums.years.map(
    (y) => statewideYearSums.data["search-statistics--probable-cause--consent"][String(y)].Total
  ),
};

// Derive historical outcomes (percentages) from statewide year sums
const historicalOutcomes = {
  years: statewideYearSums.years,
  data: statewideYearSums.years.map((y) => {
    const yearKey = String(y);
    const arrests = statewideYearSums.data["number-of-stops-by-race--stop-outcome--arrests"][yearKey].Total;
    const citations = statewideYearSums.data["number-of-stops-by-race--stop-outcome--citation"][yearKey].Total;
    const warnings = statewideYearSums.data["number-of-stops-by-race--stop-outcome--warning"][yearKey].Total;
    const noAction = statewideYearSums.data["number-of-stops-by-race--stop-outcome--no-action"][yearKey].Total;

    // Normalize to 100% since outcomes can overlap
    const total = arrests + citations + warnings + noAction;
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
