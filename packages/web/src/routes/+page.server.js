import { compile } from "mdsvex";
import aboutMarkdown from "../../content/about-the-data.md?raw";
import statsData from "../../static/data/homepage_2024_stats.json";
import historicalData from "../../static/data/homepage_historical.json";
import metricData from "../../static/data/metric_year_subset.json";

const unwrapHtmlBlocks = (html) =>
  html.replace(/{@html\s+`([\s\S]*?)`}/g, (_match, inner) => inner);

const aboutDataHtmlPromise = compile(aboutMarkdown).then((compiled) =>
  unwrapHtmlBlocks(compiled.code),
);

// Compute historical outcomes data
function computeHistoricalOutcomes() {
  const totalColOffset = 2;
  const years = metricData.years;

  // Aggregate statewide totals by year
  const statewideByYear = {};
  years.forEach((year) => {
    statewideByYear[year] = { stops: 0, citations: 0, arrests: 0, searches: 0 };
  });

  (metricData.rows["rates-by-race--totals--all-stops"] || []).forEach(row => {
    const year = years[row[1]];
    if (statewideByYear[year]) statewideByYear[year].stops += row[totalColOffset] || 0;
  });

  (metricData.rows["rates-by-race--totals--citations"] || []).forEach(row => {
    const year = years[row[1]];
    if (statewideByYear[year]) statewideByYear[year].citations += row[totalColOffset] || 0;
  });

  (metricData.rows["rates-by-race--totals--arrests"] || []).forEach(row => {
    const year = years[row[1]];
    if (statewideByYear[year]) statewideByYear[year].arrests += row[totalColOffset] || 0;
  });

  (metricData.rows["rates-by-race--totals--searches"] || []).forEach(row => {
    const year = years[row[1]];
    if (statewideByYear[year]) statewideByYear[year].searches += row[totalColOffset] || 0;
  });

  const sortedYears = years.slice().sort((a, b) => a - b);
  return {
    years: sortedYears,
    data: sortedYears.map(year => {
      const stops = statewideByYear[year]?.stops || 1;
      const citations = statewideByYear[year]?.citations || 0;
      const arrests = statewideByYear[year]?.arrests || 0;
      const searches = statewideByYear[year]?.searches || 0;
      const noAction = Math.max(0, stops - citations - arrests - searches);
      return {
        year,
        citations: (citations / stops) * 100,
        arrests: (arrests / stops) * 100,
        searches: (searches / stops) * 100,
        noAction: (noAction / stops) * 100
      };
    })
  };
}

const historicalOutcomes = computeHistoricalOutcomes();

export async function load() {
  return {
    aboutDataHtml: await aboutDataHtmlPromise,
    statsData,
    historicalData,
    historicalOutcomes,
  };
}
