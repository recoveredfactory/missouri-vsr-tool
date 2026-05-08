<script lang="ts">
  import { getLocale } from "$lib/paraglide/runtime";
  import Spark287gTotal from "$lib/components/Spark287gTotal.svelte";
  import SparkRaces287g from "$lib/components/SparkRaces287g.svelte";
  import ShareChart287g from "$lib/components/ShareChart287g.svelte";
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import { raceColors } from "$lib/colors.js";
  import {
    program_287g_page_title,
    program_287g_page_heading,
    program_287g_page_summary,
    program_287g_page_clarification,
    program_287g_chart_window_label,
    program_287g_chart_statewide_label,
    program_287g_chart_total_stops_label,
    program_287g_chart_search_rate_by_race_label,
    program_287g_chart_arrest_rate_by_race_label,
    program_287g_chart_license_stop_rate_by_race_label,
    program_287g_race_short_white,
    program_287g_race_short_black,
    program_287g_race_short_hispanic,
    program_287g_race_short_other,
    program_287g_jump_to_label,
    program_287g_back_to_top,
    program_287g_outlier_note_one,
    program_287g_outlier_note_many,
    program_287g_outlier_metric_search_rate,
    program_287g_outlier_metric_arrest_rate,
    program_287g_totals_label,
    program_287g_totals_all_stops,
    program_287g_totals_hispanic_stops,
    program_287g_totals_share_of_state,
    program_287g_totals_caveat,
    program_287g_models_heading,
    program_287g_models_subhead,
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

  type RaceColumn = "Total" | "White" | "Black" | "Hispanic" | "Native American" | "Asian" | "Other";
  type RaceBreakdown = Partial<Record<RaceColumn, number | null>>;
  const RACE_COLUMNS: readonly RaceColumn[] = [
    "Total",
    "White",
    "Black",
    "Hispanic",
    "Native American",
    "Asian",
    "Other",
  ] as const;

  /** @type {import('./$types').PageData} */
  export let data;

  const WIKIPEDIA_287G_URL =
    "https://en.wikipedia.org/wiki/Immigration_and_Nationality_Act_Section_287(g)";

  const SPARKLINE_YEAR_WINDOW = 10;

  $: locale = getLocale() || "en";
  $: localeBase = `/${locale}`;

  const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const compactFormatter = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
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

  const formatCompact = (value: number) => compactFormatter.format(value);

  const formatPercentLabel = (value: number) => `${percentFormatter.format(value)}%`;
  const formatRateLabel = (value: number) => percentFormatter.format(value);

  const formatBreakdownInteger = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? integerFormatter.format(Math.round(value))
      : "—";

  const formatBreakdownPercent = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? `${percentFormatter.format(value)}%`
      : "—";

  const formatBreakdownRate = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? percentFormatter.format(value)
      : "—";

  const recentSeries = (series: Array<{ year: number; value: number | null }>) =>
    series.slice(-SPARKLINE_YEAR_WINDOW);

  const raceShareOfTotal = (
    breakdown: RaceBreakdown,
    race: RaceColumn,
  ): number | null => {
    const total = breakdown.Total;
    const v = breakdown[race];
    if (typeof total !== "number" || !total || typeof v !== "number") return null;
    return (v / total) * 100;
  };

  // % of this race's stops that were residents (or non-residents).
  const residencyShare = (
    residencyBreakdown: RaceBreakdown,
    stopsBreakdown: RaceBreakdown,
    race: RaceColumn,
  ): number | null => {
    const denom = stopsBreakdown[race];
    const numer = residencyBreakdown[race];
    if (typeof denom !== "number" || !denom || typeof numer !== "number") return null;
    return (numer / denom) * 100;
  };

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

  type RaceTriple = "White" | "Black" | "Hispanic";
  type RaceSeries = Record<RaceTriple, Array<{ year: number; value: number | null }>>;
  type RaceQuad = "White" | "Black" | "Hispanic" | "Other";
  type RaceQuadSeries = Record<RaceQuad, Array<{ year: number; value: number | null }>>;

  const recentRaceSeries = (rs: RaceSeries): RaceSeries => ({
    White: recentSeries(rs.White),
    Black: recentSeries(rs.Black),
    Hispanic: recentSeries(rs.Hispanic),
  });

  const recentRaceQuadSeries = (rs: RaceQuadSeries): RaceQuadSeries => ({
    White: recentSeries(rs.White),
    Black: recentSeries(rs.Black),
    Hispanic: recentSeries(rs.Hispanic),
    Other: recentSeries(rs.Other),
  });

  $: raceShortLabels = {
    White: program_287g_race_short_white(),
    Black: program_287g_race_short_black(),
    Hispanic: program_287g_race_short_hispanic(),
  } as Record<RaceTriple, string>;

  $: raceQuadShortLabels = {
    White: program_287g_race_short_white(),
    Black: program_287g_race_short_black(),
    Hispanic: program_287g_race_short_hispanic(),
    Other: program_287g_race_short_other(),
  } as Record<RaceQuad, string>;

  // Sorted list for the agency jump dropdown (alphabetical, with stops in parens).
  $: agencyJumpList = [...data.participants]
    .sort((a, b) =>
      a.canonical_name.localeCompare(b.canonical_name, undefined, { sensitivity: "base" }),
    )
    .map((p) => ({
      slug: p.agency_slug,
      label:
        typeof p.latestTotalStops === "number" && Number.isFinite(p.latestTotalStops)
          ? `${p.canonical_name} (${compactFormatter.format(p.latestTotalStops)} stops)`
          : p.canonical_name,
    }));

  import { onMount } from "svelte";

  let jumpSelected = "";
  const handleJump = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const slug = target.value;
    if (!slug || slug === currentSlug) return;
    if (typeof window !== "undefined") {
      window.location.hash = `agency-${slug}`;
    }
  };

  /** Slug of the agency whose card the viewport is currently anchored on. */
  let currentSlug = "";

  $: jumpSelected = currentSlug;

  /** Height of the sticky site header — drives the agency-jump bar's `top:`. */
  let headerHeight = 64;
  $: stickyTopPx = `${headerHeight}px`;
  $: scrollMargin = `${headerHeight + 16}px`;

  onMount(() => {
    if (typeof window === "undefined") return;

    // Track the site header's height so the sticky agency bar sits flush below it.
    const header = document.querySelector<HTMLElement>("header.sticky");
    let headerObserver: ResizeObserver | null = null;
    if (header) {
      const updateHeader = () => {
        headerHeight = header.offsetHeight;
      };
      updateHeader();
      headerObserver = new ResizeObserver(updateHeader);
      headerObserver.observe(header);
    }

    if (typeof IntersectionObserver === "undefined") {
      return () => {
        if (headerObserver) headerObserver.disconnect();
      };
    }
    const articles = Array.from(
      document.querySelectorAll<HTMLElement>("article[id^='agency-']"),
    );
    if (!articles.length) {
      return () => {
        if (headerObserver) headerObserver.disconnect();
      };
    }
    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const slug = (e.target as HTMLElement).id.replace(/^agency-/, "");
          visibility.set(slug, e.intersectionRatio);
        }
        // Pick the article that is most prominent within the trigger zone.
        let bestSlug = currentSlug;
        let bestRatio = -1;
        for (const [slug, ratio] of visibility.entries()) {
          if (ratio > bestRatio) {
            bestSlug = slug;
            bestRatio = ratio;
          }
        }
        if (bestRatio > 0 && bestSlug !== currentSlug) {
          currentSlug = bestSlug;
        }
      },
      // Trigger zone: just below the sticky header, down to 60% of the viewport.
      {
        rootMargin: `-${headerHeight + 8}px 0px -40% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    for (const a of articles) observer.observe(a);
    return () => {
      observer.disconnect();
      if (headerObserver) headerObserver.disconnect();
    };
  });

  $: statewideSearchRateWindow = recentSeries(data.statewideSearchRateSeries ?? []);
  $: statewideArrestRateWindow = recentSeries(data.statewideArrestRateSeries ?? []);
  $: statewideLicenseStopRateWindow = recentSeries(data.statewideLicenseStopRateSeries ?? []);

  type SuppressionNote = { metric: "search-rate" | "arrest-rate"; year: number };
  const formatSuppressionNote = (notes: SuppressionNote[]): string => {
    if (!notes.length) return "";
    const labelOf = (m: SuppressionNote["metric"]) =>
      m === "search-rate"
        ? program_287g_outlier_metric_search_rate()
        : program_287g_outlier_metric_arrest_rate();
    const entries = notes.map((n) => `${labelOf(n.metric)} ${n.year}`).join(", ");
    return notes.length === 1
      ? program_287g_outlier_note_one({ entries })
      : program_287g_outlier_note_many({ count: notes.length, entries });
  };
</script>

<svelte:head>
  <title>{program_287g_page_title()}</title>
</svelte:head>

<StickyHeader />

<main id="main-content" class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
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

  <p class="mt-3 text-base leading-relaxed text-slate-700">
    {program_287g_page_clarification()}
  </p>

  {#if data.supportTypeCounts && data.supportTypeCounts.length}
    {@const totalAgencies = data.participants.length}
    <section class="mt-6">
      <h2 class="text-base font-semibold text-slate-900">{program_287g_models_heading()}</h2>
      <p class="mt-1 text-xs text-slate-500">{program_287g_models_subhead()}</p>
      <ul class="mt-3 space-y-2">
        {#each data.supportTypeCounts as model}
          <li>
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="font-medium text-slate-800">{model.type}</span>
              <span class="tabular-nums text-slate-600">
                {integerFormatter.format(model.count)}/{integerFormatter.format(totalAgencies)}
              </span>
            </div>
            <div class="mt-1 h-2 w-full overflow-hidden rounded-sm bg-slate-100">
              <div
                class="h-full bg-emerald-800"
                style="width: {totalAgencies > 0 ? (model.count / totalAgencies) * 100 : 0}%"
              ></div>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if data.totalStopsLatestSum > 0 && anchorYear !== null}
    <div class="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
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
      <p class="mt-2 text-xs italic text-slate-500">{program_287g_totals_caveat()}</p>
    </div>
  {/if}

  {#if agencyJumpList.length}
    <div
      class="sticky z-30 -mx-4 mt-6 border-y border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
      style="top: {stickyTopPx};"
    >
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <label for="agency-jump" class="font-medium text-slate-700">
          {program_287g_jump_to_label()}:
        </label>
        <select
          id="agency-jump"
          class="min-w-0 max-w-full flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 sm:flex-none"
          bind:value={jumpSelected}
          on:change={handleJump}
        >
          <option value="">—</option>
          {#each agencyJumpList as a (a.slug)}
            <option value={a.slug}>{a.label}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}

  <p class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
    <span>{program_287g_chart_window_label()}</span>
    <span class="inline-flex items-center gap-1.5">
      <span
        class="inline-block h-[2px] w-5 rounded-sm"
        style="background: {raceColors.White};"
      ></span>
      <span style="color: {raceColors.White};" class="font-semibold">{raceShortLabels.White}</span>
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span
        class="inline-block h-[2px] w-5 rounded-sm"
        style="background: {raceColors.Black};"
      ></span>
      <span style="color: {raceColors.Black};" class="font-semibold">{raceShortLabels.Black}</span>
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span
        class="inline-block h-[2px] w-5 rounded-sm"
        style="background: {raceColors.Hispanic};"
      ></span>
      <span style="color: {raceColors.Hispanic};" class="font-semibold">{raceShortLabels.Hispanic}</span>
    </span>
    <span class="inline-flex items-center gap-1.5">
      <svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
        <line x1="0" x2="22" y1="3" y2="3" stroke="#94a3b8" stroke-width="1.25" stroke-dasharray="3 3" />
      </svg>
      {program_287g_chart_statewide_label()}
    </span>
  </p>

  <div class="mt-4 space-y-10">
    {#each data.participants as participant (participant.agency_slug)}
      {@const totalStops = recentSeries(participant.totalStopsSeries)}
      {@const stopsComp = recentRaceQuadSeries(participant.stopsCompositionSeries as RaceQuadSeries)}
      {@const searchRace = recentRaceSeries(participant.searchRateByRaceSeries as RaceSeries)}
      {@const arrestRace = recentRaceSeries(participant.arrestRateByRaceSeries as RaceSeries)}
      {@const licenseRace = recentRaceSeries(participant.licenseStopRateByRaceSeries as RaceSeries)}
      {@const latestYear = participant.latestYear}
      {@const stopsByRace = participant.latestStopsByRace as RaceBreakdown}
      {@const searchByRace = participant.latestSearchRateByRace as RaceBreakdown}
      {@const arrestByRace = participant.latestArrestRateByRace as RaceBreakdown}
      {@const residentByRace = participant.latestResidentStopsByRace as RaceBreakdown}
      {@const nonResidentByRace = participant.latestNonResidentStopsByRace as RaceBreakdown}

      <article
        id="agency-{participant.agency_slug}"
        class="rounded-lg border border-slate-200 bg-white p-5 sm:p-7"
        style="scroll-margin-top: {scrollMargin};"
      >
        <header>
          <h2 class="text-xl font-semibold text-slate-900">
            <a
              class="text-emerald-900 underline-offset-2 hover:underline"
              href={`${localeBase}/agency/${participant.agency_slug}`}
            >
              {participant.canonical_name}
            </a>
          </h2>
          {#if participant.city || participant.county || participant.agency_type}
            <p class="mt-1 text-sm text-slate-500">
              {[participant.agency_type, participant.city, participant.county]
                .filter(Boolean)
                .join(" · ")}
            </p>
          {/if}
        </header>

        <ul class="mt-4 space-y-2">
          {#each participant.agreements as agreement}
            <li class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                {#if agreement.support_type}
                  <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {agency_287g_support_type_label()}
                  </dt>
                  <dd class="text-slate-900">{agreement.support_type}</dd>
                {/if}
                {#if agreement.signed_date}
                  <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {agency_287g_signed_label()}
                  </dt>
                  <dd class="text-slate-900">{formatLongDate(agreement.signed_date)}</dd>
                {/if}
                {#if agreement.moa_url}
                  <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    MOA
                  </dt>
                  <dd>
                    <a
                      class="text-emerald-900 underline"
                      href={agreement.moa_url}
                      target="_blank"
                      rel="noreferrer">{agency_287g_moa_link()}</a
                    >
                  </dd>
                {/if}
              </dl>
            </li>
          {/each}
        </ul>

        <div class="mt-7 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 class="text-base font-semibold text-slate-900">
              {program_287g_chart_total_stops_label()}
            </h3>
            <div class="mt-4">
              <Spark287gTotal
                series={totalStops}
                stroke="#1b613c"
                formatValue={formatCompact}
                showZeroBreak={true}
              />
            </div>
          </div>
          <div>
            <ShareChart287g comp={stopsComp} {recentSeries} />
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-900">
              {program_287g_chart_search_rate_by_race_label()}
            </h3>
            <div class="mt-4">
              <SparkRaces287g
                seriesByRace={searchRace}
                referenceSeries={statewideSearchRateWindow}
                labelsByRace={raceShortLabels}
                formatValue={formatRateLabel}
                minDomain={0}
              />
            </div>
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-900">
              {program_287g_chart_arrest_rate_by_race_label()}
            </h3>
            <div class="mt-4">
              <SparkRaces287g
                seriesByRace={arrestRace}
                referenceSeries={statewideArrestRateWindow}
                labelsByRace={raceShortLabels}
                formatValue={formatRateLabel}
                minDomain={0}
              />
            </div>
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-900">
              {program_287g_chart_license_stop_rate_by_race_label()}
            </h3>
            <div class="mt-4">
              <SparkRaces287g
                seriesByRace={licenseRace}
                referenceSeries={statewideLicenseStopRateWindow}
                labelsByRace={raceShortLabels}
                formatValue={formatRateLabel}
                minDomain={0}
              />
            </div>
          </div>
        </div>

        {#if participant.suppressedOutliers && participant.suppressedOutliers.length}
          <p class="mt-4 text-xs italic text-slate-500">
            {formatSuppressionNote(participant.suppressedOutliers as SuppressionNote[])}
          </p>
        {/if}

        {#if latestYear}
          <div class="mt-8 border-t border-slate-200 pt-6">
            <h3 class="text-base font-semibold text-slate-900">
              {program_287g_breakdown_heading({ year: latestYear })}
            </h3>
            <div class="mt-3 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table class="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr class="border-b border-slate-200 text-left text-slate-500">
                    <th class="py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wider"></th>
                    {#each RACE_COLUMNS as col}
                      <th class="py-1.5 pl-3 text-right text-[10px] font-semibold uppercase tracking-wider">{col}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_stops()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2 pl-3 text-right tabular-nums">
                        <div class="font-semibold text-slate-900">{formatBreakdownInteger(stopsByRace[col])}</div>
                        {#if col !== "Total"}
                          <div class="text-[10px] text-slate-500">{formatBreakdownPercent(raceShareOfTotal(stopsByRace, col))}</div>
                        {/if}
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_residency()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2 pl-3 text-right tabular-nums">
                        <div class="text-slate-900">{formatBreakdownInteger(residentByRace[col])}</div>
                        <div class="text-[10px] text-slate-500">{formatBreakdownPercent(residencyShare(residentByRace, stopsByRace, col))}</div>
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_nonresidency()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2 pl-3 text-right tabular-nums">
                        <div class="text-slate-900">{formatBreakdownInteger(nonResidentByRace[col])}</div>
                        <div class="text-[10px] text-slate-500">{formatBreakdownPercent(residencyShare(nonResidentByRace, stopsByRace, col))}</div>
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100">
                    <td class="py-2 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_search_rate()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2 pl-3 text-right tabular-nums text-slate-900">
                        {formatBreakdownRate(searchByRace[col])}
                      </td>
                    {/each}
                  </tr>
                  <tr>
                    <td class="py-2 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_arrest_rate()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2 pl-3 text-right tabular-nums text-slate-900">
                        {formatBreakdownRate(arrestByRace[col])}
                      </td>
                    {/each}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <div class="mt-6 flex justify-end">
          <a
            href="#main-content"
            class="text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            {program_287g_back_to_top()}
          </a>
        </div>
      </article>
    {/each}
  </div>
</main>
