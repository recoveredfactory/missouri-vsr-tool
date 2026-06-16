---
authors:
  - David Eads
  - Tory Lysik
---

<script>
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import ArticleShell from "$lib/components/analysis/ArticleShell.svelte";
  import Figure from "$lib/components/analysis/Figure.svelte";
  import StopShareVsPopChart from "$lib/components/analysis/StopShareVsPopChart.svelte";
  import DisparityIndexChart from "$lib/components/analysis/DisparityIndexChart.svelte";
  import SearchVolumeAreaChart from "$lib/components/analysis/SearchVolumeAreaChart.svelte";
  import OutcomeTestTable from "$lib/components/analysis/OutcomeTestTable.svelte";
  import AgenciesReportingChart from "$lib/components/analysis/AgenciesReportingChart.svelte";
  import { getLocale } from "$lib/paraglide/runtime";
  import {
    analysis_ii2025_title,
    analysis_ii2025_dek,
    analysis_byline_prefix,
    analysis_edited_by,
  } from "$lib/paraglide/messages";

  export let data;
  $: a = data.analysis;

  // Hero meta. Date matches the registry entry for this article.
  const publishedDate = "2026-06-16";
  $: dateLabel = (() => {
    const loc = getLocale() === "es" ? "es" : "en-US";
    return new Date(publishedDate + "T00:00:00").toLocaleDateString(loc, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  })();

  // Byline from frontmatter `authors`; locale-aware "and"/"y" + Oxford comma.
  const formatByline = (names) => {
    const list = names ?? [];
    if (!list.length) return "";
    const loc = getLocale() === "es" ? "es" : "en";
    const joined = new Intl.ListFormat(loc, { style: "long", type: "conjunction" }).format(list);
    return `${analysis_byline_prefix()} ${joined}`;
  };

  const sourceBundle = "Source: Missouri Attorney General's Vehicle Stops Report, processed by Recovered Factory.";

  // Social/OG metadata. The card is baked by scripts/bake-og-images.mjs into
  // static/og/analysis/first-impressions-2025.png and shipped by sst deploy.
  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? "https://vsr.recoveredfactory.net";
  const ogImage = `${siteUrl}/og/analysis/first-impressions-2025.png`;
  const metaDescription =
    "A first look at the 2025 Missouri vehicle stops data: why ~90 agencies dropped out of the 2024 report and returned in 2025, plus Hispanic stop share, racial disparities, declining searches, and the contraband outcome test.";

  // Churn headline numbers, wired to the bundle's reportingChurn block so the
  // prose tracks the data. Fallbacks match the v2.2 values, so the paragraphs
  // still read correctly if the file is missing and reportingChurn is null.
  $: churn = a?.reportingChurn;
  $: dropped2024 = churn?.dropped_from_2023_to_2024 ?? 112;
  $: returned2025 = churn?.of_which_returned_in_2025 ?? 90;
  $: returnedSharePct = Math.round((returned2025 / dropped2024) * 100);
  $: rawPctChange = Math.round(churn?.raw_pct_change_2024_to_2025 ?? 12.2);
  $: comebackShareOfIncrease = Math.round(churn?.comeback_share_of_raw_increase_pct ?? 63);
  $: balancedPanelPct = Math.round(churn?.balanced_panel_pct_change_2023_to_2025 ?? 4.4);

  // Black stops disparity in the latest year, for the worked example in the
  // disparity chart's caption.
  $: disp = a?.disparity;
  $: dispYears = disp?.years ?? [];
  $: lastYear = dispYears[dispYears.length - 1] ?? 2025;
  $: blackStopsDI = (disp?.byMetric?.stops?.Black?.[lastYear]?.disparity_index ?? 1.6).toFixed(1);
</script>

<svelte:head>
  <title>First impressions of the 2025 Missouri Vehicle Stops Report</title>
  <meta name="description" content={metaDescription} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="{siteUrl}/analysis/first-impressions-2025" />
  <meta property="og:title" content="First impressions of the 2025 Missouri Vehicle Stops Report" />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:secure_url" content={ogImage} />
  <meta property="og:image:alt" content="First impressions of the 2025 Missouri Vehicle Stops Report" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:image" content={ogImage} />
  <meta property="twitter:title" content="First impressions of the 2025 Missouri Vehicle Stops Report" />
  <meta property="twitter:description" content={metaDescription} />
</svelte:head>

<StickyHeader />

<ArticleShell title={analysis_ii2025_title()} dek={analysis_ii2025_dek()} byline={`${formatByline(authors)} · ${analysis_edited_by()} Ash Ngu`} dateLabel={dateLabel}>

{#if getLocale() === "es"}
<div class="not-prose mb-6 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">Este análisis está disponible por ahora solo en inglés.</div>
{/if}

The Missouri Attorney General released the 2025 vehicle stops report at the beginning of June and we updated our tool to grab the new data. We've had a chance to give it a look and have a few findings to share. We've also got an upcoming collaboration with a local newsroom that will go deeper, so stay tuned.

The state's report says that "while patterns of driving and policing may still be different from 2019, it is now reasonable to interpret the report as conditions under the new normal." But what does the "new normal" look like? What are the important trends now that the disruption and subsequent changes post-pandemic have settled into more stable, familiar patterns?

We extracted this data from the state's PDFs and now offer it for [download](https://vsr.recoveredfactory.net/#download), as a [web explorer](https://vsr.recoveredfactory.net), and via [MCP](https://vsr.recoveredfactory.net/#mcp).

Dr. Brittany Street, the lead researcher at the University of Missouri whose team compiles the report for the AG's office, said she is "a firm believer in reproducible research" and was "happy to see \[Recovered Factory's\] findings are in line with ours."

Please [support our work](https://recoveredfactory.net/support) and [subscribe to our newsletter](https://recoveredfactory.net).

## More than a hundred agencies vanished from the 2024 report — and came back in 2025

When we started looking at this data in 2025, we noticed that there was a dip in the number of agencies reporting 2024 data, but we were focused on just extracting the data and preparing it for release and didn't immediately look into why.

<Figure
  title="Agencies filing a vehicle-stops report, by year"
  flush
  source={sourceBundle}
  summary="Bar chart of the number of agencies filing a vehicle-stops report each year over the last decade. The count sits near 500–540 most years but drops sharply in 2024 before rebounding in 2025.">
  <AgenciesReportingChart
    data={a.agenciesReporting}
    note={`About ${dropped2024} agencies dropped out in 2024 — ${returnedSharePct}% came back in 2025`} />
</Figure>

In total, {dropped2024} agencies that reported in 2023 were missing from the 2024 report.

In the 2025 data, we see the agency count jump back up. About {returnedSharePct}% or {returned2025} of the missing agencies returned.

These re-appearing agencies were not all small departments — Nixa, Florissant, University City, and Arnold each dropped out of the report in 2024 and came back in 2025. Before and after the missing year of data, this cohort of agencies were responsible for around 100,000 stops in a year, a notable portion of the total stops statewide.

This disappearing act matters for anyone looking at year over year numbers. Statewide stops rise about {rawPctChange}% from 2024 to 2025, but roughly {comebackShareOfIncrease}% of that increase is just these returning agencies. Among the agencies that reported in both 2023 and 2025, stops rose about {balancedPanelPct}% over that two-year span.

In response to our questions, the Attorney General's office said that "Governor Kehoe's Blue Shield program and funding eligibility criteria includes 'Compliance with Missouri crime reporting and traffic stop data requirements and other related statutes.' This could be part of the reason for the rebound that you note, as this program was enacted at the beginning of 2025." Missouri's [Blue Shield program](https://governor.mo.gov/press-releases/archive/governor-kehoe-announces-launch-missouri-blue-shield-program-recognize) offers grant funding to local law enforcement agencies in the state for officer training and equipment.

Because of this apparent underreporting, we treat statewide year-over-year changes in any absolute count — total stops, total searches, total arrests — as unreliable across this window, and lean instead on **long-term trends** as well as **shares, rates, and disparities**, which mute the effects of the missing agencies in the 2024 report. (We count an agency as having filed if it appears anywhere in the report, including a short list the state tucks into a "Zero Stops" paragraph for agencies that filed but recorded no stops.)

With this caveat in mind, here is some of what the 2025 data shows.

## Stops of Hispanic drivers are outpacing population growth, with increasingly disparate outcomes

The share of Hispanic drivers has risen steadily and is now more than 1.7 times what it was in 2016. Missouri's Hispanic population grew over the same span, but not nearly as quickly as their share of traffic stops. At the same time, Black drivers remain by far the most disproportionately stopped racial group.

<Figure
  title="Stop share vs. population share, by race"
  caption="Solid: share of traffic stops. Dashed: share of the 16-and-over population. Each panel is zoomed to its own data, so a race's stop and population lines are easy to compare within its panel; switch to “Same scale” to put every panel on one shared span and compare slopes across races."
  wide
  flush
  source={sourceBundle}
  summary="For White, Black, and Hispanic drivers, each panel compares the group's share of traffic stops (solid) with its share of the 16-and-over population (dashed), from 2016 to 2025.">
  <StopShareVsPopChart metric={a.disparity.byMetric.stops} years={a.disparity.years} />
</Figure>

We calculated our version of the [much-debated](https://missouriindependent.com/2025/05/29/naacp-lawsuit-accuses-missouri-ag-of-illegally-withholding-info-on-police-vehicle-stops/) "disparity index" statewide by using the age 16+ population as a rough estimate of the driving-age population, the same metric used by the state. We agree with the critics of the disparity index that it is of limited value for understanding and comparing local agencies. For example, the residential population of a small town is unlikely to be reflective of who is driving on its roads, especially if that includes a major highway, tourist attraction, or infrastructure like an airport. Statewide, it gives us an imperfect but wide-screen picture of racial patterns.

Looking at the disparity indexes of the searches, arrests, and share of stops shows that Black drivers are consistently stopped at the most disparate rates. The search disparity for Black drivers generally fell over this period, while the search disparity and arrest disparity for Hispanic drivers went from rough parity with White drivers towards increasing disparity.

<Figure
  title="Disparity index by outcome"
  caption={`A group's share of an outcome divided by its share of the 16-and-over population. 1.0× is parity; higher means more often than population alone would predict. For example, the Black "stops" line near ${blackStopsDI}× means Black drivers were stopped about ${blackStopsDI} times as often as their share of the driving-age population would predict.`}
  wide
  flush
  source={sourceBundle}
  summary="Disparity index for stops, searches, and arrests, by race, from 2016 to 2025, where 1.0× marks parity with the group's share of the 16-and-over population.">
  <DisparityIndexChart byMetric={a.disparity.byMetric} years={a.disparity.years} />
</Figure>

We show charts for Black, Hispanic, and White drivers because they are the most stopped groups in the state as well as having the largest share of the overall population. Detailed information about Asian, Native American, and Other drivers is available in [our explorer](https://vsr.recoveredfactory.net/en#agencies). One notable trend: Self-identification as an “Other” race is the fastest growing race demographic in Missouri according to the American Community Survey — its share of residents 16 and older has more than doubled since 2016, to about 7.6% — yet officers recorded only about 1.6% of stops of “Other” drivers in 2025.

## Search rates rebounded slightly in recent years, but remain lower than pre-pandemic

Searches dropped from 6.7 per 100 stops in 2019 to 4.7 in 2025. Two forces drove it: a steady decline in discretionary consent searches, and a near-total collapse in searches based on the smell of drugs or alcohol starting in 2023; Missouri legalized recreational cannabis in December, 2022. However, search rates did increase somewhat in 2025 compared to the prior two years.

<Figure
  title="Searches by reason, statewide"
  caption="Statewide searches each year, by the reason cited."
  flush
  source={`${sourceBundle} A single search can cite more than one reason, so the reasons can sum above total searches; the smell-of-drugs-or-alcohol reason wasn't reported separately before 2018.`}
  summary="Stacked area of statewide searches per year from 2018 to 2025, split into consent searches, searches citing the smell of drugs or alcohol, and all other reasons.">
  <SearchVolumeAreaChart data={a.searchReasons} />
</Figure>

## Racial disparities persist on the search / contraband-found outcome test

The "outcome test", applied to traffic stops in an [influential 2001 economics paper](https://www.jstor.org/stable/10.1086/318603), can be used as a key tool for understanding racial bias in traffic stops. The test uses search rate versus contraband-hit rate, with an emphasis on the hit-rate. A marker of biased policing is when specific racial groups are searched more often even though they tend to be found to be carrying contraband less frequently.

Consistently across 2023 and 2025 data, we see the same pattern of non-White drivers searched more often, yet found with contraband less frequently than White drivers. 

<Figure
  title="The outcome test"
  caption="For each driver race: the total number of searches, the search rate (searches per 100 stops), and the share of those searches that turned up contraband. Reading down each table, as the search rate rises across groups, the share finding contraband falls. Shown for 2025 and 2023 — the two years with the most comparable contraband-found data, which shifts sharply in 2023 coincident with the legalization of recreational marijuana. 2024 is omitted because of the data quality questions mentioned at the beginning of this post."
  flush
  source={sourceBundle}
  summary="Two tables, for 2023 and 2025, of search rate (searches per 100 stops) and contraband hit rate by driver race. In both years White drivers are searched least but found with contraband most often, while Hispanic drivers are searched most yet found with contraband least often.">
  <OutcomeTestTable
    byYear={a.outcomeByYear?.byYear ?? null}
    years={a.outcomeByYear?.years ?? null} />
</Figure>

There was some variance between the two years. The search rate gap for Hispanic drivers widened slightly, though the contraband hit rates for Black and Hispanic drivers increased slightly closer to that of White drivers. Ultimately, what's striking from the data is less these small variations year to year, than how durable the overall disparity is.

Drivers perceived as Native American, Asian, and Other all had less than 500 searches in 2025 and are subject to large rate swings because of their relatively small denominators.

## Want to dig deeper?

Our new [MCP server](https://vsr.recoveredfactory.net/#mcp) provides access to this data via a fluent chat interface that we're constantly updating with new context from our reporting and analysis. Ask it questions about the data, ask it for charts and maps, drill into agencies you're interested in. We're now tracking [287(g)](https://vsr.recoveredfactory.net/287g) status as well, as the program grows throughout the state.

</ArticleShell>
