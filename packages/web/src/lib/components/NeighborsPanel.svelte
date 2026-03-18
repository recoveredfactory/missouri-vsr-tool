<script>
  import {
    agency_neighbors_heading,
    agency_neighbors_touching_label,
    agency_neighbors_contained_label,
    agency_neighbors_count,
    census_toggle_hide,
    census_toggle_show,
  } from "$lib/paraglide/messages";

  /** @type {{ slug: string, label: string }[]} */
  export let touchingAgencies = [];
  /** @type {{ slug: string, label: string }[]} */
  export let containedAgencies = [];
  /** @type {string} */
  export let localeBase = "/en";
  /** @type {string} */
  export let agencySlug = "";

  let expanded = false;

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  const toggle = () => {
    expanded = !expanded;
    trackEvent(expanded ? "agency_neighbors_expand" : "agency_neighbors_collapse", {
      agency: agencySlug,
      touchingCount: touchingAgencies.length,
      containedCount: containedAgencies.length,
    });
  };
</script>

{#if touchingAgencies.length || containedAgencies.length}
  <section class="mb-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <button
        type="button"
        class="flex w-full items-center gap-4 text-left"
        aria-expanded={expanded}
        aria-controls="neighbors-panel"
        on:click={toggle}
      >
        <span
          class={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition ${
            expanded ? "rotate-180 bg-slate-100" : "bg-white"
          }`}
        >
          <svg
            aria-hidden="true"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 8l4 4 4-4" />
          </svg>
          <span class="sr-only">
            {expanded ? census_toggle_hide() : census_toggle_show()}
          </span>
        </span>
        <div>
          <h2 class="text-lg font-semibold text-slate-900 sm:text-xl">
            {agency_neighbors_heading()}
          </h2>
          <p class="mt-1 text-xs text-slate-500">
            {agency_neighbors_count({ touching: touchingAgencies.length, contained: containedAgencies.length })}
          </p>
        </div>
      </button>
      {#if expanded}
        <div
          id="neighbors-panel"
          class="mt-4 space-y-4 border-t border-slate-100 pt-4"
        >
          {#if touchingAgencies.length}
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {agency_neighbors_touching_label()}
              </h3>
              <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                {#each touchingAgencies as neighbor}
                  <a class="underline" href={`${localeBase}/agency/${neighbor.slug}`}>
                    {neighbor.label}
                  </a>
                {/each}
              </div>
            </div>
          {/if}
          {#if containedAgencies.length}
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {agency_neighbors_contained_label()}
              </h3>
              <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                {#each containedAgencies as neighbor}
                  <a class="underline" href={`${localeBase}/agency/${neighbor.slug}`}>
                    {neighbor.label}
                  </a>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </section>
{/if}
