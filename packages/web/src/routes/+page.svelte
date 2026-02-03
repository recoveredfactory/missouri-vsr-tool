<script>
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import AgencyRateScatter from "$lib/components/AgencyRateScatter.svelte";
  import * as m from "$lib/paraglide/messages";
  import { onMount } from "svelte";

  export let data;

  let statsData = null;
  let historicalOutcomes = null; // { years: [], data: { citations: [], arrests: [], searches: [], noAction: [] } }
  let historicalByRace = null; // { years: [], data: { White: [], Black: [], Hispanic: [] } }

  // Tooltip state
  let tooltip = { show: false, x: 0, y: 0, content: "" };

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  function showTooltip(event, content) {
    const el = event.currentTarget || event.target;
    const rect = el.getBoundingClientRect();
    tooltip = {
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      content
    };
  }

  function hideTooltip() {
    tooltip = { ...tooltip, show: false };
  }

  function handleDownloadClick(label, href) {
    trackEvent("download_click", {
      label,
      href,
    });
  }

  onMount(async () => {
    try {
      // Fetch 2024 stats data
      const statsResponse = await fetch("/data/homepage_2024_stats.json");
      if (statsResponse.ok) {
        statsData = await statsResponse.json();
      }
    } catch (error) {
      console.error("Failed to load stats data:", error);
    }

    try {
      // Fetch metric data for historical charts
      const metricResponse = await fetch("/data/dist/metric_year_subset.json");
      if (metricResponse.ok) {
        const metricData = await metricResponse.json();
        // Row format: [agency_index, year_index, Total, White, Black, ...]
        const totalColOffset = 2;

        // Build historical statewide data for slope charts
        const years = metricData.years;
        const whiteColOffset = 3;
        const blackColOffset = 4;
        const hispanicColOffset = 5;

        // Aggregate statewide totals by year
        const statewideByYear = {};
        years.forEach((year, yearIdx) => {
          statewideByYear[year] = {
            stops: 0, citations: 0, arrests: 0, searches: 0,
            White: 0, Black: 0, Hispanic: 0
          };
        });

        // Sum all-stops by year and race
        (metricData.rows["rates-by-race--totals--all-stops"] || []).forEach(row => {
          const yearIdx = row[1];
          const year = years[yearIdx];
          if (statewideByYear[year]) {
            statewideByYear[year].stops += row[totalColOffset] || 0;
            statewideByYear[year].White += row[whiteColOffset] || 0;
            statewideByYear[year].Black += row[blackColOffset] || 0;
            statewideByYear[year].Hispanic += row[hispanicColOffset] || 0;
          }
        });

        // Sum citations by year
        (metricData.rows["rates-by-race--totals--citations"] || []).forEach(row => {
          const yearIdx = row[1];
          const year = years[yearIdx];
          if (statewideByYear[year]) {
            statewideByYear[year].citations += row[totalColOffset] || 0;
          }
        });

        // Sum arrests by year
        (metricData.rows["rates-by-race--totals--arrests"] || []).forEach(row => {
          const yearIdx = row[1];
          const year = years[yearIdx];
          if (statewideByYear[year]) {
            statewideByYear[year].arrests += row[totalColOffset] || 0;
          }
        });

        // Sum searches by year
        (metricData.rows["rates-by-race--totals--searches"] || []).forEach(row => {
          const yearIdx = row[1];
          const year = years[yearIdx];
          if (statewideByYear[year]) {
            statewideByYear[year].searches += row[totalColOffset] || 0;
          }
        });

        // Build historical outcomes data as PERCENTAGES of total stops
        const sortedYears = years.slice().sort((a, b) => a - b);
        historicalOutcomes = {
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

        // Build historical by race data as PERCENTAGES of total stops (including Other)
        historicalByRace = {
          years: sortedYears,
          data: sortedYears.map(year => {
            const stops = statewideByYear[year]?.stops || 1;
            const white = ((statewideByYear[year]?.White || 0) / stops) * 100;
            const black = ((statewideByYear[year]?.Black || 0) / stops) * 100;
            const hispanic = ((statewideByYear[year]?.Hispanic || 0) / stops) * 100;
            const other = Math.max(0, 100 - white - black - hispanic);
            return {
              year,
              White: white,
              Black: black,
              Hispanic: hispanic,
              Other: other
            };
          })
        };
      }
    } catch (error) {
      console.error("Failed to load scatter data:", error);
    }
  });

  const formatStops = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return "0";
    if (numeric >= 1000000) {
      const m = numeric / 1000000;
      return `${m.toFixed(1)}M`;
    }
    if (numeric >= 1000) {
      const k = numeric / 1000;
      return `${k.toFixed(1)}K`;
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
  };

</script>

<svelte:head>
  <title>{m.home_hero_headline()}</title>
</svelte:head>

<StickyHeader agencies={data.agencies} />

<main class="min-h-screen bg-white">
  <!-- Hero Section -->
  <section class="bg-white px-6 py-12">
    <div class="mx-auto max-w-3xl text-center">
      <h1 class="text-4xl font-bold text-slate-900 md:text-5xl">
        {m.home_hero_headline()}
      </h1>
      <p class="mt-4 text-lg leading-relaxed text-slate-700">
        {m.home_why_text()}
      </p>
    </div>
  </section>

  <!-- Highlights Grid -->
  <section class="border-t border-slate-200 bg-slate-50 py-12">
    <div class="mx-auto max-w-6xl px-6">
      <h2 class="mb-8 text-center text-3xl font-bold text-slate-900">
        {m.home_highlights_heading()}
      </h2>

      <div class="flex flex-col gap-6">
        <!-- Box 1: Population vs Stops Comparison -->
        <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
          <div class="mb-3 sm:mb-4">
            <h3 class="text-lg sm:text-xl font-bold text-slate-900">
              Black drivers were 17% of stops, but only 11% of Missouri's population
            </h3>
            <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
              Compare who lives in Missouri vs. who gets stopped by police.
            </p>
          </div>

          {#if statsData}
            {@const raceColors = { White: "#5fad56", Black: "#f2c14e", Hispanic: "#f78154", Other: "#4d9078" }}
            {@const population = { White: 79.1, Black: 11.8, Hispanic: 4.4, Other: 4.7 }}
            {@const totalStops = statsData.total_stops}
            {@const stopsData = {
              White: (statsData.by_race.all_stops.White / totalStops) * 100,
              Black: (statsData.by_race.all_stops.Black / totalStops) * 100,
              Hispanic: (statsData.by_race.all_stops.Hispanic / totalStops) * 100,
              Other: 100 - (statsData.by_race.all_stops.White / totalStops) * 100 - (statsData.by_race.all_stops.Black / totalStops) * 100 - (statsData.by_race.all_stops.Hispanic / totalStops) * 100
            }}
            {@const raceOrder = ["White", "Black", "Hispanic", "Other"]}

            <div class="flex-1 flex flex-col justify-center space-y-4">
              <!-- Missouri Population Bar -->
              <div>
                <div class="flex items-center justify-between mb-1 sm:mb-2">
                  <span class="text-xs sm:text-sm font-semibold text-slate-700">Missouri Population</span>
                  <span class="text-[10px] sm:text-xs text-slate-500">6.2M residents</span>
                </div>
                <div class="relative h-8 sm:h-10 w-full flex rounded overflow-hidden">
                  {#each raceOrder as race}
                    {@const width = population[race]}
                    <div
                      class="h-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                      style="width: {width}%; background-color: {raceColors[race]};"
                      on:mouseenter={(e) => showTooltip(e, `${race}: ${population[race].toFixed(1)}% of population`)}
                      on:mouseleave={hideTooltip}
                      role="img"
                      aria-label="{race} population"
                    >
                      {#if width > 10}
                        <span class="text-[9px] sm:text-[10px] font-bold text-white">{Math.round(width)}%</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Traffic Stops Bar -->
              <div>
                <div class="flex items-center justify-between mb-1 sm:mb-2">
                  <span class="text-xs sm:text-sm font-semibold text-slate-700">Traffic Stops (2024)</span>
                  <span class="text-[10px] sm:text-xs text-slate-500">{formatStops(totalStops)} stops</span>
                </div>
                <div class="relative h-8 sm:h-10 w-full flex rounded overflow-hidden">
                  {#each raceOrder as race}
                    {@const width = stopsData[race]}
                    <div
                      class="h-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                      style="width: {width}%; background-color: {raceColors[race]};"
                      on:mouseenter={(e) => showTooltip(e, `${race}: ${width.toFixed(1)}% of stops`)}
                      on:mouseleave={hideTooltip}
                      role="img"
                      aria-label="{race} stops"
                    >
                      {#if width > 10}
                        <span class="text-[9px] sm:text-[10px] font-bold text-white">{Math.round(width)}%</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Disparity callout -->
              <div class="bg-slate-50 rounded p-2 border border-slate-200 text-xs">
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded" style="background-color: {raceColors.Black}"></span>
                  <span class="text-slate-600">Black: <strong class="text-slate-900">{stopsData.Black.toFixed(1)}%</strong> stops vs <strong class="text-slate-900">{population.Black}%</strong> population</span>
                </span>
              </div>

              <!-- Legend -->
              <div class="flex flex-wrap justify-center gap-3 shrink-0">
                {#each raceOrder as race}
                  <span class="flex items-center gap-1">
                    <span class="w-2.5 h-2.5 rounded-sm" style="background-color: {raceColors[race]}"></span>
                    <span class="text-[10px] text-slate-600">{race}</span>
                  </span>
                {/each}
              </div>
            </div>
          {:else}
            <div class="flex h-[300px] items-center justify-center">
              <span class="text-sm text-slate-400">Loading data...</span>
            </div>
          {/if}
        </div>

        <!-- Box 2: Search Rate vs Hit Rate Scatter -->
        <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
          <div class="mb-3 sm:mb-4">
            <h3 class="text-lg sm:text-xl font-bold text-slate-900">
              Officers searched 4.8% of stopped drivers, but found contraband in only 1 in 5
            </h3>
            <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
              Each dot is an agency. Higher search rates don't mean more contraband found.
            </p>
          </div>

          <AgencyRateScatter
            selectedYear={2024}
            title=""
            xLabel="Search Rate (%)"
            yLabel="Hit Rate (%)"
            xMetricKey="rates-by-race--totals--searches-rate"
            yMetricKey="rates-by-race--totals--contraband-rate"
            xColumn="Total"
            yColumn="Total"
            xCountKey="rates-by-race--totals--searches"
            yCountKey="rates-by-race--totals--contraband"
            xCountColumn="Total"
            yCountColumn="Total"
            sizeByStops={true}
            showMeanLines={true}
            minStops={100}
            excludeAboveX={50}
          />
        </div>

        <!-- Box 3: Historical Outcomes - Slope Chart -->
        <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
          <div class="mb-3 sm:mb-4">
            <h3 class="text-lg sm:text-xl font-bold text-slate-900">
              About half of all traffic stops result in no formal action
            </h3>
            <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
              Citations are ~40%, while arrests and searches stay below 5%.
            </p>
          </div>

          {#if historicalOutcomes && historicalOutcomes.data.length > 0}
            {@const outcomeColors = { citations: "#5fad56", arrests: "#f2c14e", searches: "#f78154", noAction: "#4d9078" }}
            {@const outcomeLabels = { citations: "Citations", arrests: "Arrests", searches: "Searches", noAction: "No Action" }}
            {@const maxY = Math.ceil(Math.max(...historicalOutcomes.data.flatMap(d => [d.citations, d.arrests, d.searches, d.noAction])) / 10) * 10}
            {@const years = historicalOutcomes.years}
            {@const padding = { top: 20, right: 20, bottom: 35, left: 45 }}
            {@const width = 280}
            {@const height = 180}
            <div class="flex flex-col">
              <svg viewBox="0 0 {width + padding.left + padding.right} {height + padding.top + padding.bottom}" class="w-full max-w-lg mx-auto" style="height: 260px;">
                <!-- Grid lines -->
                {#each [0, 0.25, 0.5, 0.75, 1] as tick}
                  <line x1={padding.left} y1={padding.top + (1-tick) * height} x2={padding.left + width} y2={padding.top + (1-tick) * height} stroke="#e2e8f0" stroke-width="0.5" />
                {/each}

                <!-- Axes -->
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + height} stroke="#94a3b8" stroke-width="1" />
                <line x1={padding.left} y1={padding.top + height} x2={padding.left + width} y2={padding.top + height} stroke="#94a3b8" stroke-width="1" />

                <!-- Y-axis labels (percentages) -->
                <text x={padding.left - 8} y={padding.top + 4} text-anchor="end" font-size="9" fill="#64748b">{maxY.toFixed(0)}%</text>
                <text x={padding.left - 8} y={padding.top + height/2 + 3} text-anchor="end" font-size="9" fill="#64748b">{(maxY/2).toFixed(0)}%</text>
                <text x={padding.left - 8} y={padding.top + height + 3} text-anchor="end" font-size="9" fill="#64748b">0%</text>

                <!-- X-axis year labels -->
                {#each years as year, i}
                  <text x={padding.left + (i / (years.length - 1)) * width} y={padding.top + height + 16} text-anchor="middle" font-size="9" fill="#64748b">{year}</text>
                {/each}

                <!-- Lines and points for each outcome -->
                {#each ["citations", "arrests", "searches", "noAction"] as outcome}
                  <!-- Line - thinner -->
                  <polyline
                    fill="none"
                    stroke={outcomeColors[outcome]}
                    stroke-width="1.5"
                    points={historicalOutcomes.data.map((d, i) => `${padding.left + (i / (years.length - 1)) * width},${padding.top + (1 - d[outcome] / maxY) * height}`).join(" ")}
                  />
                  <!-- Points with tooltips -->
                  {#each historicalOutcomes.data as d, i}
                    <g
                      class="cursor-pointer"
                      on:mouseenter={(e) => showTooltip(e, `${outcomeLabels[outcome]}: ${d[outcome].toFixed(1)}% (${d.year})`)}
                      on:mouseleave={hideTooltip}
                      role="img"
                      aria-label="{outcomeLabels[outcome]} {d.year}"
                    >
                      <circle
                        cx={padding.left + (i / (years.length - 1)) * width}
                        cy={padding.top + (1 - d[outcome] / maxY) * height}
                        r="8"
                        fill="transparent"
                      />
                      <circle
                        cx={padding.left + (i / (years.length - 1)) * width}
                        cy={padding.top + (1 - d[outcome] / maxY) * height}
                        r="3"
                        fill={outcomeColors[outcome]}
                        class="pointer-events-none"
                      />
                    </g>
                  {/each}
                {/each}
              </svg>

              <!-- Legend -->
              <div class="flex flex-wrap justify-center gap-4 mt-3">
                {#each ["citations", "arrests", "searches", "noAction"] as outcome}
                  <span class="flex items-center gap-1.5">
                    <span class="w-3 h-0.5" style="background-color: {outcomeColors[outcome]}"></span>
                    <span class="text-xs text-slate-600">{outcomeLabels[outcome]}</span>
                  </span>
                {/each}
              </div>
            </div>
          {:else}
            <div class="flex h-[300px] items-center justify-center">
              <span class="text-sm text-slate-400">Loading historical data...</span>
            </div>
          {/if}
        </div>

        <!-- Box 4: Historical Stops by Race - Line Chart -->
        <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
          <div class="mb-3 sm:mb-4">
            <h3 class="text-lg sm:text-xl font-bold text-slate-900">
              Racial breakdown of stops has stayed stable over time
            </h3>
            <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
              Black drivers consistently represent ~17% of stops despite being 11% of population.
            </p>
          </div>

          {#if historicalByRace && historicalByRace.data.length > 0}
            {@const raceColors = { White: "#5fad56", Black: "#f2c14e", Hispanic: "#f78154", Other: "#4d9078" }}
            {@const raceOrder = ["White", "Black", "Hispanic", "Other"]}
            {@const years = historicalByRace.years}
            {@const maxY = Math.ceil(Math.max(...historicalByRace.data.flatMap(d => [d.White, d.Black, d.Hispanic, d.Other])) / 10) * 10}
            {@const padding = { top: 20, right: 20, bottom: 35, left: 45 }}
            {@const width = 280}
            {@const height = 180}
            <div class="flex flex-col">
              <svg viewBox="0 0 {width + padding.left + padding.right} {height + padding.top + padding.bottom}" class="w-full max-w-lg mx-auto" style="height: 260px;">
                <!-- Grid lines -->
                {#each [0, 0.25, 0.5, 0.75, 1] as tick}
                  <line x1={padding.left} y1={padding.top + (1-tick) * height} x2={padding.left + width} y2={padding.top + (1-tick) * height} stroke="#e2e8f0" stroke-width="0.5" />
                {/each}

                <!-- Axes -->
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + height} stroke="#94a3b8" stroke-width="1" />
                <line x1={padding.left} y1={padding.top + height} x2={padding.left + width} y2={padding.top + height} stroke="#94a3b8" stroke-width="1" />

                <!-- Y-axis labels (percentages) -->
                <text x={padding.left - 8} y={padding.top + 4} text-anchor="end" font-size="9" fill="#64748b">{maxY.toFixed(0)}%</text>
                <text x={padding.left - 8} y={padding.top + height/2 + 3} text-anchor="end" font-size="9" fill="#64748b">{(maxY/2).toFixed(0)}%</text>
                <text x={padding.left - 8} y={padding.top + height + 3} text-anchor="end" font-size="9" fill="#64748b">0%</text>

                <!-- X-axis year labels -->
                {#each years as year, i}
                  <text x={padding.left + (i / (years.length - 1)) * width} y={padding.top + height + 16} text-anchor="middle" font-size="9" fill="#64748b">{year}</text>
                {/each}

                <!-- Lines and points for each race -->
                {#each raceOrder as race}
                  <!-- Line -->
                  <polyline
                    fill="none"
                    stroke={raceColors[race]}
                    stroke-width="1.5"
                    points={historicalByRace.data.map((d, i) => `${padding.left + (i / (years.length - 1)) * width},${padding.top + (1 - d[race] / maxY) * height}`).join(" ")}
                  />
                  <!-- Points with tooltips -->
                  {#each historicalByRace.data as d, i}
                    <g
                      class="cursor-pointer"
                      on:mouseenter={(e) => showTooltip(e, `${race}: ${d[race].toFixed(1)}% (${d.year})`)}
                      on:mouseleave={hideTooltip}
                      role="img"
                      aria-label="{race} {d.year}"
                    >
                      <circle
                        cx={padding.left + (i / (years.length - 1)) * width}
                        cy={padding.top + (1 - d[race] / maxY) * height}
                        r="8"
                        fill="transparent"
                      />
                      <circle
                        cx={padding.left + (i / (years.length - 1)) * width}
                        cy={padding.top + (1 - d[race] / maxY) * height}
                        r="3"
                        fill={raceColors[race]}
                        class="pointer-events-none"
                      />
                    </g>
                  {/each}
                {/each}
              </svg>

              <!-- Legend -->
              <div class="flex flex-wrap justify-center gap-4 mt-3">
                {#each raceOrder as race}
                  <span class="flex items-center gap-1.5">
                    <span class="w-3 h-0.5" style="background-color: {raceColors[race]}"></span>
                    <span class="text-xs text-slate-600">{race}</span>
                  </span>
                {/each}
              </div>
            </div>
          {:else}
            <div class="flex h-[300px] items-center justify-center">
              <span class="text-sm text-slate-400">Loading historical data...</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <!-- Download Section -->
  <section id="download" class="border-t border-slate-200 bg-white py-12">
    <div class="mx-auto max-w-4xl px-6">
      <h2 class="mb-6 text-center text-3xl font-bold text-slate-900">
        {m.home_toc_download()}
      </h2>
      <p class="mb-8 text-center text-lg text-slate-700">
        Download the complete Missouri Vehicle Stop Report dataset for your own analysis.
      </p>

      <div class="grid gap-6 md:grid-cols-2">
        <div class="rounded-lg border-2 border-slate-200 bg-slate-50 p-6">
          <h3 class="mb-3 text-xl font-bold text-slate-900">
            Agency Index
          </h3>
          <p class="mb-4 text-slate-600">
            Complete list of all law enforcement agencies in Missouri with summary statistics.
          </p>
          <a
            href="/data/dist/agency_index.json"
            download
            on:click={() => handleDownloadClick("agency_index_json", "/data/dist/agency_index.json")}
            class="inline-block rounded-lg bg-[#2c9166] px-6 py-3 font-semibold text-white no-underline transition-colors hover:bg-[#216d4d]"
          >
            Download JSON
          </a>
        </div>

        <div class="rounded-lg border-2 border-slate-200 bg-slate-50 p-6">
          <h3 class="mb-3 text-xl font-bold text-slate-900">
            Full Dataset
          </h3>
          <p class="mb-4 text-slate-600">
            Raw vehicle stop records by agency and year, including demographics and outcomes.
          </p>
          <a
            href="/data/dist/agency_index.json"
            download
            on:click={() => handleDownloadClick("full_dataset", "/data/dist/agency_index.json")}
            class="inline-block rounded-lg border-2 border-[#2c9166] bg-white px-6 py-3 font-semibold text-[#2c9166] no-underline transition-colors hover:bg-green-50"
          >
            Coming soon
          </a>
        </div>
      </div>

      <div class="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h3 class="mb-3 font-semibold text-slate-900">
          Data format and usage
        </h3>
        <ul class="space-y-2 text-sm text-slate-600">
          <li>• Data is provided in JSON format</li>
          <li>• Includes agency metadata, stop counts, demographics, and detailed metrics</li>
          <li>• Free to use for journalism, research, and public interest projects</li>
          <li>• Attribution appreciated when using this data</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- About the Data -->
  <section id="about" class="border-t border-slate-200 bg-slate-50 py-12">
    <div class="mx-auto max-w-4xl px-6">
      <div class="content">
        {@html data.aboutDataHtml}
      </div>

      <div class="mt-12 rounded-lg border-2 border-green-100 bg-green-50 p-6">
        <p class="mb-4 text-lg font-semibold text-slate-900">
          {m.home_footer_cta()}
        </p>
        <a
          id="donate"
          href="mailto:contact@example.com"
          class="inline-block rounded-lg bg-[#2c9166] px-6 py-3 font-semibold text-white no-underline transition-colors hover:bg-[#216d4d]"
        >
          {m.home_footer_contact()}
        </a>
      </div>
    </div>
  </section>
</main>

<!-- Global tooltip -->
{#if tooltip.show}
  <div
    class="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-slate-800 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full whitespace-nowrap"
    style="left: {tooltip.x}px; top: {tooltip.y}px;"
  >
    {tooltip.content}
    <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
  </div>
{/if}
