<script lang="ts">
  import Spark287gTotal from "$lib/components/Spark287gTotal.svelte";
  import {
    program_287g_chart_stops_share_by_race_label,
    program_287g_race_full_white,
    program_287g_race_full_black,
    program_287g_race_full_hispanic,
    program_287g_race_full_other,
  } from "$lib/paraglide/messages";

  type Race = "White" | "Black" | "Hispanic" | "Other";
  type Series = Array<{ year: number; value: number | null }>;
  type RaceQuadSeries = Record<Race, Series>;

  export let comp: RaceQuadSeries;
  export let selectedRace: Race = "Hispanic";

  const RACE_COLORS: Record<Race, string> = {
    White: "#25784c",
    Black: "#792a3b",
    Hispanic: "#1c4f74",
    Other: "#94a3b8",
  };

  $: raceFullLabels = {
    White: program_287g_race_full_white(),
    Black: program_287g_race_full_black(),
    Hispanic: program_287g_race_full_hispanic(),
    Other: program_287g_race_full_other(),
  } as Record<Race, string>;

  const percentFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const formatPercent = (v: number) => `${percentFormatter.format(v)}%`;

  $: shareSeries = (() => {
    const w = comp.White;
    const b = comp.Black;
    const hsp = comp.Hispanic;
    const oth = comp.Other;
    const sel = comp[selectedRace];
    return sel.map((p, i) => {
      const wv = w[i]?.value ?? null;
      const bv = b[i]?.value ?? null;
      const hv = hsp[i]?.value ?? null;
      const ov = oth[i]?.value ?? null;
      const v = p.value;
      if (
        typeof v !== "number" ||
        typeof wv !== "number" ||
        typeof bv !== "number" ||
        typeof hv !== "number" ||
        typeof ov !== "number"
      ) {
        return { year: p.year, value: null };
      }
      const total = wv + bv + hv + ov;
      return { year: p.year, value: total > 0 ? (v / total) * 100 : null };
    });
  })();

  // `comp` is already rolling-applied + sliced upstream, so the derived share
  // series is the windowed series — no extra smoothing.
</script>

<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
  <h3 class="text-lg font-semibold text-slate-900">
    {program_287g_chart_stops_share_by_race_label()}
  </h3>
  <span class="text-slate-400">·</span>
  <label class="inline-flex items-center gap-1 text-base">
    <span class="sr-only">{program_287g_chart_stops_share_by_race_label()}</span>
    <select
      bind:value={selectedRace}
      class="rounded border border-slate-300 bg-white px-2 py-0.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700"
      style="color: {RACE_COLORS[selectedRace]};"
    >
      {#each ["White", "Black", "Hispanic", "Other"] as const as r}
        <option value={r}>{raceFullLabels[r]}</option>
      {/each}
    </select>
  </label>
</div>
<div class="mt-4">
  <Spark287gTotal
    series={shareSeries}
    stroke={RACE_COLORS[selectedRace]}
    formatValue={formatPercent}
    showZeroBreak={true}
  />
</div>
