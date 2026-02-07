<script>
  import * as m from "$lib/paraglide/messages";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { QuickScore } from "quick-score";
  import { getLocale, locales, setLocale } from "$lib/paraglide/runtime";
  import { onMount } from "svelte";

  export let agencies = [];
  export let selectedAgencyLabel = "";

  let query = "";
  let results = [];
  let selectedIndex = -1;
  let previousQuery = "";
  let mobileMenuOpen = false;
  let searchTermTimeout;
  let lastTrackedSearchTerm = "";
  let headerHeight = 0;
  let prefillActive = false;
  let lastPrefillLabel = "";
  let localeBase = "/en";
  let searchContainer;
  const showLanguageSwitcher = false;

  let currentLocale;
  // Re-evaluate locale when page changes (fixes language switcher not updating)
  $: $page, (currentLocale = getLocale());
  $: localeBase = locales.includes(currentLocale) ? `/${currentLocale}` : "/en";

  const donateUrl =
    import.meta.env.PUBLIC_DONATE_URL ??
    "https://buy.stripe.com/6oU9AU1KEa7Z6gcdr6fAc03";

  const toLabel = (item) =>
    item?.canonical_name || item?.names?.[0] || item?.agency_slug || "Unknown agency";
  const toStops = (item) => item?.all_stops_total;
  const formatStops = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return null;
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric);
  };
  const toSubLabel = (item) => item?.county || "";
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

  $: if (selectedAgencyLabel && selectedAgencyLabel !== lastPrefillLabel) {
    query = selectedAgencyLabel;
    lastPrefillLabel = selectedAgencyLabel;
    prefillActive = true;
  }

  $: if (query.trim() && scorer && !prefillActive) {
    const trimmedQuery = query.trim();
    const queryNorm = trimmedQuery.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const queryTokens = queryNorm.split(" ").filter(Boolean);

    const scored = scorer.search(trimmedQuery);

    const perfectMatches = [];
    const strongMatches = [];
    const fuzzyMatches = [];

    const STRONG_THRESHOLD = 0.8;

    const stopValue = (item) => {
      const stops = toStops(item);
      const numeric = typeof stops === "string" ? Number(stops) : stops;
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const hasAllTokens = (item) => {
      if (!queryTokens.length) return false;
      const haystack = (toLabel(item) + " " + toSlug(item)).toLowerCase().replace(/[^a-z0-9]+/g, " ");
      return queryTokens.every(token => haystack.includes(token));
    };

    const isExactSubstring = (item) => {
      if (!queryNorm) return false;
      const haystack = (toLabel(item) + " " + toSlug(item)).toLowerCase().replace(/[^a-z0-9]+/g, " ");
      return haystack.includes(queryNorm);
    };

    for (const entry of scored) {
      const isPerfect = entry.score === 1 || isExactSubstring(entry.item);
      const isStrong = entry.score >= STRONG_THRESHOLD && hasAllTokens(entry.item);

      if (isPerfect) {
        perfectMatches.push(entry);
      } else if (isStrong) {
        strongMatches.push(entry);
      } else {
        fuzzyMatches.push(entry);
      }
    }

    // Perfect: stops desc, then score desc
    perfectMatches.sort((a, b) => {
      const stopsDiff = stopValue(b.item) - stopValue(a.item);
      if (stopsDiff !== 0) return stopsDiff;
      return b.score - a.score;
    });

    // Strong: score desc, then stops desc
    strongMatches.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return stopValue(b.item) - stopValue(a.item);
    });

    // Fuzzy: stops desc, then score desc
    fuzzyMatches.sort((a, b) => {
      const stopsDiff = stopValue(b.item) - stopValue(a.item);
      if (stopsDiff !== 0) return stopsDiff;
      return b.score - a.score;
    });

    results = [...perfectMatches, ...strongMatches, ...fuzzyMatches].slice(0, 10);
  } else {
    results = [];
  }

  const resetSearch = () => {
    query = "";
    results = [];
    selectedIndex = -1;
    if (searchTermTimeout) clearTimeout(searchTermTimeout);
    lastTrackedSearchTerm = "";
    prefillActive = false;
  };

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  const scheduleSearchTerm = () => {
    prefillActive = false;
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
    prefillActive = false;
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

  const clearPrefill = () => {
    if (!prefillActive) return;
    if (query !== lastPrefillLabel) return;
    resetSearch();
  };

  onMount(() => {
    const handlePointerDown = (event) => {
      if (!searchContainer || !results.length) return;
      if (searchContainer.contains(event.target)) return;
      results = [];
      selectedIndex = -1;
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  });

  const closeMenu = (source = "unknown") => {
    if (!mobileMenuOpen) return;
    trackEvent("mobile_menu_toggle", {
      action: "close",
      source,
    });
    mobileMenuOpen = false;
  };

  const handleSelect = (item) => {
    const slug = toSlug(item);
    if (!slug) return;
    flushSearchTerm();
    trackSearch("select", item, "enter");
    closeMenu("search_select");
    resetSearch();
    goto(`${localeBase}/agency/${slug}`).catch(() => {
      window.location.href = `${localeBase}/agency/${slug}`;
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
    closeMenu("search_select");
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

  const toggleMenu = () => {
    if (mobileMenuOpen) {
      closeMenu("toggle");
      return;
    }
    mobileMenuOpen = true;
    trackEvent("mobile_menu_toggle", {
      action: "open",
      source: "toggle",
    });
  };
</script>

<header
  bind:clientHeight={headerHeight}
  class="sticky top-0 z-50 border-b-6 border-b-[#25784c] bg-white/95 backdrop-blur-sm shadow-sm"
>
  <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 md:w-[85%] md:px-0">
    <div class="py-2 sm:py-2.5">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <a
            href="/"
            class="min-w-0 font-bold text-[#318c5d] no-underline text-[clamp(0.95rem,4vw,1.45rem)] leading-tight"
          >
            {m.home_header_title()}
          </a>
        </div>

        <div class="flex items-center gap-2">
          {#if showLanguageSwitcher}
            <div class="relative hidden md:block">
              <select
                bind:value={currentLocale}
                on:change={handleLocaleChange}
                class="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-sm font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:border-[#318c5d] focus:border-[#318c5d] focus:outline-none"
              >
                {#each locales as locale}
                  <option value={locale}>{locale.toUpperCase()}</option>
                {/each}
              </select>
              <svg
                class="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M6 8l4 4 4-4" />
              </svg>
            </div>
          {/if}
          <a
            href={donateUrl}
            class="inline-flex h-9 items-center rounded-lg bg-[#25784c] px-4 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#1b613c]"
          >
            {m.home_donate_button()}
          </a>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 md:hidden"
            aria-controls="mobile-site-menu"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            on:click={toggleMenu}
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

      <div class="mt-2.5 grid grid-cols-1 gap-3 md:mt-2.5 md:grid-cols-[minmax(0,38rem)_auto] md:items-center md:gap-5">
        <div class="relative w-full" bind:this={searchContainer}>
          <input
            type="search"
            placeholder={m.search_placeholder()}
            bind:value={query}
            on:input={scheduleSearchTerm}
            on:focus={clearPrefill}
            on:keydown={handleKeydown}
            aria-label={m.search_aria_label()}
            autocomplete="off"
            class="w-full rounded-lg border border-[#25784c]/70 bg-white px-4 py-2.5 text-[1.05rem] shadow-[0_8px_24px_-14px_rgba(15,23,42,0.55)] focus:border-[#25784c] focus:outline-none focus:ring-2 focus:ring-[#25784c] focus:ring-offset-1"
          />
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {#if results.length}
              {results.length} {results.length === 1 ? 'result' : 'results'} found
            {/if}
          </div>
          {#if results.length}
            <ul role="listbox" aria-label="Search results" class="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {#each results as result, index}
                {@const slug = toSlug(result.item)}
                {@const href = slug ? `${localeBase}/agency/${slug}` : "#"}
                {@const stops = formatStops(toStops(result.item))}
                <li role="option" aria-selected={index === selectedIndex}>
                  <a
                    {href}
                    on:click={(event) => handleResultClick(event, result.item)}
                    aria-disabled={!slug}
                    class="flex flex-col gap-1 px-4 py-2 text-sm text-slate-900 no-underline hover:bg-[#25784c]/10 {index === selectedIndex ? 'bg-[#25784c]/10' : ''}"
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
        <nav class="hidden items-center justify-end gap-2.5 text-sm md:flex">
          <a href={`${localeBase}/#download`} class="text-slate-700 no-underline hover:text-[#1b613c]">
            {m.home_toc_download()}
          </a>
          <span class="text-slate-300">•</span>
          <a href={`${localeBase}/#about`} class="text-slate-700 no-underline hover:text-[#1b613c]">
            {m.home_toc_learn()}
          </a>
        </nav>
      </div>
    </div>
  </div>

  {#if mobileMenuOpen}
    <div
      id="mobile-site-menu"
      class="fixed inset-x-0 z-40 overflow-y-auto border-t border-slate-200 bg-white md:hidden"
      style={`top: ${headerHeight}px; height: calc(100dvh - ${headerHeight}px);`}
    >
      <div class="flex min-h-full flex-col px-6 py-6">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Menu</p>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold uppercase tracking-wide text-slate-600"
            on:click={() => closeMenu("close_button")}
          >
            Close
          </button>
        </div>

        <p class="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Explore</p>
        <nav class="mt-3 space-y-3">
          <a
            href={`${localeBase}/#download`}
            class="block text-3xl font-semibold leading-tight text-slate-900 no-underline"
            on:click={() => closeMenu("nav")}
          >
            {m.home_toc_download()}
          </a>
          <a
            href={`${localeBase}/#about`}
            class="block text-3xl font-semibold leading-tight text-slate-900 no-underline"
            on:click={() => closeMenu("nav")}
          >
            {m.home_toc_learn()}
          </a>
        </nav>

        {#if showLanguageSwitcher}
          <div class="mt-10">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Language</p>
            <div class="mt-3 grid grid-cols-2 gap-2">
              {#each locales as locale}
                <button
                  type="button"
                  class={`rounded-lg border px-3 py-2 text-sm font-semibold uppercase tracking-wide ${
                    locale === currentLocale
                      ? "border-[#318c5d] bg-[#318c5d] text-white"
                      : "border-slate-200 text-slate-700"
                  }`}
                  on:click={() => switchLocale(locale)}
                >
                  {locale.toUpperCase()}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="mt-auto pt-8">
          <a
            href={donateUrl}
            class="inline-flex w-full items-center justify-center rounded-lg bg-[#25784c] px-4 py-3 text-base font-semibold text-white no-underline transition-colors hover:bg-[#1b613c]"
            on:click={() => closeMenu("donate")}
          >
            {m.home_donate_button()}
          </a>
        </div>
      </div>
    </div>
  {/if}
</header>
