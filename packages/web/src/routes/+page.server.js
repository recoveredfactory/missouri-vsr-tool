import { withDataBase } from "$lib/dataBase";

// The about-the-data markdown is imported as a Svelte component in +page.svelte
// (mdsvex is registered for .md in svelte.config.js), so server-side compile is
// no longer needed here.

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

  const totalStopsKey = "stops";
  const consentSearchesKey = "probable-cause--consent";

  const totalStopsSeries = rowKeySet.has(totalStopsKey)
    ? getSeries(totalStopsKey)
    : null;

  const historicalData = totalStopsSeries
    ? {
        years,
        totalStops: totalStopsSeries,
        consentSearches: rowKeySet.has(consentSearchesKey)
          ? getSeries(consentSearchesKey)
          : null,
      }
    : null;

  const outcomeKeys = [
    "arrests",
    "citations",
    "stop-outcome--warning",
    "stop-outcome--no-action",
  ];

  if (!outcomeKeys.every((key) => rowKeySet.has(key))) {
    return { historicalData, historicalOutcomes: null };
  }

  const [outcomeArrests, outcomeCitations, outcomeWarnings, outcomeNoAction] =
    outcomeKeys.map((rowKey) => getSeries(rowKey));

  // Citation data is not available before 2004; filter outcomes to that range.
  const OUTCOMES_START_YEAR = 2004;
  const outcomeYears = years.filter((y) => y >= OUTCOMES_START_YEAR);
  const historicalOutcomes = {
    years: outcomeYears,
    citationStartYear: OUTCOMES_START_YEAR,
    data: outcomeYears.map((y) => {
      const idx = years.indexOf(y);
      const arrests = outcomeArrests[idx] ?? 0;
      const citations = outcomeCitations[idx] ?? 0;
      const warnings = outcomeWarnings[idx] ?? 0;
      const noAction = outcomeNoAction[idx] ?? 0;
      const totalStops = totalStopsSeries?.[idx] ?? 0;

      if (!totalStops) {
        return { year: y, arrests: 0, citations: 0, warnings: 0, noAction: 0 };
      }

      return {
        year: y,
        arrests: (arrests / totalStops) * 100,
        citations: (citations / totalStops) * 100,
        warnings: (warnings / totalStops) * 100,
        noAction: (noAction / totalStops) * 100,
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

// Fetch stats speculatively for the expected latest year so it runs in
// parallel with the manifest instead of waiting for it.
const EXPECTED_LATEST_YEAR = 2024;

export async function load({ fetch, url }) {
  const locale = url.pathname.split("/")[1] === "es" ? "es" : "en";
  const dataBaseUrl = import.meta.env.PUBLIC_DATA_BASE_URL ?? "";

  // Fetch everything in one parallel batch. statsData uses the expected year;
  // we only re-fetch if manifest says otherwise (rare).
  const [manifest, statewideYearSums, v1DownloadManifest, v2DownloadManifest, speculativeStats] = await Promise.all([
    fetchJson(fetch, "/dist/manifest.json", dataBaseUrl),
    fetchJson(fetch, "/dist/statewide_year_sums_subset.json", dataBaseUrl),
    // v1 manifest lives at the base CDN URL, not under the v2 release path
    (async () => {
      try {
        const r = await fetch(`${dataBaseUrl}/downloads/missouri_vsr_2020_2024_downloads_manifest.json`);
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    })(),
    // v2 manifest lives under the release path
    fetchJson(fetch, "/data/downloads/missouri_vsr_2000_2024_downloads_manifest.json", dataBaseUrl),
    fetchJson(fetch, `/dist/homepage_${EXPECTED_LATEST_YEAR}_stats.json`, dataBaseUrl),
  ]);

  const manifestYears = Array.isArray(manifest?.years) ? manifest.years : [];
  const latestYear = manifestYears.length
    ? Math.max(...manifestYears)
    : EXPECTED_LATEST_YEAR;

  const statsData = latestYear === EXPECTED_LATEST_YEAR
    ? speculativeStats
    : await fetchJson(fetch, `/dist/homepage_${latestYear}_stats.json`, dataBaseUrl);

  const { historicalData, historicalOutcomes } = buildHistoricalData(statewideYearSums);

  return {
    locale,
    manifest,
    statsData,
    historicalData,
    historicalOutcomes,
    v1DownloadManifest,
    v2DownloadManifest,
  };
}
