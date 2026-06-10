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

  const sourceBundle = "Source: Missouri Vehicle Stops Report v2.2 analysis bundle (initial-impressions-2025), cross-checked against the Missouri AG's statewide annual report.";

  // Churn headline numbers, wired to the bundle's reportingChurn block so the
  // prose tracks the data. Fallbacks match the v2.2 values, so the paragraph
  // still reads correctly if the file is missing and reportingChurn is null.
  const fmtThousands = (n) => Math.round(n / 1000) * 1000;
  const usNum = (n) => n.toLocaleString("en-US");
  $: churn = a?.reportingChurn;
  $: dropped2024 = churn?.dropped_from_2023_to_2024 ?? 112;
  $: returned2025 = churn?.of_which_returned_in_2025 ?? 90;
  $: returnedSharePct = Math.round((returned2025 / dropped2024) * 100);
  $: comebackStops2023 = fmtThousands(churn?.comeback_stops_2023 ?? 101418);
  $: comebackStops2025 = fmtThousands(churn?.comeback_stops_2025 ?? 98880);
  $: rawPctChange = Math.round(churn?.raw_pct_change_2024_to_2025 ?? 12.2);
  $: comebackShareOfIncrease = Math.round(churn?.comeback_share_of_raw_increase_pct ?? 63);
  $: balancedPanelPct = Math.round(churn?.balanced_panel_pct_change_2023_to_2025 ?? 4.4);
  // Caveat auto-hides once the bundle carries more than two years — the chart
  // components already render any number of years as full trend lines.
  $: slopeNote =
    (a?.disparity?.years?.length ?? 0) <= 2
      ? "Official population denominators are published only for 2023 and 2025, so this is a two-year comparison for now — it will fill in as more years are added."
      : "";
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

The Missouri Attorney General released the 2025 vehicle stops report last week and we turned it into a new release. We've had a chance to give it a look and have a few findings to share. We've also got a collaboration with a local newsroom coming that goes deeper, so stay tuned.

The state's report says that "while patterns of driving and policing may still be different from 2019, it is now reasonable to interpret the report as conditions under the new normal." But what does the "new normal" look like? What are the important trends now that the disruption and subsequent changes post-pandemic have settled into more stable, familiar patterns?

We extracted this data from the state's PDFs and now offer it for [download](/#download), as a [web explorer](/), and via [MCP](/#mcp). Please [support our work](https://grupovisual.org).

## A hundred agencies vanished from the 2024 report — and the same ones came back in 2025

Before any trend, a caution that shaped how we read everything else. The number of law-enforcement agencies that appear in the Vehicle Stops Report swings sharply from year to year, and 2024 was a deep dip: about {dropped2024} agencies that reported in 2023 are simply absent from the 2024 report. Then the 2025 report landed and the count jumped back up — and it is largely the *same agencies*. **About {returned2025} of them drop out in 2024 and return in 2025**, roughly {returnedSharePct}% of the ones that left.

They come back at nearly the same size, too. That cohort reported about {usNum(comebackStops2023)} stops in 2023 and about {usNum(comebackStops2025)} in 2025, and they are not all small departments — Nixa, Florissant, University City, and Arnold each blinked out of the report and back in.

<Figure
  title="Who filed a report each year"
  source={sourceBundle}
  summary="Stacked bar of the agencies filing each year over the last decade, split into agencies that reported the prior year, agencies returning after a gap, first-time reporters, and agencies that filed but reported zero stops. The 2025 rebound is dominated by returning agencies, not new ones.">
  <AgenciesReportingChart data={a.agenciesReporting} />
</Figure>

That churn matters for anyone comparing the headline numbers. Statewide stops rise about {rawPctChange}% from 2024 to 2025, but roughly {comebackShareOfIncrease}% of that increase is just these returning agencies; among the agencies that reported in *every* year, stops rose only about {balancedPanelPct}%. So we treat year-over-year changes in any absolute count — total stops, total searches, total arrests — as unreliable across this window, and lean instead on **shares, rates, and disparities**, which compare groups within a single year and don't move just because the roster changed. (We count an agency as having filed if it appears anywhere in the report, including a short list the state tucks into a "Zero Stops" paragraph for agencies that filed but recorded no stops.)

