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
  import ContrabandScatterChart from "$lib/components/analysis/ContrabandScatterChart.svelte";
  import AgenciesReportingChart from "$lib/components/analysis/AgenciesReportingChart.svelte";
  import { getLocale } from "$lib/paraglide/runtime";
  import {
    analysis_ii2025_title,
    analysis_ii2025_dek,
    analysis_byline_prefix,
  } from "$lib/paraglide/messages";

  export let data;
  $: a = data.analysis;

  // Hero meta. Date matches the registry entry for this article.
  const publishedDate = "2026-06-09";
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
  <meta name="description" content="A first look at the 2025 Missouri vehicle stops data: why ~90 agencies dropped out of the 2024 report and returned in 2025, plus Hispanic stop share, racial disparities, declining searches, and the contraband outcome test." />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="First impressions of the 2025 Missouri Vehicle Stops Report" />
</svelte:head>

<StickyHeader />

<ArticleShell title={analysis_ii2025_title()} dek={analysis_ii2025_dek()} byline={formatByline(authors)} dateLabel={dateLabel}>

{#if getLocale() === "es"}
<div class="not-prose mb-6 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">Este análisis está disponible por ahora solo en inglés.</div>
{/if}

<!-- TEMPORARY pre-publication notice — remove before final publish. -->
<div class="not-prose mb-8 rounded-md border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-900">
  <strong>WARNING: This post is a working draft.</strong> The findings have been reviewed and sent to the AG's press contact and Dr. Brittany Street. It is still being edited and is subject to change.
</div>

The Missouri Attorney General released the 2025 vehicle stops report at the beginning of June and we updated our tool to grab the new data. We've had a chance to give it a look and have a few findings to share. We've also got an upcoming collaboration with a local newsroom that will go deeper, so stay tuned.

The state's report says that "while patterns of driving and policing may still be different from 2019, it is now reasonable to interpret the report as conditions under the new normal." But what does the "new normal" look like? What are the important trends now that the disruption and subsequent changes post-pandemic have settled into more stable, familiar patterns?

We extracted this data from the state's PDFs and now offer it for [download](/#download), as a [web explorer](/), and via [MCP](/#mcp).

Please [support our work](https://grupovisual.org) and [subscribe to our newsletter](https://recoveredfactory.net).

## More than a hundred agencies vanished from the 2024 report — and came back in 2025

When we started looking at this data in 2025, we noticed that there was a dip in the number of agencies reporting 2024 data, but we were focused on just extracting the data and preparing it for release and didn't look into why.

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

This disappearing act matters for anyone looking at year over year numbers. Statewide stops rise about {rawPctChange}% from 2024 to 2025, but roughly {comebackShareOfIncrease}% of that increase is just these returning agencies. Among the agencies that reported in both 2023 and 2025, stops rose only about {balancedPanelPct}% over that two-year span.

For this reason, we treat statewide year-over-year changes in any absolute count — total stops, total searches, total arrests — as unreliable across this window, and lean instead on **long-term trends** as well as **shares, rates, and disparities**, which mute the effects of the apparent underreporting in the 2024 report. (We count an agency as having filed if it appears anywhere in the report, including a short list the state tucks into a "Zero Stops" paragraph for agencies that filed but recorded no stops.)

With this caveat in mind, here is some of what the 2025 data shows.

## Stops of Hispanic drivers are outpacing population growth, with increasingly disparate outcomes

The share of Hispanic drivers has risen steadily and is now almost double what it was in 2016. Missouri's Hispanic population grew over the same span, but not nearly as quickly as their share of traffic stops. At the same time, Black drivers remain by far the most disproportionately stopped racial group.

<Figure
  title="Stop share vs. population share, by race"
  caption="Solid: share of traffic stops. Dashed: share of the 16-and-over population. Panels share one vertical scale, so shares are comparable across races and the lines look flat — read the labeled change; switch to “Fit each” to zoom every panel to its own range."
  wide
  flush
  source={sourceBundle}
  summary="For White, Black, and Hispanic drivers, each panel compares the group's share of traffic stops (solid) with its share of the 16-and-over population (dashed), from 2016 to 2025.">
  <StopShareVsPopChart metric={a.disparity.byMetric.stops} years={a.disparity.years} />
</Figure>

We calculated our version of the much-debated "disparity index" statewide by using the age 16+ population as a rough estimate of the driving-age population, the same metric used by the state. We agree with the critics of the disparity index that it is of limited value for understanding and comparing local agencies. For example, the residential population of a small town is unlikely to be reflective of who is driving on its roads, especially if that includes a major highway, tourist attraction, or infrastructure like an airport. Statewide, it gives us an imperfect but wide-screen picture of racial patterns.

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

## Search intensity is down over the decade

Searches dropped from 6.7 per 100 stops in 2019 to 4.7 in 2025. Two forces drove it: a steady decline in discretionary consent searches, and a near-total collapse in searches based on the smell of drugs or alcohol starting in 2023; Missouri legalized recreational cannabis in December, 2022.

<Figure
  title="Searches by reason, statewide"
  caption="Statewide searches each year, by the reason cited."
  flush
  source={`${sourceBundle} A single search can cite more than one authority, so the reasons can sum above total searches; the smell-of-drugs-or-alcohol reason wasn't reported separately before 2018.`}
  summary="Stacked area of statewide searches per year from 2018 to 2025, split into consent searches, searches citing the smell of drugs or alcohol, and all other reasons.">
  <SearchVolumeAreaChart data={a.searchReasons} />
</Figure>

## Racial disparities persist on the search / contraband-found outcome test

Searches during stops of Black drivers and Hispanic drivers were more frequent than for White drivers, despite yielding a lower rate of contraband hits. The search rate vs. contraband hit rate "outcome test" is a key tool for understanding bias in traffic stops, which came to prominence through an [influential 2001 paper](https://www.jstor.org/stable/10.1086/318603) by economists John Knowles, Nicola Persico, and Petra Todd.

<Figure
  title="The outcome test"
  caption="Each group placed by how often its drivers are searched (left to right) against how often those searches find contraband (bottom to top). Toggle between 2023 and 2025 — contraband-found counts are only apples-to-apples from 2023 on (a 2023 reporting change), so we compare across that window."
  flush
  source={sourceBundle}
  summary="Scatter plot of search rate against contraband hit rate by race, with a toggle between 2023 and 2025; in both years White drivers are searched least but found with contraband most often, while Hispanic drivers are searched most yet found with contraband least often.">
  <ContrabandScatterChart
    races={a.raceSummary.races}
    byYear={a.outcomeByYear?.byYear ?? null}
    years={a.outcomeByYear?.years ?? null} />
</Figure>

This gap doesn't move cleanly in one direction across the two years we can compare: the search-rate gap for Hispanic drivers widens a little, while on the contraband side both Black and Hispanic drivers edge slightly closer to White drivers' hit rate. What's striking is less any single year's wobble than how durable the shape is — searched more, found with less. As of 2025, White drivers are searched at a lower rate but are found with contraband at the highest rate of all races; Hispanic drivers are searched the most yet least often found with contraband.

The outcome test is a useful lens rather than a verdict.

## Want to dig deeper?

Our new [MCP server](/#mcp) provides access to this data like never before. Ask it questions about the data, ask it for charts and maps, drill into agencies you're interested in. We're now tracking [287(g)](/287g) status as well, as the program grows throughout the state.

</ArticleShell>
