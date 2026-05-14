<script lang="ts">
  import { getLocale } from "$lib/paraglide/runtime";
  import Spark287gTotal from "$lib/components/Spark287gTotal.svelte";
  import SparkRaces287g from "$lib/components/SparkRaces287g.svelte";
  import ShareChart287g from "$lib/components/ShareChart287g.svelte";
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import Locator287gMap from "$lib/components/Locator287gMap.svelte";
  import { raceColors } from "$lib/colors.js";
  import {
    program_287g_page_title,
    program_287g_page_heading,
    program_287g_page_summary,
    program_287g_page_clarification,
    program_287g_page_clarification_charts,
    program_287g_page_clarification_race,
    program_287g_chart_window_label,
    program_287g_chart_statewide_label,
    program_287g_chart_total_stops_label,
    program_287g_chart_search_rate_by_race_label,
    program_287g_chart_arrest_rate_by_race_label,
    program_287g_race_short_white,
    program_287g_race_short_black,
    program_287g_race_short_hispanic,
    program_287g_race_short_other,
    program_287g_jump_to_label,
    program_287g_rolling_avg_label,
    program_287g_rolling_avg_title,
    program_287g_back_to_top,
    program_287g_outlier_note_one,
    program_287g_outlier_note_many,
    program_287g_outlier_metric_search_rate,
    program_287g_outlier_metric_arrest_rate,
    program_287g_totals_label,
    program_287g_totals_all_stops,
    program_287g_totals_headline,
    program_287g_totals_white_stops,
    program_287g_totals_black_stops,
    program_287g_totals_hispanic_stops,
    program_287g_totals_other_stops,
    program_287g_totals_share_of_state,
    program_287g_totals_caveat,
    program_287g_models_heading,
    program_287g_models_subhead,
    program_287g_card_total_stops_line,
    program_287g_breakdown_heading,
    program_287g_breakdown_row_stops,
    program_287g_breakdown_row_search_rate,
    program_287g_breakdown_row_arrest_rate,
    program_287g_breakdown_row_contraband_hit_rate,
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

  /**
   * Format a population count for the locator/totals labels:
   *   ≥1,000,000 → "X.Y million"
   *   ≥10,000    → "12,300" (no rounding tail)
   *   else       → "1,234"
   */
  const formatPopulation = (n: number): string => {
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n >= 1_000_000) {
      const m = n / 1_000_000;
      return `${m.toFixed(m >= 10 ? 0 : 1)} million`;
    }
    return integerFormatter.format(Math.round(n));
  };

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

  /**
   * Below this magnitude (in per-100 units) we treat the delta vs the
   * statewide aggregate as noise — borrowing the same threshold convention
   * we use in the agency-contact project so readers don't anchor on
   * sub-percentage-point differences.
   */
  const RATE_DELTA_FLOOR = 0.5;

  const formatRateDelta = (
    agencyVal: number | null | undefined,
    stateVal: number | null | undefined,
  ): { value: string; cls: string } | null => {
    if (typeof agencyVal !== "number" || !Number.isFinite(agencyVal)) return null;
    if (typeof stateVal !== "number" || !Number.isFinite(stateVal)) return null;
    const diff = agencyVal - stateVal;
    if (Math.abs(diff) < RATE_DELTA_FLOOR) {
      return { value: "~0", cls: "text-slate-400" };
    }
    const sign = diff > 0 ? "+" : "−";
    const mag = percentFormatter.format(Math.abs(diff));
    return {
      value: `${sign}${mag}`,
      cls: diff > 0 ? "text-amber-700" : "text-sky-700",
    };
  };

  type SeriesPoint = { year: number; value: number | null };

  /**
   * 3-year rolling average. For each year, averages itself with up to two prior
   * years (whatever is available); requires at least 2 of the 3 to be valid so
   * we don't render a "rolling average" of a single point.
   */
  const rollingAverage = (series: SeriesPoint[]): SeriesPoint[] => {
    return series.map((p, i) => {
      const window = series.slice(Math.max(0, i - 2), i + 1);
      const valid = window.filter(
        (s) => typeof s.value === "number" && Number.isFinite(s.value),
      ) as Array<{ year: number; value: number }>;
      if (valid.length < 2) return { year: p.year, value: null };
      const sum = valid.reduce((acc, s) => acc + s.value, 0);
      return { year: p.year, value: sum / valid.length };
    });
  };

  let rollingAvg = true;

  /**
   * Apply rolling avg (if requested) over the full upstream window, THEN slice
   * to the displayed 10-year tail — so the leftmost displayed year still
   * benefits from the prior years' data when smoothed.
   */
  const applyRolling = (series: SeriesPoint[], rolling: boolean): SeriesPoint[] => {
    const base = rolling ? rollingAverage(series) : series;
    return base.slice(-SPARKLINE_YEAR_WINDOW);
  };
  const applyRollingRace = (rs: RaceSeries, rolling: boolean): RaceSeries => ({
    White: applyRolling(rs.White, rolling),
    Black: applyRolling(rs.Black, rolling),
    Hispanic: applyRolling(rs.Hispanic, rolling),
  });
  const applyRollingRaceQuad = (rs: RaceQuadSeries, rolling: boolean): RaceQuadSeries => ({
    White: applyRolling(rs.White, rolling),
    Black: applyRolling(rs.Black, rolling),
    Hispanic: applyRolling(rs.Hispanic, rolling),
    Other: applyRolling(rs.Other, rolling),
  });

  // % of this row's total accounted for by `race`. For Total column returns 100.
  const inRowShare = (
    breakdown: RaceBreakdown,
    race: RaceColumn,
  ): number | null => {
    const total = breakdown.Total;
    const v = breakdown[race];
    if (typeof total !== "number" || !total || typeof v !== "number") return null;
    return (v / total) * 100;
  };

  $: countDisplay = integerFormatter.format(data.participants.length);
  $: anchorYear = data.latestYearAnchor;
  $: participantSlugs = data.participants.map((p) => p.agency_slug);
  $: dotSlugs = data.participants
    .filter((p) => p.agency_type !== "County")
    .map((p) => p.agency_slug);
  $: countySlugs = data.participants
    .filter((p) => p.agency_type === "County")
    .map((p) => p.agency_slug);
  $: locatorTooltips = (() => {
    const out: Record<
      string,
      { name: string; subtitle?: string; stops?: string; agreement?: string }
    > = {};
    for (const p of data.participants) {
      const subtitleParts: string[] = [];
      if (p.agency_type) subtitleParts.push(p.agency_type);
      if (p.agency_type !== "State Agency") {
        const place = [p.city, p.county].filter(Boolean).join(", ");
        if (place) subtitleParts.push(place);
      }
      const stops =
        typeof p.latestTotalStops === "number" && p.latestYear
          ? `${integerFormatter.format(p.latestTotalStops)} stops in ${p.latestYear}`
          : undefined;
      let agreement: string | undefined;
      if (p.agreements?.length) {
        const types = Array.from(
          new Set(
            p.agreements
              .map((a) => a.support_type)
              .filter((t): t is string => Boolean(t)),
          ),
        );
        if (types.length) {
          agreement =
            p.agreements.length > 1
              ? `${p.agreements.length} agreements: ${types.join(", ")}`
              : types[0];
        }
      }
      out[p.agency_slug] = {
        name: p.canonical_name,
        subtitle: subtitleParts.join(" · ") || undefined,
        stops,
        agreement,
      };
    }
    return out;
  })();
  $: totalStopsDisplay = formatInteger(data.totalStopsLatestSum) ?? "—";
  $: totalWhiteStopsDisplay = formatInteger(data.totalWhiteStopsLatestSum) ?? "—";
  $: totalBlackStopsDisplay = formatInteger(data.totalBlackStopsLatestSum) ?? "—";
  $: totalHispanicStopsDisplay = formatInteger(data.totalHispanicStopsLatestSum) ?? "—";
  $: totalOtherStopsDisplay = formatInteger(data.totalOtherStopsLatestSum) ?? "—";
  /**
   * Per-race share = participants' stops / all-Missouri stops for the same
   * race in the anchor year. Falls back to "—" when the statewide denominator
   * isn't available (e.g. no rows for that race at the anchor year).
   */
  const raceShareDisplay = (
    participantSum: number,
    statewideSum: number | undefined,
  ): string => {
    if (typeof statewideSum !== "number" || statewideSum <= 0) return "—";
    const pct = (participantSum / statewideSum) * 100;
    return integerPercentFormatter.format(Math.max(0, pct));
  };
  $: whiteShareDisplay = raceShareDisplay(
    data.totalWhiteStopsLatestSum,
    data.statewideWhiteStopsLatest,
  );
  $: blackShareDisplay = raceShareDisplay(
    data.totalBlackStopsLatestSum,
    data.statewideBlackStopsLatest,
  );
  $: hispanicShareDisplay = raceShareDisplay(
    data.totalHispanicStopsLatestSum,
    data.statewideHispanicStopsLatest,
  );
  $: otherShareDisplay = raceShareDisplay(
    data.totalOtherStopsLatestSum,
    data.statewideOtherStopsLatest,
  );
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

  /** Shared across all stops-share cards: picking a race here flips every card. */
  let selectedShareRace: RaceQuad = "Hispanic";

  /**
   * Per-participant chart series, derived at the page level so the reactive
   * directly tracks `rollingAvg`. Doing this inside a keyed `{#each}` via
   * `{@const}` is unreliable — the const may not re-evaluate on outer state
   * changes, so child `series` props keep stale identities and the tween's
   * `set()` isn't triggered.
   */
  type ParticipantView = {
    participant: (typeof data.participants)[number];
    totalStops: SeriesPoint[];
    stopsComp: RaceQuadSeries;
    searchRace: RaceSeries;
    arrestRace: RaceSeries;
  };
  $: participantViews = data.participants.map(
    (p: (typeof data.participants)[number]): ParticipantView => ({
      participant: p,
      totalStops: applyRolling(p.totalStopsSeries, rollingAvg),
      stopsComp: applyRollingRaceQuad(p.stopsCompositionSeries as RaceQuadSeries, rollingAvg),
      searchRace: applyRollingRace(p.searchRateByRaceSeries as RaceSeries, rollingAvg),
      arrestRace: applyRollingRace(p.arrestRateByRaceSeries as RaceSeries, rollingAvg),
    }),
  );

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

  /** True once the agency bar has actually stuck to its sticky position. */
  let stickyStuck = false;
  let stickySentinel: HTMLElement | undefined;

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

    // Sentinel above the sticky bar: once it scrolls out of view, the bar is stuck.
    let stickyObserver: IntersectionObserver | null = null;
    if (stickySentinel) {
      stickyObserver = new IntersectionObserver(
        ([entry]) => {
          stickyStuck = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        },
        { threshold: [0, 1] },
      );
      stickyObserver.observe(stickySentinel);
    }

    const articles = Array.from(
      document.querySelectorAll<HTMLElement>("article[id^='agency-']"),
    );
    if (!articles.length) {
      return () => {
        if (headerObserver) headerObserver.disconnect();
        if (stickyObserver) stickyObserver.disconnect();
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
      if (stickyObserver) stickyObserver.disconnect();
    };
  });

  $: statewideSearchRateWindow = applyRolling(data.statewideSearchRateSeries ?? [], rollingAvg);
  $: statewideArrestRateWindow = applyRolling(data.statewideArrestRateSeries ?? [], rollingAvg);
  $: statewideStopsCompositionWindow = applyRollingRaceQuad(
    (data.statewideStopsCompositionSeries ?? {
      White: [],
      Black: [],
      Hispanic: [],
      Other: [],
    }) as RaceQuadSeries,
    rollingAvg,
  );

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

