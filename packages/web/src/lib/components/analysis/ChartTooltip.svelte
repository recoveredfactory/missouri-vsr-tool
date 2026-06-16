<script>
  // Shared floating tooltip for the analysis charts. Render it inside a
  // `position: relative` host (the `.tip-host` wrapper around a chart/panel);
  // it parks above the hovered point and is purely presentational
  // (pointer-events: none so it never eats the next hover).
  export let tip = null; // { x, y, title, rows: [{ label, value, color? }] } | null
</script>

{#if tip}
  <div
    class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs leading-tight shadow-lg"
    style="left:{tip.x}px; top:{tip.y - 12}px">
    {#if tip.title}
      <div class="mb-1 font-semibold text-slate-700">{tip.title}</div>
    {/if}
    {#each tip.rows as r}
      <div class="flex items-center gap-2 whitespace-nowrap py-px">
        {#if r.color}
          <span class="inline-block h-2 w-2 shrink-0 rounded-full" style="background:{r.color}"></span>
        {/if}
        <span class="text-slate-500">{r.label}</span>
        <span class="ml-auto pl-2 font-semibold tabular-nums text-slate-800">{r.value}</span>
      </div>
    {/each}
  </div>
{/if}
