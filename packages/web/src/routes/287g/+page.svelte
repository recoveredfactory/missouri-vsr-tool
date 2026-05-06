<script lang="ts">
  import { getLocale } from "$lib/paraglide/runtime";
  import Sparkline from "$lib/components/Sparkline.svelte";
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import {
    program_287g_page_title,
    program_287g_page_heading,
    program_287g_page_summary,
    program_287g_chart_total_stops_label,
    program_287g_chart_hispanic_share_label,
    program_287g_chart_arrest_rate_label,
    program_287g_chart_no_data,
    program_287g_totals_label,
    program_287g_totals_all_stops,
    program_287g_totals_hispanic_stops,
    program_287g_totals_share_of_state,
    program_287g_breakdown_heading,
    program_287g_breakdown_row_stops,
    program_287g_breakdown_row_search_rate,
    program_287g_breakdown_row_arrest_rate,
    program_287g_breakdown_row_residency,
    program_287g_breakdown_row_nonresidency,
    agency_287g_description_link,
    agency_287g_description_post,
    agency_287g_support_type_label,
    agency_287g_signed_label,
    agency_287g_moa_link,
  } from "$lib/paraglide/messages";
  import { RACE_COLUMNS, type RaceBreakdown } from "./+page";

  /** @type {import('./$types').PageData} */
  export let data;

  const WIKIPEDIA_287G_URL =
    "https://en.wikipedia.org/wiki/Immigration_and_Nationality_Act_Section_287(g)";

  const SPARKLINE_YEAR_WINDOW = 10;

  $: locale = getLocale() || "en";
  $: localeBase = `/${locale}`;

  const integerFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });
  const percentFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const integerPercentFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });

  const formatLongDate = (value: string | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    try {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  };

  const formatInteger = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? integerFormatter.format(value) : null;

  const formatPercent = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? `${percentFormatter.format(value)}%`
      : null;

  const recentValues = (series: Array<{ year: number; value: number | null }>) =>
    series.slice(-SPARKLINE_YEAR_WINDOW).map((p) => p.value);

  const formatBreakdownInteger = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? integerFormatter.format(Math.round(value))
      : "—";

  const formatBreakdownPercent = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? `${percentFormatter.format(value)}%`
      : "—";

  $: countDisplay = integerFormatter.format(data.participants.length);
  $: anchorYear = data.latestYearAnchor;
  $: totalStopsDisplay = formatInteger(data.totalStopsLatestSum) ?? "—";
  $: totalHispanicStopsDisplay = formatInteger(data.totalHispanicStopsLatestSum) ?? "—";
  $: statewideShare =
    data.statewideTotalStopsLatest > 0
      ? (data.totalStopsLatestSum / data.statewideTotalStopsLatest) * 100
      : null;
  $: statewideShareDisplay =
    statewideShare !== null
      ? `${integerPercentFormatter.format(Math.max(0, statewideShare))}%`
      : null;
</script>

<svelte:head>
  <title>{program_287g_page_title()}</title>
</svelte:head>

<StickyHeader />

<main id="main-content" class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
  <h1 class="text-3xl font-bold text-slate-900 sm:text-4xl">
    {program_287g_page_heading()}
  </h1>

  <p class="mt-4 text-base leading-relaxed text-slate-700">
    <a class="underline" href={WIKIPEDIA_287G_URL} target="_blank" rel="noreferrer"
      >{agency_287g_description_link()}</a
    >{agency_287g_description_post()}
  </p>

  <p class="mt-3 text-base text-slate-700">
    {program_287g_page_summary({
      count: countDisplay,
      date: formatLongDate(data.snapshotDate),
    })}
  </p>

  {#if data.totalStopsLatestSum > 0 && anchorYear !== null}
    <div class="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
      <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {program_287g_totals_label({ year: anchorYear, count: countDisplay })}
      </p>
      <p class="mt-1 text-base text-slate-900">
        {program_287g_totals_all_stops({ stops: totalStopsDisplay })}
        <span class="text-slate-400">·</span>
        {program_287g_totals_hispanic_stops({ stops: totalHispanicStopsDisplay })}
      </p>
      {#if statewideShareDisplay}
        <p class="mt-1 text-sm text-slate-600">
          {program_287g_totals_share_of_state({
            pct: statewideShareDisplay,
            year: anchorYear,
          })}
        </p>
      {/if}
    </div>
  {/if}

  <div class="mt-8 space-y-6">
    {#each data.participants as participant (participant.agency_slug)}
      {@const totalStopsValues = recentValues(participant.totalStopsSeries)}
      {@const hispanicShareValues = recentValues(participant.hispanicShareSeries)}
      {@const arrestRateValues = recentValues(participant.hispanicArrestRateSeries)}
      {@const latestTotalStops = formatInteger(participant.latestTotalStops)}
      {@const latestHispanicShare = formatPercent(participant.latestHispanicShare)}
      {@const latestHispanicArrestRate = formatPercent(participant.latestHispanicArrestRate)}
      {@const latestYear = participant.latestYear}
      {@const stopsByRace = participant.latestStopsByRace as RaceBreakdown}
      {@const searchByRace = participant.latestSearchRateByRace as RaceBreakdown}
      {@const arrestByRace = participant.latestArrestRateByRace as RaceBreakdown}

      <article class="rounded-lg border border-slate-200 bg-white p-5">
        <header>
          <h2 class="text-lg font-semibold text-slate-900">
            <a
              class="text-emerald-900 underline-offset-2 hover:underline"
              href={`${localeBase}/agency/${participant.agency_slug}`}
            >
              {participant.canonical_name}
            </a>
          </h2>
          {#if participant.city || participant.county || participant.agency_type}
            <p class="mt-0.5 text-xs text-slate-500">
              {[participant.agency_type, participant.city, participant.county]
                .filter(Boolean)
                .join(" · ")}
            </p>
          {/if}
        </header>

        <ul class="mt-3 space-y-1 text-sm text-slate-700">
          {#each participant.agreements as agreement}
            <li>
              {#if agreement.support_type}
                <span class="font-medium">{agency_287g_support_type_label()}:</span>
                {" "}{agreement.support_type}
              {/if}
              {#if agreement.signed_date}
                <span class="ml-2 font-medium">{agency_287g_signed_label()}:</span>
                {" "}{formatLongDate(agreement.signed_date)}
              {/if}
              {#if agreement.moa_url}
                <a
                  class="ml-2 underline"
                  href={agreement.moa_url}
                  target="_blank"
                  rel="noreferrer">{agency_287g_moa_link()}</a
                >
              {/if}
            </li>
          {/each}
        </ul>

        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {program_287g_chart_total_stops_label()}
              </span>
              <span class="text-sm font-semibold text-slate-900">
                {latestTotalStops ?? program_287g_chart_no_data()}
                {#if latestTotalStops && latestYear}
                  <span class="text-[10px] font-normal text-slate-400">{latestYear}</span>
                {/if}
              </span>
            </div>
            <Sparkline values={totalStopsValues} stroke="#1b613c" width={200} height={40} strokeWidth={1.5} />
          </div>
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {program_287g_chart_hispanic_share_label()}
              </span>
              <span class="text-sm font-semibold text-slate-900">
                {latestHispanicShare ?? program_287g_chart_no_data()}
                {#if latestHispanicShare && latestYear}
                  <span class="text-[10px] font-normal text-slate-400">{latestYear}</span>
                {/if}
              </span>
            </div>
            <Sparkline values={hispanicShareValues} stroke="#7c2d12" width={200} height={40} strokeWidth={1.5} />
          </div>
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {program_287g_chart_arrest_rate_label()}
              </span>
              <span class="text-sm font-semibold text-slate-900">
                {latestHispanicArrestRate ?? program_287g_chart_no_data()}
                {#if latestHispanicArrestRate && latestYear}
                  <span class="text-[10px] font-normal text-slate-400">{latestYear}</span>
                {/if}
              </span>
            </div>
            <Sparkline values={arrestRateValues} stroke="#1e3a8a" width={200} height={40} strokeWidth={1.5} />
          </div>
        </div>

        {#if latestYear}
          <div class="mt-5">
            <h3 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {program_287g_breakdown_heading({ year: latestYear })}
            </h3>
            <div class="mt-2 -mx-5 overflow-x-auto px-5">
              <table class="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr class="border-b border-slate-200 text-left text-slate-500">
                    <th class="py-1 pr-3 text-[10px] font-semibold uppercase tracking-wider"></th>
                    {#each RACE_COLUMNS as col}
                      <th class="py-1 pl-3 text-right text-[10px] font-semibold uppercase tracking-wider">{col}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-slate-100">
                    <td class="py-1 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_stops()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-1 pl-3 text-right tabular-nums text-slate-900">
                        {formatBreakdownInteger(stopsByRace[col])}
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100">
                    <td class="py-1 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_search_rate()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-1 pl-3 text-right tabular-nums text-slate-900">
                        {formatBreakdownPercent(searchByRace[col])}
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100">
                    <td class="py-1 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_arrest_rate()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-1 pl-3 text-right tabular-nums text-slate-900">
                        {formatBreakdownPercent(arrestByRace[col])}
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100">
                    <td class="py-1 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_residency()}</td>
                    <td class="py-1 pl-3 text-right tabular-nums text-slate-900">
                      {formatBreakdownInteger(participant.latestResidentStops)}
                    </td>
                    <td colspan={RACE_COLUMNS.length - 1}></td>
                  </tr>
                  <tr>
                    <td class="py-1 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_nonresidency()}</td>
                    <td class="py-1 pl-3 text-right tabular-nums text-slate-900">
                      {formatBreakdownInteger(participant.latestNonResidentStops)}
                    </td>
                    <td colspan={RACE_COLUMNS.length - 1}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <!-- Editorial slot: per-agency writeup goes here. Will hook up to a
             writeups source later (e.g., /data/287g_writeups.json keyed by
             agency_slug). -->
        <aside class="mt-5 min-h-[1px] border-t border-slate-100 pt-3 text-sm text-slate-500"></aside>
      </article>
    {/each}
  </div>
</main>