<main id="main-content" class="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
  <h1 class="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
    {program_287g_page_heading()}
  </h1>

  <div class="mt-10 grid gap-8 lg:grid-cols-[1.618fr_1fr] lg:gap-12">
    <!-- Left: intro copy. The description and clarification paragraphs
         each lead with a serif dropcap; in-between paragraphs (summary)
         do not. The `.dropcap` selector adds extra top margin so the
         floated character doesn't crash into the paragraph above it,
         and extra space below so the followup paragraphs breathe. -->
    <div
      class="space-y-4 text-lg leading-relaxed text-slate-700 [&>.dropcap]:mt-8 [&>.dropcap:first-child]:mt-0 [&>.dropcap+p]:mt-6"
    >
      <p
        class="dropcap [&_a]:underline [&_a:hover]:text-slate-900 first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-serif first-letter:text-6xl first-letter:font-normal first-letter:leading-[0.85] first-letter:text-slate-800"
      >
        <a class="underline" href={WIKIPEDIA_287G_URL} target="_blank" rel="noreferrer"
          >{agency_287g_description_link()}</a
        >{agency_287g_description_post()}
      </p>
      <p>
        {program_287g_page_summary({
          count: countDisplay,
          date: formatLongDate(data.snapshotDate),
        })}
      </p>
      <!-- Clarification strings render as HTML to preserve their embedded anchors. -->
      <p
        class="dropcap [&_a]:underline [&_a:hover]:text-slate-900 first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-serif first-letter:text-6xl first-letter:font-normal first-letter:leading-[0.85] first-letter:text-slate-800"
      >
        {@html program_287g_page_clarification()}
      </p>
      <p>
        {@html program_287g_page_clarification_charts()}
      </p>
      <p class="text-slate-600">
        {@html program_287g_page_clarification_race()}
      </p>
    </div>

    <!-- Right: big numbers above support models, faint divider between. -->
    <div class="space-y-10">
      {#if data.totalStopsLatestSum > 0 && anchorYear !== null}
        <section>
          <h2 class="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
            {program_287g_totals_headline({
              stops: totalStopsDisplay,
              year: anchorYear,
              count: countDisplay,
            })}
          </h2>
          <p class="mt-2 text-sm italic text-slate-500">{program_287g_totals_caveat()}</p>
          <div class="mt-4 divide-y divide-slate-200 border-t border-slate-200">
            <p class="py-2.5 text-lg text-slate-700 sm:text-xl">
              {program_287g_totals_white_stops({ stops: totalWhiteStopsDisplay, share: whiteShareDisplay })}
            </p>
            <p class="py-2.5 text-lg text-slate-700 sm:text-xl">
              {program_287g_totals_black_stops({ stops: totalBlackStopsDisplay, share: blackShareDisplay })}
            </p>
            <p class="py-2.5 text-lg text-slate-700 sm:text-xl">
              {program_287g_totals_hispanic_stops({ stops: totalHispanicStopsDisplay, share: hispanicShareDisplay })}
            </p>
            <p class="py-2.5 text-lg text-slate-700 sm:text-xl">
              {program_287g_totals_other_stops({ stops: totalOtherStopsDisplay, share: otherShareDisplay })}
            </p>
          </div>
        </section>
      {/if}

      {#if data.totalStopsLatestSum > 0 && anchorYear !== null && data.supportTypeCounts && data.supportTypeCounts.length}
        <hr class="border-slate-200" />
      {/if}

      {#if data.supportTypeCounts && data.supportTypeCounts.length}
        {@const totalAgencies = data.participants.length}
        <section>
          <h2 class="text-lg font-semibold text-slate-900">{program_287g_models_heading()}</h2>
          <p class="mt-1 text-sm text-slate-500">{program_287g_models_subhead()}</p>
          <ul class="mt-3 space-y-2.5">
            {#each data.supportTypeCounts as model}
              <li>
                <div class="flex items-baseline justify-between gap-3 text-base">
                  <span class="font-medium text-slate-800">{model.type}</span>
                  <span class="tabular-nums text-slate-600">
                    {integerFormatter.format(model.count)}/{integerFormatter.format(totalAgencies)}
                  </span>
                </div>
                <div class="mt-1 h-2.5 w-full overflow-hidden rounded-sm bg-slate-100">
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
    </div>
  </div>

  {#if agencyJumpList.length}
    <div bind:this={stickySentinel} class="mt-6 h-px"></div>
    <div
      class="sticky z-30 border-y backdrop-blur transition-colors duration-150 {stickyStuck
        ? 'border-slate-300 bg-slate-100/95 shadow-md'
        : 'border-slate-200 bg-white/95'}"
      style="top: {stickyTopPx}; width: 100vw; margin-inline: calc(50% - 50vw);"
    >
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-base sm:px-6">
        <div class="flex min-w-0 flex-1 items-center sm:flex-none">
          <label for="agency-jump" class="sr-only">{program_287g_jump_to_label()}</label>
          <select
            id="agency-jump"
            class="min-w-0 max-w-full flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700 sm:flex-none"
            bind:value={jumpSelected}
            on:change={handleJump}
          >
            <option value="">{program_287g_jump_to_label()}</option>
            {#each agencyJumpList as a (a.slug)}
              <option value={a.slug}>{a.label}</option>
            {/each}
          </select>
        </div>
        <label
          class="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-600"
          title={program_287g_rolling_avg_title()}
        >
          <input
            type="checkbox"
            bind:checked={rollingAvg}
            class="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
          />
          {program_287g_rolling_avg_label()}
        </label>
      </div>
    </div>
  {/if}

  <p class="mt-7 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-600">
    <span>{program_287g_chart_window_label()}</span>
    <span class="inline-flex items-center gap-1.5">
      <span
        class="inline-block h-[3px] w-6 rounded-sm"
        style="background: {raceColors.White};"
      ></span>
      <span style="color: {raceColors.White};" class="font-semibold">{raceShortLabels.White}</span>
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span
        class="inline-block h-[3px] w-6 rounded-sm"
        style="background: {raceColors.Black};"
      ></span>
      <span style="color: {raceColors.Black};" class="font-semibold">{raceShortLabels.Black}</span>
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span
        class="inline-block h-[3px] w-6 rounded-sm"
        style="background: {raceColors.Hispanic};"
      ></span>
      <span style="color: {raceColors.Hispanic};" class="font-semibold">{raceShortLabels.Hispanic}</span>
    </span>
    <span class="inline-flex items-center gap-1.5">
      <svg width="26" height="6" viewBox="0 0 26 6" aria-hidden="true">
        <line x1="0" x2="26" y1="3" y2="3" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3" />
      </svg>
      {program_287g_chart_statewide_label()}
    </span>
  </p>

  <div class="mt-8 space-y-16">
    {#each participantViews as view (view.participant.agency_slug)}
      {@const participant = view.participant}
      {@const latestYear = participant.latestYear}
      {@const stopsByRace = participant.latestStopsByRace as RaceBreakdown}
      {@const searchByRace = participant.latestSearchRateByRace as RaceBreakdown}
      {@const arrestByRace = participant.latestArrestRateByRace as RaceBreakdown}
      {@const contrabandHitRateByRace = participant.latestContrabandHitRateByRace as RaceBreakdown}
      {@const residentByRace = participant.latestResidentStopsByRace as RaceBreakdown}
      {@const nonResidentByRace = participant.latestNonResidentStopsByRace as RaceBreakdown}
      {@const isStateAgency = participant.agency_type === "State Agency"}
      {@const locationParts = isStateAgency
        ? [participant.agency_type]
        : [participant.agency_type, participant.city, participant.county].filter(Boolean)}

      <article
        id="agency-{participant.agency_slug}"
        class="-mx-4 border-y border-slate-200 bg-white p-6 sm:mx-0 sm:rounded-lg sm:border sm:p-10"
        style="scroll-margin-top: {scrollMargin};"
      >
        <header
          class="mx-auto grid w-full max-w-3xl gap-x-4 gap-y-4 sm:gap-x-6 lg:gap-x-8
                 [grid-template-columns:minmax(0,1fr)_11rem]
                 [grid-template-areas:'name_name''info_map']
                 sm:[grid-template-columns:18rem_minmax(0,1fr)]
                 sm:[grid-template-areas:'map_name''map_info']"
        >
          <h2
            class="text-2xl font-semibold text-slate-900 sm:text-3xl [grid-area:name]"
          >
            <a
              class="text-emerald-900 underline-offset-2 hover:underline"
              href={`${localeBase}/agency/${participant.agency_slug}`}
            >
              {participant.canonical_name}
            </a>
          </h2>

          <Locator287gMap
            agencySlug={participant.agency_slug}
            {participantSlugs}
            {dotSlugs}
            {countySlugs}
            allCountySlugs={data.allCountySlugs}
            tooltips={locatorTooltips}
            frameClass="w-full self-start [grid-area:map]"
          />

          <div class="min-w-0 [grid-area:info]">
            {#if typeof participant.latestTotalStops === "number" && latestYear}
              <p class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {program_287g_card_total_stops_line({
                  stops: integerFormatter.format(participant.latestTotalStops),
                  year: latestYear,
                })}
                {#if typeof participant.population === "number" && participant.population > 0}
                  <span class="font-light text-slate-500"
                    >· Pop. {formatPopulation(participant.population)}</span
                  >
                {/if}
              </p>
            {/if}
            {#if locationParts.length}
              <p class="mt-1.5 text-base text-slate-500">
                {locationParts.join(" · ")}
              </p>
            {/if}

            <ul
              class="mt-6 divide-y divide-slate-200 [&>li]:py-4 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0"
            >
              {#each participant.agreements as agreement}
                <li>
                  <dl
                    class="grid grid-cols-[4rem_1fr] items-baseline gap-x-3 gap-y-1.5 text-base sm:grid-cols-[max-content_1fr] sm:gap-x-4"
                  >
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
          </div>
        </header>

        <div
          class="mt-12 grid gap-x-12 gap-y-14 sm:grid-cols-2 [&>:last-child:nth-child(odd)]:sm:col-span-2 [&>:last-child:nth-child(odd)]:sm:mx-auto [&>:last-child:nth-child(odd)]:sm:w-full [&>:last-child:nth-child(odd)]:sm:max-w-[28rem]"
        >
          <div>
            <h3 class="text-lg font-semibold text-slate-900">
              {program_287g_chart_total_stops_label()}
            </h3>
            <div class="mt-4">
              <Spark287gTotal
                series={view.totalStops}
                stroke="#1b613c"
                formatValue={formatCompact}
                showZeroBreak={true}
                unitLabel="stops"
              />
            </div>
          </div>
          <div>
            <ShareChart287g
              comp={view.stopsComp}
              referenceComp={statewideStopsCompositionWindow}
              bind:selectedRace={selectedShareRace}
            />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">
              {program_287g_chart_search_rate_by_race_label()}
            </h3>
            <div class="mt-4">
              <SparkRaces287g
                seriesByRace={view.searchRace}
                referenceSeries={statewideSearchRateWindow}
                labelsByRace={raceShortLabels}
                formatValue={formatRateLabel}
                showZeroBreak={true}
                unitLabel="per 100"
              />
            </div>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">
              {program_287g_chart_arrest_rate_by_race_label()}
            </h3>
            <div class="mt-4">
              <SparkRaces287g
                seriesByRace={view.arrestRace}
                referenceSeries={statewideArrestRateWindow}
                labelsByRace={raceShortLabels}
                formatValue={formatRateLabel}
                showZeroBreak={true}
                unitLabel="per 100"
              />
            </div>
          </div>
        </div>

        {#if participant.suppressedOutliers && participant.suppressedOutliers.length}
          <p class="mt-5 text-sm italic text-slate-500">
            {formatSuppressionNote(participant.suppressedOutliers as SuppressionNote[])}
          </p>
        {/if}

        {#if latestYear}
          {@const showDeltas = latestYear === data.latestYearAnchor}
          {@const stateSearch = data.statewideRatesLatest?.searchRate ?? {}}
          {@const stateArrest = data.statewideRatesLatest?.arrestRate ?? {}}
          {@const stateContraband = data.statewideRatesLatest?.contrabandHitRate ?? {}}
          <div class="mt-12 border-t border-slate-200 pt-8">
            <h3 class="text-lg font-semibold text-slate-900">
              {program_287g_breakdown_heading({ agency: participant.canonical_name, year: latestYear })}
            </h3>
            <div class="mt-4 -mx-4 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
              <table class="min-w-full text-sm sm:text-base">
                <thead>
                  <tr class="border-b border-slate-200 text-left text-slate-500">
                    <th class="py-2 pr-3 text-xs font-semibold uppercase tracking-wider"></th>
                    {#each RACE_COLUMNS as col}
                      <th class="py-2 pl-3 text-right text-xs font-semibold uppercase tracking-wider">{col}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2.5 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_stops()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2.5 pl-3 text-right tabular-nums">
                        <div class="font-semibold text-slate-900">{formatBreakdownInteger(stopsByRace[col])}</div>
                        <div class="text-xs text-slate-500">{formatBreakdownPercent(inRowShare(stopsByRace, col))}</div>
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2.5 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_residency()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2.5 pl-3 text-right tabular-nums">
                        <div class="text-slate-900">{formatBreakdownInteger(residentByRace[col])}</div>
                        <div class="text-xs text-slate-500">{formatBreakdownPercent(inRowShare(residentByRace, col))}</div>
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2.5 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_nonresidency()}</td>
                    {#each RACE_COLUMNS as col}
                      <td class="py-2.5 pl-3 text-right tabular-nums">
                        <div class="text-slate-900">{formatBreakdownInteger(nonResidentByRace[col])}</div>
                        <div class="text-xs text-slate-500">{formatBreakdownPercent(inRowShare(nonResidentByRace, col))}</div>
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2.5 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_search_rate()}</td>
                    {#each RACE_COLUMNS as col}
                      {@const delta = showDeltas ? formatRateDelta(searchByRace[col], stateSearch[col]) : null}
                      <td class="py-2.5 pl-3 text-right tabular-nums">
                        <div class="text-slate-900">{formatBreakdownRate(searchByRace[col])}</div>
                        {#if delta}
                          <div class="text-xs tabular-nums">
                            {#if col === "Total"}<span class="text-slate-400">vs MO: </span>{/if}<span class={delta.cls}>{delta.value}</span>
                          </div>
                        {/if}
                      </td>
                    {/each}
                  </tr>
                  <tr class="border-b border-slate-100 align-top">
                    <td class="py-2.5 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_arrest_rate()}</td>
                    {#each RACE_COLUMNS as col}
                      {@const delta = showDeltas ? formatRateDelta(arrestByRace[col], stateArrest[col]) : null}
                      <td class="py-2.5 pl-3 text-right tabular-nums">
                        <div class="text-slate-900">{formatBreakdownRate(arrestByRace[col])}</div>
                        {#if delta}
                          <div class="text-xs tabular-nums">
                            {#if col === "Total"}<span class="text-slate-400">vs MO: </span>{/if}<span class={delta.cls}>{delta.value}</span>
                          </div>
                        {/if}
                      </td>
                    {/each}
                  </tr>
                  <tr class="align-top">
                    <td class="py-2.5 pr-3 font-medium text-slate-700">{program_287g_breakdown_row_contraband_hit_rate()}</td>
                    {#each RACE_COLUMNS as col}
                      {@const delta = showDeltas ? formatRateDelta(contrabandHitRateByRace[col], stateContraband[col]) : null}
                      <td class="py-2.5 pl-3 text-right tabular-nums">
                        <div class="text-slate-900">{formatBreakdownRate(contrabandHitRateByRace[col])}</div>
                        {#if delta}
                          <div class="text-xs tabular-nums">
                            {#if col === "Total"}<span class="text-slate-400">vs MO: </span>{/if}<span class={delta.cls}>{delta.value}</span>
                          </div>
                        {/if}
                      </td>
                    {/each}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <div class="mt-7 flex justify-end">
          <a
            href="#main-content"
            class="text-sm text-slate-500 underline-offset-2 hover:underline"
          >
            {program_287g_back_to_top()}
          </a>
        </div>
      </article>
    {/each}
  </div>
</main>
