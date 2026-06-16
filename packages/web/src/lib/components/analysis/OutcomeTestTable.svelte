<script>
  import { raceColor } from "./colors";

  // Outcome test, rendered as compact per-year tables instead of an animated
  // scatter. Two years only — 2023 and 2025, the clean apples-to-apples window
  // for contraband-found (not reported statewide before 2020; rates shift
  // sharply at 2023). 2024 is deliberately omitted: it's the Kirkwood-inflated
  // ingest year AND the agency-dropout year the article tells readers to
  // distrust, so its statewide search/hit rates aren't trustworthy here.
  //
  // Rows are ordered by search rate so the outcome test reads straight down the
  // table: as the search rate rises (White -> Black -> Hispanic), the share of
  // searches that find contraband falls — "searched more, found less."
  export let byYear; // { [year]: { race, search_rate, contraband_hit_rate, ... }[] }
  export let years; // number[] ascending, e.g. [2023, 2025]

  // Most-recent year first.
  $: orderedYears = [...(years ?? [])].sort((a, b) => b - a);

  const rowsFor = (year) =>
    [...(byYear?.[year] ?? [])].sort((a, b) => a.search_rate - b.search_rate);

  const fmtRate = (v) => (v == null ? "—" : v.toFixed(1));
  const fmtPct = (v) => (v == null ? "—" : `${Math.round(v)}%`);
  const fmtCount = (v) => (v == null ? "—" : v.toLocaleString("en-US"));
</script>

{#if byYear && years?.length}
  <div class="grid gap-6 sm:grid-cols-2 sm:gap-8">
    {#each orderedYears as year}
      <div>
        <div class="mb-2 text-center text-[1.05rem] font-bold text-slate-900">{year}</div>
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b-2 border-slate-200 align-bottom text-slate-500">
              <th class="pb-1.5 text-left font-semibold">Race</th>
              <th class="pb-1.5 text-right font-semibold leading-tight">
                Searches<br /><span class="font-normal text-slate-400">total</span>
              </th>
              <th class="pb-1.5 text-right font-semibold leading-tight">
                Per 100<br /><span class="font-normal text-slate-400">stops</span>
              </th>
              <th class="pb-1.5 text-right font-semibold leading-tight">
                Contraband<br /><span class="font-normal text-slate-400">found</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each rowsFor(year) as r}
              <tr class="border-b border-slate-100 last:border-0">
                <td class="py-2 font-bold" style="color:{raceColor(r.race)}">{r.race}</td>
                <td class="py-2 text-right tabular-nums text-slate-600">{fmtCount(r.total_searches)}</td>
                <td class="py-2 text-right font-semibold tabular-nums text-slate-800">{fmtRate(r.search_rate)}</td>
                <td class="py-2 text-right font-semibold tabular-nums text-slate-800">{fmtPct(r.contraband_hit_rate)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  </div>
{:else}
  <div class="flex h-32 items-center justify-center rounded-md bg-slate-50 text-sm text-slate-400">
    Chart data not yet published.
  </div>
{/if}
