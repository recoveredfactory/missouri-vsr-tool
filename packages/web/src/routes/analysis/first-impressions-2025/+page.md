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

  // The trend charts share one window: 2018 onward, matching the search chart
  // (the odor search reason isn't reported separately before 2018).
  const startYear = 2018;
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

The Missouri Attorney General released the 2025 vehicle stops report at the beginning of June and we turned it into a new release. We've had a chance to give it a look and have a few findings to share. We've also got a collaboration with a local newsroom coming that goes deeper, so stay tuned.

The state's report says that "while patterns of driving and policing may still be different from 2019, it is now reasonable to interpret the report as conditions under the new normal." But what does the "new normal" look like? What are the important trends now that the disruption and subsequent changes post-pandemic have settled into more stable, familiar patterns?

We extracted this data from the state's PDFs and now offer it for [download](/#download), as a [web explorer](/), and via [MCP](/#mcp). Please [support our work](https://grupovisual.org).

## A hundred agencies vanished from the 2024 report — and came back in 2025

Before any trend, we found a data quirk that changed how we read everything. This one caught us by surprise. We had noted that there seemed to be a dip in the number of agencies reporting in 2024, but didn't get very far in finding out why and it disappeared into our reporting notes. Then we got the 2025 data and surprise! 

<Figure
  flush
  source={sourceBundle}
  summary="Bar chart of the number of agencies filing a vehicle-stops report each year over the last decade. The count sits near 500–540 most years but drops sharply in 2024 before rebounding in 2025.">
  <AgenciesReportingChart
    data={a.agenciesReporting}
    note={`About ${dropped2024} agencies dropped out in 2024 — ${returnedSharePct}% came back in 2025`} />
</Figure>

About one hundred agenices reappeared that were present in 2023 and in 2025, but not 2024. 

When we crunched the numbers, we found about {dropped2024} agencies that reported in 2023 are simply absent from the 2024 report. Then the 2025 report landed and the count jumped back up — and it is largely the *same agencies*. **About {returned2025} of them drop out in 2024 and return in 2025**, roughly {returnedSharePct}% of the ones that left.

They come back at nearly the same size, too. That cohort reported about {usNum(comebackStops2023)} stops in 2023 and about {usNum(comebackStops2025)} in 2025, and they are not all small departments — Nixa, Florissant, University City, and Arnold each blinked out of the report and back in.

The disappearing act matters for anyone looking at year over year numbers. Statewide stops rise about {rawPctChange}% from 2024 to 2025, but roughly {comebackShareOfIncrease}% of that increase is just these returning agencies; among the agencies that reported in *every* year, stops rose only about {balancedPanelPct}%.  

For this reason, we treat year-over-year changes in any absolute count — total stops, total searches, total arrests — as unreliable across this window, and lean instead on **long-term trends** as well as **shares, rates, and disparities**, which mute the effects of the apparent underreporting in the 2024 report. (We count an agency as having filed if it appears anywhere in the report, including a short list the state tucks into a "Zero Stops" paragraph for agencies that filed but recorded no stops.)

With that caveat in mind, here is some of what the 2025 data shows.

## Stops of Hispanic drivers are outpacing population growth, with increasingly disparate outcomes

The share of Hispanic drivers has risen steadily — up by roughly two-thirds since 2018. Missouri's Hispanic population grew over the same span, but not nearly as quickly as their share of traffic stops. At the same time, Black drivers remain by far the most disproportionately stopped racial group.

We calculated our version of the much-debated "disparity index" statewide by using the adult population as a rough estimate of the driving-age population. We agree with the critics of the disparity index that it is of limited value for understanding and comparing local agencies. For example, the residential population of a small town is unlikely to be reflective of who is driving on its roads, especially if that includes a major highway, tourist attraction, or infrastructure like an airport. But statewide, it gives us an imperfect but wide-screen picture of racial patterns.
 

<Figure
  flush
  wide
  source={sourceBundle}
  summary="For White, Black, and Hispanic drivers, each panel compares the group's share of traffic stops (solid) with its share of the 16-and-over population (dashed), from 2018 to 2025.">
  <StopShareVsPopChart metric={a.disparity.byMetric.stops} years={a.disparity.years} {startYear} />
</Figure>

Looking at the disparity indexes of the searches, arrests, and share of stops shows that Black drivers are consistently stopped at the most disparate rates. The search disparity for Black drivers generally fell over this period, while the search disparity and arrest disparity for Hispanic drivers went from rough parity with White drivers towards increasing disparity.

<Figure
  title="Disparity index by outcome"
  caption="A group's share of an outcome divided by its share of the 16-and-over population. 1.0× is parity; 1.9× means stopped, searched, or arrested 1.9 times as often as population alone would predict."
  wide
  flush
  source={sourceBundle}
  summary="Disparity index for stops, searches, and arrests, by race, from 2018 to 2025, where 1.0× marks parity with the group's share of the 16-and-over population.">
  <DisparityIndexChart byMetric={a.disparity.byMetric} years={a.disparity.years} {startYear} />
</Figure>

## Search intensity is down over the decade

Searches dropped from 6.7 per 100 stops in 2019 to 4.7 in 2025. Two forces drove it: a steady decline in discretionary consent searches, and a near-total collapse in searches based on the smell of drugs or alcohol starting in 2023; Missouri legalized recreational cannabis in December, 2022.

<Figure
  title="Searches by reason, statewide"
  caption="A single search can cite more than one authority, so the reasons can sum above total searches. Statewide reporting didn't break out the smell of drugs or alcohol separately from 2009 to 2017, so this view starts in 2018."
  wide
  flush
  source={sourceBundle}
  summary="Stacked area of statewide searches per year from 2018 to 2025, split into consent searches, searches citing the smell of drugs or alcohol, and all other reasons.">
  <SearchVolumeAreaChart data={a.searchReasons} {startYear} />
</Figure>

## Racial disparities widened on the search / contraband-found outcome test

Searches during stops of Black drivers and Hispanic drivers were more frequent than for White drivers, despite yielding a lower rate of contraband hits. This gap has widened somewhat since the pandemic for both groups compared to White drivers.

As of 2025, White drivers are searched at a lower rate but are found with contraband at the highest rate of all races; Hispanic drivers are searched the most yet least often found with contraband.

<Figure
  title="The outcome test, 2025"
  caption="Each group placed by how often its drivers are searched (left to right) against how often those searches find contraband (bottom to top). Bubble size reflects total stops."
  flush
  source={sourceBundle}
  summary="Scatter plot of search rate against contraband hit rate by race in 2025; White drivers are searched least but found with contraband most often, while Hispanic drivers are searched most yet found with contraband least often.">
  <ContrabandScatterChart races={a.raceSummary.races} />
</Figure>

An [influential 2001 paper](https://www.jstor.org/stable/10.1086/318603) by John Knowles, Nicola Persico, and Petra Todd, present this outcome test as a key tool for understanding bias in traffic stops. 


## Dig deeper

Our new [MCP server](/#mcp) provides access to this data like never before. Ask it questions about the data, ask it for charts and maps, drill into agencies you're interested in. We're now tracking [287(g)](/287g) status as well, as the program grows throughout the state.

</ArticleShell>