With that caution in place, here is what the 2025 data shows.

## Stops of Hispanic drivers are outpacing population growth, with increasingly severe outcomes

The share of Hispanic drivers has steadily risen and is now almost double what it was in 2016. Missouri's Hispanic population grew during this period, but not as quickly as traffic stops. At the same time, Black drivers remain by far the most disproportionately stopped racial group.

We calculated our version of the much-debated "disparity index" statewide by using the adult population as a rough estimate of the driving-age population. We agree that the disparity index is of limited value for understanding and comparing local agencies. For example, the residential population of a small town is unlikely to be reflective of who is driving on its roads, especially if that includes a major highway or tourist attraction. But statewide, it gives us an imperfect but wide-screen picture of racial patterns.

<Figure
  title="Share of stops vs. share of the driving-age population"
  caption={slopeNote}
  source={sourceBundle}
  summary="For White, Black, and Hispanic drivers, each panel compares the group's share of traffic stops with its share of the 16-and-over population, for 2023 and 2025.">
  <StopShareVsPopChart metric={a.disparity.byMetric.stops} years={a.disparity.years} />
</Figure>

Looking at the disparity indexes of the searches, arrests, and share of stops shows that Black drivers are consistently stopped at the most disparate rates. The search disparity for Black drivers generally fell over this period, while the search disparity and arrest disparity for Hispanic drivers went from rough parity with White drivers towards increasing disparity.

<Figure
  title="Disparity index by outcome"
  caption={slopeNote}
  source={sourceBundle}
  summary="Disparity index for stops, searches, and arrests, by race, where 1.0 marks parity with the group's share of the 16-and-over population.">
  <DisparityIndexChart byMetric={a.disparity.byMetric} years={a.disparity.years} />
</Figure>

## Search intensity is down over the decade

Searches dropped from 6.7 per 100 stops in 2019 to 4.7 in 2025. Two forces drove it: a steady decline in discretionary consent searches, and a near-total collapse in searches based on the smell of drugs or alcohol starting in 2023; Missouri legalized recreational cannabis in December, 2022.

<Figure
  title="Searches by reason, statewide"
  caption="A single search can list multiple authorities, so reasons can sum above total searches. The 'smell of drugs / alcohol' category is only directly comparable from 2023 on, after a reporting-form change."
  source={sourceBundle}
  summary="Stacked area of statewide searches per year, split into consent searches, searches citing the smell of drugs or alcohol, and all other reasons.">
  <SearchVolumeAreaChart data={a.searchReasons} />
</Figure>

## Racial disparities widened on the search / contraband-found outcome test

Searches during stops of Black drivers and Hispanic drivers were more frequent than for White drivers, despite yielding a lower rate of contraband hits. This gap has widened somewhat since the pandemic for both groups compared to White drivers.

<Figure
  title="The outcome test: search rate vs. contraband found, 2025"
  caption="Each bubble's area is proportional to that group's total stops."
  source={sourceBundle}
  summary="Scatter plot of search rate against contraband hit rate by race in 2025; White drivers are searched least but found with contraband most often, while Hispanic drivers are searched most yet found with contraband least often.">
  <ContrabandScatterChart races={a.raceSummary.races} />
</Figure>

This analysis is what's known as an outcome test — how does the outcome of an action like a search vary by some dimension like race? In Missouri, White drivers are searched at a lower rate but are found with contraband at the highest rate of all races; Hispanic drivers are searched the most yet least often found with contraband.

## Dig deeper

Our new [MCP server](/#mcp) provides access to this data like never before. Ask it questions about the data, ask it for charts and maps, drill into agencies you're interested in. We're now tracking [287(g)](/287g) status as well, as the program grows throughout the state.

</ArticleShell>
