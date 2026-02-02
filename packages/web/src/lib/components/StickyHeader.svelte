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
  let searchTermTimeout;
  let lastTrackedSearchTerm = "";

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
  const closeMobileMenu = () => {
    mobileMenuOpen = false;
  };

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
    if (searchTermTimeout) clearTimeout(searchTermTimeout);
    lastTrackedSearchTerm = "";
  };

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  const scheduleSearchTerm = () => {
    const term = query.trim();
    if (!term) {
      lastTrackedSearchTerm = "";
      if (searchTermTimeout) clearTimeout(searchTermTimeout);
      return;
    }
    if (term === lastTrackedSearchTerm) return;
    if (searchTermTimeout) clearTimeout(searchTermTimeout);
    searchTermTimeout = setTimeout(() => {
      if (term !== query.trim()) return;
      lastTrackedSearchTerm = term;
      trackEvent("search_term", { term });
    }, 1000);
  };

  const flushSearchTerm = () => {
    const term = query.trim();
    if (!term || term === lastTrackedSearchTerm) return;
    if (searchTermTimeout) clearTimeout(searchTermTimeout);
    lastTrackedSearchTerm = term;
    trackEvent("search_term", { term });
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
    flushSearchTerm();
    trackSearch("select", item, "enter");
    closeMobileMenu();
    resetSearch();
    goto(`/agency/${slug}`).catch(() => {
      window.location.href = `/agency/${slug}`;
    });
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      flushSearchTerm();
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
    flushSearchTerm();
    trackSearch("select", item, "click");
    closeMobileMenu();
    resetSearch();
  };

  const switchLocale = (nextLocale) => {
    if (!nextLocale || nextLocale === currentLocale) return;
    trackEvent("language_switch", {
      from: currentLocale,
      to: nextLocale,
    });
    currentLocale = nextLocale;
    setLocale(nextLocale);
  };

  const handleLocaleChange = (event) => {
    const nextLocale = event?.currentTarget?.value;
    switchLocale(nextLocale);
  };
</script>

<header class="sticky top-0 z-50 border-b-6 border-b-[#2c9166] bg-white/95 backdrop-blur-sm shadow-sm">
  <div class="mx-auto max-w-7xl px-4 sm:px-6">
    <div class="py-3">
      <div class="flex items-center justify-between gap-3">
        <a href="/" class="min-w-0 text-lg font-bold text-[#2c9166] no-underline sm:text-xl md:text-2xl">
          {m.home_header_title()}
        </a>

        <div class="flex items-center gap-2">
          <nav class="hidden items-center gap-3 text-sm md:flex">
            <a href="#download" class="no-underline text-slate-700 hover:text-[#216d4d]">
              {m.home_toc_download()}
            </a>
            <a href="#about" class="no-underline text-slate-700 hover:text-[#216d4d]">
              {m.home_toc_learn()}
            </a>
          </nav>
          <select
            bind:value={currentLocale}
            on:change={handleLocaleChange}
            class="hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:border-[#2c9166] focus:border-[#2c9166] focus:outline-none md:block"
          >
            {#each locales as locale}
              <option value={locale}>{locale.toUpperCase()}</option>
            {/each}
          </select>
          <a
            href="#donate"
            class="rounded-lg bg-[#2c9166] px-3 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#216d4d]"
          >
            {m.home_donate_button()}
          </a>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <div class="relative mt-3 w-full md:max-w-xl">
        <input
          type="search"
          placeholder={m.search_placeholder()}
          bind:value={query}
          on:input={scheduleSearchTerm}
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

      {#if mobileMenuOpen}
        <button
          type="button"
          class="fixed inset-0 z-[70] bg-slate-950/35 md:hidden"
          aria-label="Close menu"
          on:click={closeMobileMenu}
        ></button>
        <aside class="fixed inset-0 z-[80] bg-white md:hidden" aria-label="Mobile navigation">
          <div class="flex h-full flex-col">
            <div class="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Menu
              </p>
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                aria-label="Close menu"
                on:click={closeMobileMenu}
              >
                <svg
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-6 py-8">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Explore
              </p>
              <nav class="mt-3 space-y-3">
                <a
                  href="#download"
                  class="block text-3xl font-semibold leading-tight text-slate-900 no-underline"
                  on:click={closeMobileMenu}
                >
                  {m.home_toc_download()}
                </a>
                <a
                  href="#about"
                  class="block text-3xl font-semibold leading-tight text-slate-900 no-underline"
                  on:click={closeMobileMenu}
                >
                  {m.home_toc_learn()}
                </a>
              </nav>

              <div class="mt-10">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Language
                </p>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  {#each locales as locale}
                    <button
                      type="button"
                      class={`rounded-lg border px-3 py-2 text-sm font-semibold uppercase tracking-wide ${
                        locale === currentLocale
                          ? "border-[#2c9166] bg-[#2c9166] text-white"
                          : "border-slate-200 text-slate-700"
                      }`}
                      on:click={() => switchLocale(locale)}
                    >
                      {locale.toUpperCase()}
                    </button>
                  {/each}
                </div>
              </div>
            </div>

            <div class="border-t border-slate-200 p-6">
              <a
                href="#donate"
                class="inline-flex w-full items-center justify-center rounded-lg bg-[#2c9166] px-4 py-3 text-base font-semibold text-white no-underline transition-colors hover:bg-[#216d4d]"
                on:click={closeMobileMenu}
              >
                {m.home_donate_button()}
              </a>
            </div>
          </div>
        </aside>
      {/if}
    </div>
  </div>
</header>
