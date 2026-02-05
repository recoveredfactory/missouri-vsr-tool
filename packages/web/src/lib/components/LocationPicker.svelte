<script>
  import { QuickScore } from "quick-score";
  import * as m from "$lib/paraglide/messages";

  export let agencies = [];
  export let onSelect = (item) => {};

  let query = "";
  let results = [];
  let selectedIndex = -1;
  let previousQuery = "";

  const toLabel = (item) => item?.canonical_name || item?.names?.[0] || item?.agency_slug;
  const toStops = (item) => item?.all_stops_total;
  const formatStops = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return null;
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
  };
  const toSubLabel = (item) => [item?.county_name || item?.county].filter(Boolean).join(" • ");
  const normalizeText = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const tokensFor = (value) => normalizeText(value).split(" ").filter(Boolean);

  const hasStrongMatch = (item, queryTokens) => {
    if (!queryTokens.length) return false;
    const haystack = normalizeText(`${toLabel(item)} ${item?.county} ${item?.county_name}`);
    return queryTokens.every((token) => haystack.includes(token));
  };

  $: enrichedAgencies = (agencies || []).map((item) => ({
    ...item,
    search: [
      item?.canonical_name,
      ...(item?.names || []),
      item?.county,
      item?.county_name,
      item?.city,
    ]
      .filter(Boolean)
      .join(" "),
  }));

  $: scorer = enrichedAgencies.length ? new QuickScore(enrichedAgencies, ["search"]) : null;

  $: if (query.trim() !== previousQuery) {
    previousQuery = query.trim();
    selectedIndex = -1;
  }

  $: if (query.trim() && scorer) {
    const trimmedQuery = query.trim();
    const queryTokens = tokensFor(trimmedQuery);
    const queryNorm = normalizeText(trimmedQuery);
    const scored = scorer.search(trimmedQuery);
    const exactMatches = [];
    const strongMatches = [];
    const fuzzyMatches = [];

    const stopValueFor = (value) => {
      const numeric = typeof value === "string" ? Number(value) : value;
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const compareStops = (a, b) => {
      const aValue = stopValueFor(toStops(a.item));
      const bValue = stopValueFor(toStops(b.item));
      if (bValue !== aValue) return bValue - aValue;
      return 0;
    };

    const compareStrong = (a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return compareStops(a, b);
    };

    const compareExact = (a, b) => {
      const stopsDiff = compareStops(a, b);
      if (stopsDiff !== 0) return stopsDiff;
      return b.score - a.score;
    };

    for (const entry of scored) {
      const haystack = normalizeText(`${toLabel(entry.item)} ${entry.item?.county}`);
      const strong = hasStrongMatch(entry.item, queryTokens);
      const exact = queryNorm.length > 0 && haystack.includes(queryNorm);

      if (strong && exact) {
        exactMatches.push(entry);
      } else if (strong) {
        strongMatches.push(entry);
      } else {
        fuzzyMatches.push(entry);
      }
    }

    const reranked = [
      ...exactMatches.sort(compareExact),
      ...strongMatches.sort(compareStrong),
      ...fuzzyMatches.sort(compareStops),
    ].slice(0, 10);
    results = reranked;
  } else {
    results = [];
  }

  const resetSearch = () => {
    query = "";
    results = [];
    selectedIndex = -1;
  };

  const handleSelect = (item) => {
    resetSearch();
    onSelect(item);
  };

  const handleKeydown = (event) => {
    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % results.length;
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = (selectedIndex - 1 + results.length) % results.length;
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[selectedIndex]?.item || results[0]?.item;
      if (selected) handleSelect(selected);
      return;
    }

    if (event.key === "Escape") {
      resetSearch();
    }
  };
</script>

<div class="relative w-full">
  <input
    type="search"
    placeholder={m.home_location_picker_placeholder()}
    bind:value={query}
    on:keydown={handleKeydown}
    aria-label={m.home_location_picker_label()}
    autocomplete="off"
    spellcheck="false"
    class="w-full rounded-xl border-2 border-slate-300 bg-white px-5 py-3.5 text-base text-slate-900 shadow-sm transition-colors focus:border-[#0f766e] focus:outline-none"
  />
  {#if results.length}
    <ul
      class="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 list-none overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
      role="listbox"
    >
      {#each results as result, index}
        {@const stops = formatStops(toStops(result.item))}
        <li role="option" aria-selected={index === selectedIndex}>
          <button
            type="button"
            on:click={() => handleSelect(result.item)}
            class={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm text-slate-900 transition-colors hover:bg-teal-50 ${
              index === selectedIndex ? "bg-teal-50" : ""
            }`}
          >
            <span class="font-semibold text-slate-900">{toLabel(result.item)}</span>
            {#if stops || toSubLabel(result.item)}
              <span class="flex items-center gap-2 text-xs text-slate-500">
                {#if stops}
                  <span class="font-semibold text-slate-800">
                    {stops} {m.search_stops_label()}
                  </span>
                {/if}
                {#if toSubLabel(result.item)}
                  <span class="opacity-60">•</span>
                  <span>{toSubLabel(result.item)}</span>
                {/if}
              </span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
