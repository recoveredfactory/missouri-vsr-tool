<script>
  import * as m from "$lib/paraglide/messages";
  import { goto } from "$app/navigation";
  import { QuickScore } from "quick-score";
  import { getLocale, locales, setLocale } from "$lib/paraglide/runtime";

  export let agencies = [];

  let query = "";
  let results = [];
  let selectedIndex = -1;
  let previousQuery = "";
  let mobileMenuOpen = false;

  let currentLocale = getLocale();

  const toLabel = (item) =>
    item?.canonical_name || item?.names?.[0] || item?.agency_slug || "Unknown agency";
  const toStops = (item) => item?.all_stops_total;
  const formatStops = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return null;
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric);
  };
  const toSubLabel = (item) => [item?.city].filter(Boolean).join(" • ");
  const toSlug = (item) => item?.agency_slug || item?.slug || item?.id;

  $: searchableAgencies = (agencies || []).map((item) => ({
    ...item,
    search: [
      item?.canonical_name,
      item?.agency_slug,
      ...(item?.names || []),
      item?.city,
      item?.zip,
    ]
      .filter(Boolean)
      .join(" "),
  }));

  $: scorer = searchableAgencies.length ? new QuickScore(searchableAgencies, ["search"]) : null;

  $: if (query.trim() !== previousQuery) {
    previousQuery = query.trim();
    selectedIndex = -1;
  }

  $: if (query.trim() && scorer) {
    const scored = scorer.search(query.trim());
    const reranked = scored
      .slice(0, 25)
      .sort((a, b) => {
        const aStops = toStops(a.item);
        const bStops = toStops(b.item);
        const aValue = typeof aStops === "string" ? Number(aStops) : aStops ?? 0;
        const bValue = typeof bStops === "string" ? Number(bStops) : bStops ?? 0;
        if (bValue !== aValue) return bValue - aValue;
        return b.score - a.score;
      })
      .slice(0, 10);
    results = reranked;
  } else {
    results = [];
  }

  const resetSearch = () => {
    query = "";
    results = [];
    selectedIndex = -1;
  };

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  const trackSearch = (action, item, method) => {
    const term = query.trim();
    if (!term) return;
    const slug = item ? toSlug(item) : null;
    trackEvent("search_action", {
      action,
      method,
      term,
      slug: slug ?? null,
    });
  };

  const handleSelect = (item) => {
    const slug = toSlug(item);
    if (!slug) return;
    trackSearch("select", item, "enter");
    resetSearch();
    goto(`/agency/${slug}`).catch(() => {
      window.location.href = `/agency/${slug}`;
    });
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      trackSearch("bail", null, "escape");
      resetSearch();
      return;
    }

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

  };

  const handleResultClick = (event, item) => {
    const slug = toSlug(item);
    if (!slug) {
      event.preventDefault();
      return;
    }
    trackSearch("select", item, "click");
    resetSearch();
  };

  const handleLocaleChange = (event) => {
    const nextLocale = event?.currentTarget?.value;
    if (!nextLocale || nextLocale === currentLocale) return;
    trackEvent("language_switch", {
      from: currentLocale,
      to: nextLocale,
    });
    setLocale(nextLocale);
  };
</script>

<header class="sticky top-0 z-50 border-b-6 border-b-[#2c9166] bg-white/95 backdrop-blur-sm shadow-sm">
  <div class="mx-auto max-w-7xl px-6">
    <div class="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <a href="/" class="shrink-0 text-2xl font-bold text-[#2c9166] no-underline md:text-3xl">
        {m.home_header_title()}
      </a>

      <div class="relative w-full md:flex-1 md:max-w-2xl md:mx-auto">
        <input
          type="search"
          placeholder={m.search_placeholder()}
          bind:value={query}
          on:keydown={handleKeydown}
          aria-label={m.search_aria_label()}
          autocomplete="off"
          class="w-full rounded-lg border-2 border-[#2c9166] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2c9166] focus:ring-offset-1"
        />
        {#if results.length}
          <ul class="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {#each results as result, index}
              {@const slug = toSlug(result.item)}
              {@const href = slug ? `/agency/${slug}` : "#"}
              {@const stops = formatStops(toStops(result.item))}
              <li role="option">
                <a
                  {href}
                  on:click={(event) => handleResultClick(event, result.item)}
                  aria-disabled={!slug}
                  class="flex flex-col gap-1 px-4 py-2 text-sm text-slate-900 no-underline hover:bg-[#2c9166]/10 {index === selectedIndex ? 'bg-[#2c9166]/10' : ''}"
                >
                  <span class="font-semibold text-slate-900">{toLabel(result.item)}</span>
                  {#if stops || toSubLabel(result.item)}
                    <span class="flex items-center gap-2 text-xs text-slate-500">
                      {#if stops}
                        <span class="font-semibold text-slate-800">{stops} stops</span>
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

      <!-- Right: Language switcher + Donate -->
      <div class="flex items-center gap-3">
        <select
          bind:value={currentLocale}
          on:change={handleLocaleChange}
          class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:border-[#2c9166] focus:border-[#2c9166] focus:outline-none"
        >
          {#each locales as locale}
            <option value={locale}>{locale.toUpperCase()}</option>
          {/each}
        </select>
        <a
          href="#donate"
          class="rounded-lg bg-[#2c9166] px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#216d4d]"
        >
          {m.home_donate_button()}
        </a>
      </div>
    </div>
  </div>
</header>
