<script>
  import { createEventDispatcher } from "svelte";
  import AgencyRateScatter from "$lib/components/AgencyRateScatter.svelte";
  import * as m from "$lib/paraglide/messages";
  import { agency_yearly_data_heading } from "$lib/paraglide/messages";

  /** @type {string[]} */
  export let years = [];
  /** @type {string} */
  export let selectedYear = "";
  /** @type {string} */
  export let agencyName = "";
  /** @type {string[]} */
  export let excludeAgencies = [];
  /** @type {(value: number, opts?: { isMax: boolean }) => string} */
  export let formatPercentTick;

  const dispatch = createEventDispatcher();

  const onYearClick = (year) => dispatch("yearselect", { year, source: "bottom" });
</script>

<div class="mt-12">
  <div class="flex flex-col gap-3">
    <div
      role="tablist"
      aria-label={agency_yearly_data_heading()}
      class="mt-12 flex flex-wrap items-center gap-2"
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
          on:click={() => onYearClick(year)}
        >
          {year}
        </button>
      {/each}
    </div>
    <div class="relative left-1/2 mt-4 w-screen -translate-x-1/2 space-y-4 px-4 sm:px-6">
      <div class="grid gap-7 lg:gap-8 lg:grid-cols-3">
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title="Total stops vs citations"
          domainGroup="stops-citations"
          showMeanLines={true}
          xLabel={m?.agency_scatter_total_stops_label?.() ?? "Total stops"}
          yLabel={m?.agency_scatter_citations_label?.() ?? "Citations"}
          xMetricKey="rates-by-race--totals--all-stops"
          yMetricKey="rates-by-race--totals--citations"
          excludeAgencies={excludeAgencies}
          minStops={500}
          sizeByStops={true}
          stopsLabel={m?.agency_scatter_total_stops_label?.() ?? "Total stops"}
          minCount={50}
          minCountKey="rates-by-race--totals--citations"
          minCountMessage={m?.agency_scatter_min_citations_note?.() ?? "Requires at least 50 citations to display."}
          note={m?.agency_scatter_min_citations_note?.() ?? "Requires at least 50 citations to display."}
          xScaleType="log"
          yScaleType="log"
          minX={1}
          minY={1}
        />
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title="Non-white stops vs citations"
          domainGroup="stops-citations"
          showMeanLines={true}
          xLabel="Non-white total stops"
          yLabel="Non-white citations"
          xMetricKey="rates-by-race--totals--all-stops"
          yMetricKey="rates-by-race--totals--citations"
          xColumn="Non-white"
          yColumn="Non-white"
          excludeAgencies={excludeAgencies}
          minStops={500}
          sizeByStops={true}
          stopsColumn="Non-white"
          stopsLabel="Non-white total stops"
          minCount={25}
          minCountKey="rates-by-race--totals--citations"
          minCountColumn="Non-white"
          minCountMessage={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          note={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          xScaleType="log"
          yScaleType="log"
          minX={1}
          minY={1}
        />
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title="White stops vs citations"
          domainGroup="stops-citations"
          showMeanLines={true}
          xLabel="White total stops"
          yLabel="White citations"
          xMetricKey="rates-by-race--totals--all-stops"
          yMetricKey="rates-by-race--totals--citations"
          xColumn="White"
          yColumn="White"
          excludeAgencies={excludeAgencies}
          minStops={500}
          sizeByStops={true}
          stopsColumn="White"
          stopsLabel="White total stops"
          minCount={25}
          minCountKey="rates-by-race--totals--citations"
          minCountColumn="White"
          minCountMessage={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          note={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          xScaleType="log"
          yScaleType="log"
          minX={1}
          minY={1}
        />
      </div>
      <div class="grid gap-7 lg:gap-8 lg:grid-cols-3">
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title={m?.agency_scatter_citation_vs_arrest_heading?.() ?? "Citation rate vs arrest rate"}
          domainGroup="citation-arrest"
          showMeanLines={true}
          xLabel={m?.agency_scatter_citation_rate_label?.() ?? "Citation rate (%)"}
          yLabel={m?.agency_scatter_arrest_rate_label?.() ?? "Arrest rate (%)"}
          xMetricKey="rates-by-race--totals--citations-rate"
          yMetricKey="rates-by-race--totals--arrests-rate"
          excludeAgencies={excludeAgencies}
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
          minCountMessage={m?.agency_scatter_min_citations_note?.() ?? "Requires at least 50 citations to display."}
          note={m?.agency_scatter_min_citations_note?.() ?? "Requires at least 50 citations to display."}
          excludeExactValue={100}
          minX={0}
          minY={0}
          maxX={100}
          maxY={100}
        />
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title={m?.agency_scatter_citation_vs_arrest_nonwhite_heading?.() ?? "Non-white citation rate vs arrest rate"}
          domainGroup="citation-arrest"
          showMeanLines={true}
          xLabel={m?.agency_scatter_citation_rate_nonwhite_label?.() ?? "Non-white citation rate"}
          yLabel={m?.agency_scatter_arrest_rate_nonwhite_label?.() ?? "Non-white arrest rate"}
          xMetricKey="rates-by-race--totals--citations-rate"
          yMetricKey="rates-by-race--totals--arrests-rate"
          xColumn="Non-white"
          yColumn="Non-white"
          excludeAgencies={excludeAgencies}
          formatXAxisTick={formatPercentTick}
          formatYAxisTick={formatPercentTick}
          xCountKey="rates-by-race--totals--citations"
          yCountKey="rates-by-race--totals--arrests"
          xCountColumn="Non-white"
          yCountColumn="Non-white"
          xCountLabel={m?.agency_scatter_citations_nonwhite_label?.() ?? "Non-white citations"}
          yCountLabel={m?.agency_scatter_arrests_nonwhite_label?.() ?? "Non-white arrests"}
          minStops={500}
          sizeByStops={true}
          stopsColumn="Non-white"
          stopsLabel="Non-white total stops"
          minCount={25}
          minCountKey="rates-by-race--totals--citations"
          minCountColumn="Non-white"
          minCountMessage={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          note={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          excludeExactValue={100}
          minX={0}
          minY={0}
          maxX={100}
          maxY={100}
        />
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title={m?.agency_scatter_citation_vs_arrest_white_heading?.() ?? "White citation rate vs arrest rate"}
          domainGroup="citation-arrest"
          showMeanLines={true}
          xLabel={m?.agency_scatter_citation_rate_white_label?.() ?? "White citation rate"}
          yLabel={m?.agency_scatter_arrest_rate_white_label?.() ?? "White arrest rate"}
          xMetricKey="rates-by-race--totals--citations-rate"
          yMetricKey="rates-by-race--totals--arrests-rate"
          xColumn="White"
          yColumn="White"
          excludeAgencies={excludeAgencies}
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
          minCountMessage={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          note={m?.agency_scatter_min_citations_note_small?.() ?? "Requires at least 25 citations to display."}
          excludeExactValue={100}
          minX={0}
          minY={0}
          maxX={100}
          maxY={100}
        />
      </div>
      <div class="grid gap-7 lg:gap-8 lg:grid-cols-3">
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title={m?.agency_scatter_search_vs_hit_heading?.() ?? "Search rate vs contraband hit rate"}
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
          yCountLabel={m?.agency_scatter_contraband_hits_label?.() ?? "Contraband hits"}
          excludeAgencies={excludeAgencies}
          minStops={500}
          sizeByStops={true}
          stopsLabel={m?.agency_scatter_total_stops_label?.() ?? "Total stops"}
          minCount={25}
          minCountKey="rates-by-race--totals--searches"
          excludeAboveX={50}
          minCountMessage={m?.agency_scatter_min_searches_note?.() ?? "Requires at least 25 searches to display."}
          note={m?.agency_scatter_min_searches_note?.() ?? "Requires at least 25 searches to display."}
        />
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title={m?.agency_scatter_search_vs_hit_nonwhite_heading?.() ?? "Non-white search rate vs contraband hit rate"}
          domainGroup="hits-searches"
          showMeanLines={true}
          xLabel={m?.agency_scatter_search_rate_nonwhite_label?.() ?? "Non-white search rate"}
          yLabel={m?.agency_scatter_hit_rate_nonwhite_label?.() ?? "Non-white hit rate"}
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
          xCountLabel={m?.agency_scatter_searches_nonwhite_label?.() ?? "Non-white searches"}
          yCountLabel={m?.agency_scatter_contraband_hits_nonwhite_label?.() ?? "Non-white contraband hits"}
          excludeAgencies={excludeAgencies}
          minStops={500}
          sizeByStops={true}
          stopsColumn="Non-white"
          stopsLabel="Non-white total stops"
          minCount={25}
          minCountKey="rates-by-race--totals--searches"
          minCountColumn="Non-white"
          excludeAboveX={50}
          minCountMessage={m?.agency_scatter_min_searches_note_small?.() ?? "Requires at least 25 searches to display."}
          note={m?.agency_scatter_min_searches_note_small?.() ?? "Requires at least 25 searches to display."}
        />
        <AgencyRateScatter
          {selectedYear}
          {agencyName}
          title={m?.agency_scatter_search_vs_hit_white_heading?.() ?? "White search rate vs contraband hit rate"}
          domainGroup="hits-searches"
          showMeanLines={true}
          xLabel={m?.agency_scatter_search_rate_white_label?.() ?? "White search rate"}
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
          yCountLabel={m?.agency_scatter_contraband_hits_white_label?.() ?? "White contraband hits"}
          excludeAgencies={excludeAgencies}
          minStops={500}
          sizeByStops={true}
          stopsColumn="White"
          stopsLabel="White total stops"
          minCount={25}
          minCountKey="rates-by-race--totals--searches"
          minCountColumn="White"
          excludeAboveX={50}
          minCountMessage={m?.agency_scatter_min_searches_note_small?.() ?? "Requires at least 25 searches to display."}
          note={m?.agency_scatter_min_searches_note_small?.() ?? "Requires at least 25 searches to display."}
        />
      </div>
    </div>
  </div>
</div>
