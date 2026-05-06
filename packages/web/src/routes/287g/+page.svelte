<script lang="ts">
  import { getLocale } from "$lib/paraglide/runtime";
  import Sparkline from "$lib/components/Sparkline.svelte";
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import {
    program_287g_page_title,
    program_287g_page_heading,
    program_287g_page_summary,
    program_287g_page_back_link,
    program_287g_chart_total_stops_label,
    program_287g_chart_hispanic_share_label,
    program_287g_chart_arrest_rate_label,
    program_287g_chart_no_data,
    program_287g_totals_label,
    program_287g_totals_stops,
    program_287g_totals_hispanic_stops,
    agency_287g_description_link,
    agency_287g_description_post,
    agency_287g_support_type_label,
    agency_287g_signed_label,
    agency_287g_moa_link,
  } from "$lib/paraglide/messages";

  /** @type {import('./$types').PageData} */
  export let data;

  const WIKIPEDIA_287G_URL =
    "https://en.wikipedia.org/wiki/Immigration_and_Nationality_Act_Section_287(g)";

  $: locale = getLocale() || "en";
  $: localeBase = `/${locale}`;

  const integerFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });
  const percentFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
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

  $: countDisplay = integerFormatter.format(data.participants.length);
  $: totalStopsDisplay = formatInteger(data.totalStopsLatestSum) ?? "—";
  $: totalHispanicStopsDisplay =
    formatInteger(data.totalHispanicStopsLatestSum) ?? "—";
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

  {#if data.totalStopsLatestSum > 0}
    <div class="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
      <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {program_287g_totals_label()}
      </p>
      <p class="mt-1 text-base text-slate-900">
        {program_287g_totals_stops({ stops: totalStopsDisplay })}
        <span class="text-slate-500">·</span>
        {program_287g_totals_hispanic_stops({ stops: totalHispanicStopsDisplay })}
      </p>
    </div>
  {/if}

  <div class="mt-8 space-y-6">
    {#each data.participants as participant (participant.agency_slug)}
      {@const totalStopsValues = participant.totalStopsSeries.map((p: { value: number | null }) => p.value)}
      {@const hispanicShareValues = participant.hispanicShareSeries.map((p: { value: number | null }) => p.value)}
      {@const arrestRateValues = participant.arrestRateSeries.map((p: { value: number | null }) => p.value)}
      {@const latestTotalStops = formatInteger(participant.latestTotalStops)}
      {@const latestHispanicShare = formatPercent(participant.latestHispanicShare)}
      {@const latestArrestRate = formatPercent(participant.latestArrestRate)}

      <article class="rounded-lg border border-slate-200 bg-white p-5">
        <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
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
          </div>
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

        <div class="mt-4 grid gap-6 lg:grid-cols-[auto_1fr]">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {program_287g_chart_total_stops_label()}
              </div>
              <Sparkline values={totalStopsValues} stroke="#1b613c" width={200} height={56} strokeWidth={1.75} />
              <div class="mt-1 text-sm font-semibold text-slate-900">
                {latestTotalStops ?? program_287g_chart_no_data()}
              </div>
              {#if latestTotalStops && participant.latestYear}
                <div class="text-[10px] text-slate-500">{participant.latestYear}</div>
              {/if}
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {program_287g_chart_hispanic_share_label()}
              </div>
              <Sparkline values={hispanicShareValues} stroke="#7c2d12" width={200} height={56} strokeWidth={1.75} />
              <div class="mt-1 text-sm font-semibold text-slate-900">
                {latestHispanicShare ?? program_287g_chart_no_data()}
              </div>
              {#if latestHispanicShare && participant.latestYear}
                <div class="text-[10px] text-slate-500">{participant.latestYear}</div>
              {/if}
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {program_287g_chart_arrest_rate_label()}
              </div>
              <Sparkline values={arrestRateValues} stroke="#1e3a8a" width={200} height={56} strokeWidth={1.75} />
              <div class="mt-1 text-sm font-semibold text-slate-900">
                {latestArrestRate ?? program_287g_chart_no_data()}
              </div>
              {#if latestArrestRate && participant.latestYear}
                <div class="text-[10px] text-slate-500">{participant.latestYear}</div>
              {/if}
            </div>
          </div>

          <!-- Editorial slot: per-agency writeup goes here. Will hook up to a
               writeups source later (e.g., /data/287g_writeups.json keyed by
               agency_slug). -->
          <aside class="min-h-[64px] border-l border-slate-100 pl-4 text-sm text-slate-500">
          </aside>
        </div>
      </article>
    {/each}
  </div>
</main>
