<script>
  import { goto } from "$app/navigation";
  import { QuickScore } from "quick-score";
  import { searchState } from "$lib/stores/search";
  import { getLocale } from "$lib/paraglide/runtime";
  import {
    search_aria_label,
    search_placeholder,
    search_stops_label,
    search_unknown_agency,
  } from "$lib/paraglide/messages";

  export let agencies = [];

  let query = "";
  let results = [];
  let selectedIndex = -1;
  let previousQuery = "";
  let localeBase = "/en";

  $: {
    try {
      localeBase = `/${getLocale() || "en"}`;
    } catch {
      localeBase = "/en";
    }
  }

  const toLabel = (item) =>
    item?.canonical_name ||
    item?.names?.[0] ||
    item?.agency_slug ||
    search_unknown_agency();
  const toStops = (item) =>
    item?.all_stops_total ?? item?.stops;
  const formatStops = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return null;
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
  };
  const toSubLabel = (item) => [item?.county].filter(Boolean).join(" • ");
  const toSlug = (item) => item?.agency_slug || item?.slug || item?.id;
  const normalizeText = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const tokensFor = (value) => normalizeText(value).split(" ").filter(Boolean);

  const hasStrongMatch = (item, queryTokens) => {
    if (!queryTokens.length) return false;
    const haystack = normalizeText(`${toLabel(item)} ${toSlug(item)}`);
    return queryTokens.every((token) => haystack.includes(token));
  };

  $: enrichedAgencies = (agencies || []).map((item) => ({
    ...item,
    search: [
      item?.canonical_name,
      item?.agency_slug,
      ...(item?.names || []),
      item?.geocode_address_county,
      item?.county,
      item?.county_name,
      item?.city,
      item?.zip,
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
    const scored = scorer.search(trimmedQuery).slice(0, 25);
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
      const stopsDiff = compareStops(a, b);
      if (stopsDiff !== 0) return stopsDiff;
      return 0;
    };

    const compareExact = (a, b) => {
      const stopsDiff = compareStops(a, b);
      if (stopsDiff !== 0) return stopsDiff;
      return b.score - a.score;
    };

    const compareFuzzy = (a, b) => {
      const stopsDiff = compareStops(a, b);
      if (stopsDiff !== 0) return stopsDiff;
      return b.score - a.score;
    };

    for (const entry of scored) {
      const haystack = normalizeText(`${toLabel(entry.item)} ${toSlug(entry.item)}`);
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
      ...fuzzyMatches.sort(compareFuzzy),
    ].slice(0, 10);
    results = reranked;
  } else {
    results = [];
  }

  $: searchState.set({ query, results, selectedIndex });

  const resetSearch = () => {
    query = "";
    results = [];
    selectedIndex = -1;
  };

  const handleSelect = (item) => {
    const slug = toSlug(item);
    if (!slug) return;
    resetSearch();
    goto(`${localeBase}/agency/${slug}`).catch(() => {
      window.location.href = `${localeBase}/agency/${slug}`;
    });
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
      query = "";
      results = [];
      selectedIndex = -1;
    }
  };
</script>

<div class="relative w-full min-w-0 md:max-w-[520px]">
  <input
    type="search"
    placeholder={search_placeholder()}
    bind:value={query}
    on:keydown={handleKeydown}
    aria-label={search_aria_label()}
    autocomplete="off"
    spellcheck="false"
    class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
  />
  {#if results.length}
    <ul
      class="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 list-none overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
      role="listbox"
    >
      {#each results as result, index}
        {@const slug = toSlug(result.item)}
        {@const href = slug ? `${localeBase}/agency/${slug}` : "#"}
        {@const stops = formatStops(toStops(result.item))}
        <li role="option" aria-selected={index === selectedIndex}>
          <a
            href={href}
            on:click={slug ? resetSearch : undefined}
            aria-disabled={!slug}
            class={`flex flex-col gap-1 px-4 py-2 text-sm text-slate-900 no-underline hover:bg-indigo-100 ${
              index === selectedIndex ? "bg-indigo-100" : ""
            }`}
          >
            <span class="font-semibold text-slate-900">{toLabel(result.item)}</span>
            {#if stops || toSubLabel(result.item)}
              <span class="flex items-center gap-2 text-xs text-slate-500">
                {#if stops}
                  <span class="font-semibold text-slate-800">
                    {stops} {search_stops_label()}
                  </span>
                {/if}
                {#if toSubLabel(result.item)}
                  <span class="opacity-60">•</span>
                  <span>{toSubLabel(result.item)}</span>
                {/if}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
