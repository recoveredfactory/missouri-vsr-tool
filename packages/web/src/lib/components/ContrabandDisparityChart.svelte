<script>
  import { browser } from "$app/environment";
  import { raceColors } from "$lib/colors.js";

  export let searchesByRace = {};
  export let contrabandByRace = {};
  export let raceKeys = ["White", "Black", "Hispanic"];

  const formatNumber = (value) => {
    if (value === null || value === undefined) return "—";
    if (value >= 1000) {
      const k = value / 1000;
      return k % 1 === 0 ? `${k.toFixed(0)}K` : `${k.toFixed(1)}K`;
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return "—";
    return `${value.toFixed(1)}%`;
  };

  // Calculate hit rate (contraband found / searches) for each race
  $: chartData = raceKeys.map(race => {
    const searches = Number(searchesByRace[race]) || 0;
    const contraband = Number(contrabandByRace[race]) || 0;
    const hitRate = searches > 0 ? (contraband / searches) * 100 : 0;
    return {
      race,
      searches,
      contraband,
      hitRate,
      color: raceColors[race] || "#25784c"
    };
  });

  $: maxHitRate = Math.max(...chartData.map(d => d.hitRate), 1);
</script>

<!-- Horizontal lollipop chart - pure CSS/SVG implementation -->
<div class="h-[200px] sm:h-[220px] flex flex-col justify-center px-2" role="img" aria-label="Chart showing contraband hit rates by race">
  <div class="space-y-4">
    {#each chartData as item}
      <div class="flex items-center gap-3">
        <!-- Race label -->
        <div class="w-16 text-right text-xs font-medium text-slate-600 shrink-0">
          {item.race}
        </div>

        <!-- Lollipop bar -->
        <div class="flex-1 relative h-6 flex items-center">
          <!-- Background track -->
          <div class="absolute inset-y-2.5 left-0 right-0 bg-slate-100 rounded-full h-1"></div>

          <!-- Filled line -->
          <div
            class="absolute inset-y-2.5 left-0 rounded-full h-1 transition-all duration-500"
            style="width: {(item.hitRate / (maxHitRate * 1.15)) * 100}%; background-color: {item.color};"
          ></div>

          <!-- Circle at end (lollipop) -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-sm transition-all duration-500 flex items-center justify-center"
            style="left: calc({(item.hitRate / (maxHitRate * 1.15)) * 100}% - 8px); background-color: {item.color};"
          >
          </div>
        </div>

        <!-- Value -->
        <div class="w-14 text-right text-sm font-semibold shrink-0" style="color: {item.color};">
          {formatPercent(item.hitRate)}
        </div>
      </div>
    {/each}
  </div>

  <!-- Scale reference -->
  <div class="mt-4 flex items-center justify-between text-[10px] text-slate-400 px-[76px]">
    <span>0%</span>
    <span>{formatPercent(maxHitRate * 1.15 / 2)}</span>
    <span>{formatPercent(maxHitRate * 1.15)}</span>
  </div>
</div>

<p class="mt-2 text-center text-[11px] text-slate-500">
  Hit rate = contraband found ÷ searches
</p>

<!-- Tooltip on hover -->
<style>
  .lollipop-item:hover .lollipop-tooltip {
    opacity: 1;
    visibility: visible;
  }
</style>
