<script>
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import HomeAgencyMetricTable from "$lib/components/HomeAgencyMetricTable.svelte";
  import {
    home_highlights_heading,
    home_toc_download,
    home_footer_cta,
    home_footer_contact,
    home_hero_headline,
    home_why_text,
    home_chart_total_stops_heading,
    home_chart_total_stops_subheading,
    home_chart_total_stops_aria_label,
    home_chart_point_total_stops_label,
    home_chart_point_stops_tooltip,
    home_chart_consent_heading,
    home_chart_consent_subheading,
    home_chart_consent_aria_label,
    home_chart_point_consent_label,
    home_chart_race_heading,
    home_chart_race_subheading,
    home_chart_race_aria_label,
    home_chart_population_label,
    home_chart_traffic_stops_label,
    home_chart_outcomes_heading,
    home_chart_outcomes_subheading,
    home_chart_outcomes_note,
    home_outcome_warnings,
    home_outcome_citations,
    home_outcome_arrests,
    home_outcome_no_action,
    home_download_description,
    home_download_format_fallback,
    home_download_loading,
    home_download_csv_description,
    home_download_parquet_description,
    home_download_json_description,
    home_download_label_agency_list,
    home_download_label_agency_comments,
    home_download_label_raw_stops,
    home_download_label_all_combined,
    home_download_label_vsr_statistics,
    home_download_v2_heading,
    home_download_v1_heading,
    home_download_wide_heading,
    home_download_wide_description,
    home_download_wide_all_title,
    home_download_wide_all_subtitle,
    home_download_wide_year_title,
    home_download_wide_year_subtitle,
    home_download_wide_year_picker_label,
    home_download_about_note,
    home_about_link,
    home_287g_link,
    home_mcp_banner_tag,
    home_mcp_banner_text,
    home_mcp_banner_cta,
    home_mcp_heading,
    home_mcp_intro,
    home_mcp_who_heading,
    home_mcp_who_text,
    home_mcp_connect_heading,
    home_mcp_connect_intro,
    home_mcp_connect_path_macos,
    home_mcp_connect_path_windows,
    home_mcp_copy_button,
    home_mcp_copy_button_done,
    home_mcp_examples_heading,
    home_mcp_example_1,
    home_mcp_example_2,
    home_mcp_example_3,
    home_mcp_endpoint_label,
    home_mcp_docs_link,
  } from "$lib/paraglide/messages";
  import { raceColors, raceTextColors, outcomeColors } from "$lib/colors.js";
  import { withDataBase } from "$lib/dataBase";
  import { getLocale } from "$lib/paraglide/runtime";
  import { onMount } from "svelte";

  export let data;

  // Data from server load function
  $: statsData = data.statsData;
  $: historicalData = data.historicalData;
  $: historicalOutcomes = data.historicalOutcomes;

  // About-the-data section: lazy-fetched from /about-data/{locale} when the
  // section approaches the viewport. Removed from SSR to keep the homepage
  // HTML payload small for FCP.
  let aboutSectionEl;
  let aboutDataHtml = "";
  let aboutDataRequested = false;

  async function loadAboutData() {
    if (aboutDataRequested) return;
    aboutDataRequested = true;
    try {
      const r = await fetch(`/about-data/${locale}`);
      if (!r.ok) {
        aboutDataRequested = false;
        return;
      }
      aboutDataHtml = await r.text();
    } catch {
      aboutDataRequested = false;
    }
  }

  onMount(() => {
    if (!aboutSectionEl) return;
    if (typeof IntersectionObserver === "undefined") {
      void loadAboutData();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          obs.disconnect();
          void loadAboutData();
        }
      },
      { rootMargin: "600px 0px 600px 0px" },
    );
    obs.observe(aboutSectionEl);
    return () => obs.disconnect();
  });

  // Tooltip state
  let tooltip = { show: false, x: 0, y: 0, content: "" };
  const donateUrl =
    import.meta.env.PUBLIC_DONATE_URL ??
    "https://buy.stripe.com/6oU9AU1KEa7Z6gcdr6fAc03";

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? "https://vsr.recoveredfactory.net";
  const siteName = "Missouri Vehicle Stops";
  let locale = "en";
  let localeBase = "/en";
  $: {
    try {
      locale = getLocale() || "en";
    } catch {
      locale = "en";
    }
    localeBase = `/${locale}`;
  }
  $: canonicalUrl = `${siteUrl}${localeBase}`;
  $: homeHrefEn = `${siteUrl}/en`;
  $: homeHrefEs = `${siteUrl}/es`;
  $: webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    alternateName: "Missouri Vehicle Stops Report",
    url: `${siteUrl}/`,
    inLanguage: ["en", "es"]
  };
  // Base URL without release path — used for v1 (pre-v2) download links
  const dataBaseUrl = import.meta.env.PUBLIC_DATA_BASE_URL ?? "";

  // MCP endpoint — stage-aware (prod / staging custom domains, dev falls
  // through to staging). Surfaced to the homepage so the banner and the
  // Claude Desktop config snippet always point at the right host.
  const mcpUrl =
    import.meta.env.PUBLIC_MCP_URL ??
    "https://mcp-staging.vsr.recoveredfactory.net/";
  const mcpRepoUrl =
    "https://github.com/recoveredfactory/missouri-vsr-tool/tree/main/packages/mcp";
  $: mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        "missouri-vsr": {
          command: "npx",
          args: ["-y", "mcp-remote", mcpUrl],
        },
      },
    },
    null,
    2,
  );
  let mcpCopyState = "idle";
  async function copyMcpConfig() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(mcpConfigSnippet);
      mcpCopyState = "done";
      trackEvent("mcp_config_copy", { url: mcpUrl });
      setTimeout(() => {
        mcpCopyState = "idle";
      }, 1800);
    } catch {
      mcpCopyState = "idle";
    }
  }

  // Shared download helpers used for both v2 and v1 manifest-driven rendering
  $: downloadGroupMeta = {
    csv:     { title: "CSV",     description: home_download_csv_description() },
    parquet: { title: "Parquet", description: home_download_parquet_description() },
    json:    { title: "JSON",    description: home_download_json_description() },
  };

  function getDownloadLabel(file) {
    if (file.group === "json" && /downloads\.json$/i.test(file.path)) {
      return home_download_label_all_combined();
    }
    if (/vsr_statistics/i.test(file.path)) return home_download_label_vsr_statistics();
    if (/agency_index/i.test(file.path))   return home_download_label_agency_list();
    if (/agency_comments/i.test(file.path)) return home_download_label_agency_comments();
    if (/downloads/i.test(file.path))      return home_download_label_raw_stops();
    return file.path;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) { value /= 1024; idx += 1; }
    const decimals = value >= 100 || idx === 0 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[idx]}`;
  }

  function buildDownloadGroups(manifest) {
    if (!manifest?.files?.length) return [];
    const groups = new Map();
    const orderedGroups = [];
    manifest.files.forEach((file) => {
      const group = file.group || "other";
      if (!groups.has(group)) { groups.set(group, []); orderedGroups.push(group); }
      groups.get(group).push(file);
    });
    const preferred = ["csv", "parquet", "json"];
    const remaining = orderedGroups.filter((g) => !preferred.includes(g));
    return [...preferred.filter((g) => groups.has(g)), ...remaining]
      .map((group) => ({ group, files: groups.get(group) }));
  }

  // Split the v2 manifest: regular long-format files drive the
  // CSV/Parquet/JSON cards; wide-format files drive the dedicated
  // wide section so the per-year slices don't blow up the format
  // cards into a wall of links.
  $: v2RegularFiles = (data?.v2DownloadManifest?.files ?? []).filter(
    (f) =>
      f.path.startsWith(data?.v2DownloadManifest?.prefix ?? "") && f.format !== "wide",
  );
  $: v2DownloadGroups = buildDownloadGroups(
    data?.v2DownloadManifest && { ...data.v2DownloadManifest, files: v2RegularFiles },
  );
  $: v1DownloadGroups = buildDownloadGroups(data?.v1DownloadManifest);

  // Wide-format downloads: pulled from the manifest entries tagged
  // `format: "wide"`. The all-years bundle has no `year` field; the
  // per-year slices do. Year list comes from the per-year entries
  // themselves so we only offer years that actually have a file.
  $: wideFiles = (data?.v2DownloadManifest?.files ?? []).filter((f) => f.format === "wide");
  $: wideAllYears = {
    csv: wideFiles.find((f) => f.group === "csv" && f.year === undefined),
    parquet: wideFiles.find((f) => f.group === "parquet" && f.year === undefined),
  };
  $: widePerYear = wideFiles.filter((f) => typeof f.year === "number");
  $: wideYears = [...new Set(widePerYear.map((f) => f.year))].sort((a, b) => b - a);
  let selectedWideYear = null;
  $: if (selectedWideYear === null && wideYears.length) selectedWideYear = wideYears[0];
  $: wideSelectedFiles = {
    csv: widePerYear.find((f) => f.group === "csv" && f.year === selectedWideYear),
    parquet: widePerYear.find((f) => f.group === "parquet" && f.year === selectedWideYear),
  };
  $: hasWideDownloads = Boolean(wideAllYears.csv || wideAllYears.parquet || widePerYear.length);
  function handleWideDownload(file, href) {
    trackEvent("download_click", { file: file?.path, group: file?.group, href });
  }

  function showTooltip(event, content) {
    const el = event.currentTarget || event.target;
    const rect = el.getBoundingClientRect();
    tooltip = {
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      content
    };
  }

  function hideTooltip() {
    tooltip = { ...tooltip, show: false };
  }

  function handleDownloadClick(file, href) {
    trackEvent("download_click", {
      file: file?.path,
      group: file?.group,
      href,
    });
  }

  // For axis labels: whole numbers (123K, 1M)
  const formatStopsAxis = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return "0";
    if (numeric >= 1000000) {
      return `${Math.round(numeric / 1000000)}M`;
    }
    if (numeric >= 1000) {
      return `${Math.round(numeric / 1000)}K`;
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
  };

  // For tooltips and labels: one decimal (123.4K, 1.2M)
  const formatStops = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return "0";
    if (numeric >= 1000000) {
      return `${(numeric / 1000000).toFixed(2)}M`;
    }
    if (numeric >= 1000) {
      return `${(numeric / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
  };

</script>

<svelte:head>
  <title>{siteName}</title>
  <meta name="application-name" content={siteName} />
  <meta name="apple-mobile-web-app-title" content={siteName} />
  <link rel="canonical" href={canonicalUrl} />
  <link rel="alternate" hreflang="en" href={homeHrefEn} />
  <link rel="alternate" hreflang="es" href={homeHrefEs} />
  <link rel="alternate" hreflang="x-default" href={homeHrefEn} />
  <meta
    name="description"
    content="Who gets stopped? why? What happens next? This tool reveals how traffic enforcement varies across Missouri's agencies."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:title" content={siteName} />
  <meta
    property="og:description"
    content="Who gets stopped? why? What happens next? This tool reveals how traffic enforcement varies across Missouri's agencies."
  />
  <meta property="og:image" content="{siteUrl}/og/home.png" />
  <meta property="og:image:secure_url" content="{siteUrl}/og/home.png" />
  <meta property="og:image:alt" content="Missouri Vehicle Stops overview" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:image" content="{siteUrl}/og/home.png" />
  <meta property="twitter:title" content={siteName} />
  <meta
    property="twitter:description"
    content="Who gets stopped? why? What happens next? This tool reveals how traffic enforcement varies across Missouri's agencies."
  />
  {@html `<script type="application/ld+json">${JSON.stringify(webSiteSchema)}</script>`}
</svelte:head>

<StickyHeader agencies={data.agencies} />

<main id="main-content" class="min-h-screen bg-white overflow-x-hidden">
  <!-- MCP launch banner — points to #mcp section below -->
  <a
    href="#mcp"
    on:click={() => trackEvent("mcp_banner_click", { target: "section" })}
    class="block bg-[#1b613c] text-white no-underline transition-colors hover:bg-[#105430] focus:outline-none focus:ring-2 focus:ring-[#1b613c] focus:ring-offset-2"
  >
    <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-center text-sm sm:px-6">
      <span class="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        {home_mcp_banner_tag()}
      </span>
      <span class="font-medium">{home_mcp_banner_text()}</span>
      <span class="inline-flex items-center font-semibold underline decoration-white/40 underline-offset-4 hover:decoration-white">
        {home_mcp_banner_cta()} <span aria-hidden="true" class="ml-1">→</span>
      </span>
    </div>
  </a>

  <!-- Hero Section -->
  <section class="bg-white px-6 py-12">
    <div class="mx-auto max-w-3xl flex flex-col md:flex-row md:items-center gap-8">
      <div class="flex-1 text-center md:text-left">
        <h1 class="text-4xl font-bold text-slate-900 md:text-5xl leading-tight">
          {home_hero_headline()}
        </h1>
        <p class="mt-4 text-lg leading-relaxed text-slate-700">
          {home_why_text()}
        </p>
      </div>
      {#if locale === 'en'}
        <div class="flex justify-center md:justify-end md:flex-shrink-0">
          <iframe
            class="w-[70vw] md:w-52 rounded-lg"
            style="aspect-ratio: 9/16"
            src="https://www.youtube.com/embed/Oboc38ZD6hY"
            title="Missouri Vehicle Stops Report video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </div>
      {/if}
    </div>
  </section>

  <!-- Highlights Grid -->
  <section id="findings" class="border-t border-slate-200 bg-slate-50 py-12">
    <div class="mx-auto max-w-6xl px-6">
      <h2 class="mb-8 text-center text-3xl font-bold text-slate-900">
        {home_highlights_heading()}
      </h2>

      <div class="flex flex-col gap-6">
        <!-- Charts 1a & 1b: Total Stops and Consent Searches side-by-side -->
        <div class="grid gap-6 md:grid-cols-2">
          <!-- Chart 1a: Total Stops -->
          <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
            <div class="mb-3 sm:mb-4 text-center">
              <h3 class="text-lg sm:text-xl font-bold text-slate-900">
                {home_chart_total_stops_heading()}
              </h3>
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                {home_chart_total_stops_subheading()}
              </p>
            </div>

            {#if historicalData?.totalStops?.length}
              {@const years = historicalData.years}
              {@const stops = historicalData.totalStops}
              {@const padding = { top: 24, right: 12, bottom: 35, left: 45 }}
              {@const width = 260}
              {@const height = 180}
              {@const stopsMax = Math.ceil(Math.max(...stops) / 200000) * 200000}
              {@const stopsColor = "#25784c"}

              <div class="sr-only">
                Data summary: From {years[0]} to {years[years.length - 1]}, total stops ranged from {formatStops(Math.min(...stops))} to {formatStops(Math.max(...stops))}.
              </div>
              <div class="flex flex-col" role="img" aria-label={home_chart_total_stops_aria_label()}>
                <svg viewBox="0 0 {width + padding.left + padding.right} {height + padding.top + padding.bottom}" class="w-full h-[220px] sm:h-[260px] md:h-[280px]">
                  <!-- Grid lines -->
                  {#each [0, 0.25, 0.5, 0.75, 1] as tick}
                    <line x1={padding.left} y1={padding.top + (1-tick) * height} x2={padding.left + width} y2={padding.top + (1-tick) * height} stroke="#e2e8f0" stroke-width="0.5" />
                  {/each}

                  <!-- X-axis -->
                  <line x1={padding.left} y1={padding.top + height} x2={padding.left + width} y2={padding.top + height} stroke="#94a3b8" stroke-width="1" />

                  <!-- Y-axis labels -->
                  <text x={padding.left - 8} y={padding.top + 4} text-anchor="end" font-size="8" fill="#64748b" font-weight="600">{formatStopsAxis(stopsMax)}</text>
                  <text x={padding.left - 8} y={padding.top + height/2 + 3} text-anchor="end" font-size="8" fill="#64748b" font-weight="600">{formatStopsAxis(stopsMax/2)}</text>
                  <text x={padding.left - 8} y={padding.top + height + 3} text-anchor="end" font-size="8" fill="#64748b" font-weight="600">0</text>

                  <!-- X-axis year labels: every 5th year + last -->
                  {#each years as year, i}
                    {#if year % 5 === 0 || i === years.length - 1}
                      <text x={padding.left + (i / (years.length - 1)) * width} y={padding.top + height + 16} text-anchor="middle" font-size="9" fill="#64748b">{year}</text>
                    {/if}
                  {/each}

                  <!-- Total Stops line -->
                  <polyline
                    fill="none"
                    stroke={stopsColor}
                    stroke-width="2.5"
                    points={stops.map((v, i) => `${padding.left + (i / (years.length - 1)) * width},${padding.top + (1 - v / stopsMax) * height}`).join(" ")}
                  />
                  {#each stops as v, i}
                    <g
                      class="cursor-pointer"
                      tabindex="0"
                      role="button"
                      aria-label={home_chart_point_total_stops_label({ year: years[i], stops: formatStops(v) })}
                      on:mouseenter={(e) => showTooltip(e, home_chart_point_stops_tooltip({ year: years[i], stops: formatStops(v) }))}
                      on:mouseleave={hideTooltip}
                      on:focus={(e) => showTooltip(e, home_chart_point_stops_tooltip({ year: years[i], stops: formatStops(v) }))}
                      on:blur={hideTooltip}
                    >
                      <circle cx={padding.left + (i / (years.length - 1)) * width} cy={padding.top + (1 - v / stopsMax) * height} r="8" fill="transparent" />
                      <circle cx={padding.left + (i / (years.length - 1)) * width} cy={padding.top + (1 - v / stopsMax) * height} r="3.5" fill={stopsColor} class="pointer-events-none" />
                    </g>
                  {/each}
                </svg>
              </div>
            {/if}
          </div>

          <!-- Chart 1b: Consent Searches -->
          <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
            <div class="mb-3 sm:mb-4 text-center">
              <h3 class="text-lg sm:text-xl font-bold text-slate-900">
                {home_chart_consent_heading()}
              </h3>
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                {home_chart_consent_subheading()}
              </p>
            </div>

            {#if historicalData?.consentSearches?.length}
              {@const years = historicalData.years}
              {@const consent = historicalData.consentSearches}
              {@const padding = { top: 24, right: 12, bottom: 35, left: 45 }}
              {@const width = 260}
              {@const height = 180}
              {@const consentMax = Math.ceil(Math.max(...consent) / 10000) * 10000}
              {@const consentColor = "#792a3b"}

              <div class="sr-only">
                Data summary: Consent searches dropped from {formatStops(consent[0])} in {years[0]} to {formatStops(consent[consent.length - 1])} in {years[years.length - 1]}, a {Math.round((1 - consent[consent.length - 1] / consent[0]) * 100)}% decline.
              </div>
              <div class="flex flex-col" role="img" aria-label={home_chart_consent_aria_label()}>
                <svg viewBox="0 0 {width + padding.left + padding.right} {height + padding.top + padding.bottom}" class="w-full h-[220px] sm:h-[260px] md:h-[280px]">
                  <!-- Grid lines -->
                  {#each [0, 0.25, 0.5, 0.75, 1] as tick}
                    <line x1={padding.left} y1={padding.top + (1-tick) * height} x2={padding.left + width} y2={padding.top + (1-tick) * height} stroke="#e2e8f0" stroke-width="0.5" />
                  {/each}

                  <!-- X-axis -->
                  <line x1={padding.left} y1={padding.top + height} x2={padding.left + width} y2={padding.top + height} stroke="#94a3b8" stroke-width="1" />

                  <!-- Y-axis labels -->
                  <text x={padding.left - 8} y={padding.top + 4} text-anchor="end" font-size="8" fill="#64748b" font-weight="600">{formatStopsAxis(consentMax)}</text>
                  <text x={padding.left - 8} y={padding.top + height/2 + 3} text-anchor="end" font-size="8" fill="#64748b" font-weight="600">{formatStopsAxis(consentMax/2)}</text>
                  <text x={padding.left - 8} y={padding.top + height + 3} text-anchor="end" font-size="8" fill="#64748b" font-weight="600">0</text>

                  <!-- X-axis year labels: every 5th year + last -->
                  {#each years as year, i}
                    {#if year % 5 === 0 || i === years.length - 1}
                      <text x={padding.left + (i / (years.length - 1)) * width} y={padding.top + height + 16} text-anchor="middle" font-size="9" fill="#64748b">{year}</text>
                    {/if}
                  {/each}

                  <!-- Consent Searches line -->
                  <polyline
                    fill="none"
                    stroke={consentColor}
                    stroke-width="2.5"
                    points={consent.map((v, i) => `${padding.left + (i / (years.length - 1)) * width},${padding.top + (1 - v / consentMax) * height}`).join(" ")}
                  />
                  {#each consent as v, i}
                    <g
                      class="cursor-pointer"
                      tabindex="0"
                      role="button"
                      aria-label={home_chart_point_consent_label({ year: years[i], searches: formatStops(v) })}
                      on:mouseenter={(e) => showTooltip(e, home_chart_point_consent_label({ year: years[i], searches: formatStops(v) }))}
                      on:mouseleave={hideTooltip}
                      on:focus={(e) => showTooltip(e, home_chart_point_consent_label({ year: years[i], searches: formatStops(v) }))}
                      on:blur={hideTooltip}
                    >
                      <circle cx={padding.left + (i / (years.length - 1)) * width} cy={padding.top + (1 - v / consentMax) * height} r="8" fill="transparent" />
                      <circle cx={padding.left + (i / (years.length - 1)) * width} cy={padding.top + (1 - v / consentMax) * height} r="3.5" fill={consentColor} class="pointer-events-none" />
                    </g>
                  {/each}
                </svg>
              </div>
            {/if}
          </div>
        </div>

        <!-- Charts 2 & 3: Side-by-side on desktop -->
        <div class="grid gap-6 md:grid-cols-2">
          <!-- Chart 2: Population vs Stops Comparison -->
          <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
            <div class="mb-3 sm:mb-4 text-center">
              <h3 class="text-lg sm:text-xl font-bold text-slate-900">
                {home_chart_race_heading()}
              </h3>
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                {home_chart_race_subheading()}
              </p>
            </div>

            {#if statsData}
              {@const population = { White: 78.7, Black: 10.7, Hispanic: 4.3, Other: 6.3 }}
          {@const totalStops = statsData.total_stops}
          {@const stopsData2 = {
            White: (statsData.by_race.all_stops.White / totalStops) * 100,
            Black: (statsData.by_race.all_stops.Black / totalStops) * 100,
            Hispanic: (statsData.by_race.all_stops.Hispanic / totalStops) * 100,
            Other: 100 - (statsData.by_race.all_stops.White / totalStops) * 100 - (statsData.by_race.all_stops.Black / totalStops) * 100 - (statsData.by_race.all_stops.Hispanic / totalStops) * 100
          }}
          {@const raceOrder = ["White", "Black", "Hispanic", "Other"]}
          {@const maxVal = Math.max(...raceOrder.map(r => Math.max(population[r], stopsData2[r])))}
          {@const popColor = "#25784c"}
          {@const stopsColor2 = "#1c4f74"}
          {@const padding2 = { top: 12, right: 12, bottom: 40, left: 35 }}
          {@const width2 = 300}
          {@const height2 = 180}
          {@const groupWidth = width2 / raceOrder.length}
          {@const barWidth = groupWidth * 0.32}
          {@const barGap = 3}
          {@const niceMax = Math.ceil(maxVal / 10) * 10}

          <!-- Screen reader data summary -->
          <div class="sr-only">
            Data summary: Population vs traffic stops by race. White: {population.White}% population, {stopsData2.White.toFixed(1)}% stops. Black: {population.Black}% population, {stopsData2.Black.toFixed(1)}% stops. Hispanic: {population.Hispanic}% population, {stopsData2.Hispanic.toFixed(1)}% stops. Other: {population.Other}% population, {stopsData2.Other.toFixed(1)}% stops.
          </div>
          <div class="flex flex-col" role="img" aria-label={home_chart_race_aria_label()}>
            <svg viewBox="0 0 {width2 + padding2.left + padding2.right} {height2 + padding2.top + padding2.bottom}" class="w-full h-[220px] sm:h-[260px] md:h-[280px]">
              <!-- Grid lines -->
              {#each [0, 0.25, 0.5, 0.75, 1] as tick}
                <line x1={padding2.left} y1={padding2.top + (1-tick) * height2} x2={padding2.left + width2} y2={padding2.top + (1-tick) * height2} stroke="#e2e8f0" stroke-width="0.5" />
              {/each}

              <!-- Y-axis -->
              <line x1={padding2.left} y1={padding2.top + height2} x2={padding2.left + width2} y2={padding2.top + height2} stroke="#94a3b8" stroke-width="1" />
              <text x={padding2.left - 6} y={padding2.top + 4} text-anchor="end" font-size="8" fill="#64748b">{niceMax}%</text>
              <text x={padding2.left - 6} y={padding2.top + height2/2 + 3} text-anchor="end" font-size="8" fill="#64748b">{niceMax/2}%</text>
              <text x={padding2.left - 6} y={padding2.top + height2 + 3} text-anchor="end" font-size="8" fill="#64748b">0%</text>

              <!-- Grouped bars -->
              {#each raceOrder as race, i}
                {@const groupX = padding2.left + i * groupWidth + groupWidth / 2}
                {@const popVal = population[race]}
                {@const stopVal = stopsData2[race]}
                {@const popH = (popVal / niceMax) * height2}
                {@const stopH = (stopVal / niceMax) * height2}

                <!-- Population bar (left) -->
                <rect
                  x={groupX - barWidth - barGap/2}
                  y={padding2.top + height2 - popH}
                  width={barWidth}
                  height={popH}
                  fill={popColor}
                  rx="2"
                  tabindex="0"
                  role="button"
                  aria-label="{race} population: {popVal.toFixed(1)}%"
                  class="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-teal-400"
                  on:mouseenter={(e) => showTooltip(e, `${race} population: ${popVal.toFixed(1)}%`)}
                  on:mouseleave={hideTooltip}
                  on:focus={(e) => showTooltip(e, `${race} population: ${popVal.toFixed(1)}%`)}
                  on:blur={hideTooltip}
                />
                <!-- Population value label -->
                <text
                  x={groupX - barWidth/2 - barGap/2}
                  y={padding2.top + height2 - popH - 4}
                  text-anchor="middle"
                  font-size="8"
                  fill={popColor}
                  font-weight="600"
                >{popVal.toFixed(1)}%</text>

                <!-- Stops bar (right) -->
                <rect
                  x={groupX + barGap/2}
                  y={padding2.top + height2 - stopH}
                  width={barWidth}
                  height={stopH}
                  fill={stopsColor2}
                  rx="2"
                  tabindex="0"
                  role="button"
                  aria-label="{race} traffic stops: {stopVal.toFixed(1)}%"
                  class="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-slate-400"
                  on:mouseenter={(e) => showTooltip(e, `${race} stops: ${stopVal.toFixed(1)}%`)}
                  on:mouseleave={hideTooltip}
                  on:focus={(e) => showTooltip(e, `${race} stops: ${stopVal.toFixed(1)}%`)}
                  on:blur={hideTooltip}
                />
                <!-- Stops value label -->
                <text
                  x={groupX + barWidth/2 + barGap/2}
                  y={padding2.top + height2 - stopH - 4}
                  text-anchor="middle"
                  font-size="8"
                  fill={stopsColor2}
                  font-weight="600"
                >{stopVal.toFixed(1)}%</text>

                <!-- Race label -->
                <text x={groupX} y={padding2.top + height2 + 14} text-anchor="middle" font-size="9" fill="#0f293c" font-weight="600">{race}</text>
              {/each}
            </svg>

            <!-- Legend -->
            <div class="flex justify-center gap-5 mt-1">
              <span class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm" style="background-color: {popColor}"></span>
                <span class="text-xs font-medium" style="color: {popColor}">{home_chart_population_label()}</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm" style="background-color: {stopsColor2}"></span>
                <span class="text-xs font-medium" style="color: {stopsColor2}">{home_chart_traffic_stops_label()}</span>
              </span>
            </div>

            </div>
            {/if}
          </div>

          <!-- Chart 3: Outcome Rates - Multi-Series Line Chart -->
          <div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col">
            <div class="mb-3 sm:mb-4 text-center">
              <h3 class="text-lg sm:text-xl font-bold text-slate-900">
                {home_chart_outcomes_heading()}
              </h3>
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                {home_chart_outcomes_subheading()}
              </p>
            </div>

            {#if historicalOutcomes}
              {@const outcomeLabels = { warnings: home_outcome_warnings(), citations: home_outcome_citations(), arrests: home_outcome_arrests(), noAction: home_outcome_no_action() }}
              {@const seriesKeys = ["warnings", "citations", "arrests", "noAction"]}
              {@const years3 = historicalOutcomes.years}
              {@const padding3 = { top: 12, right: 12, bottom: 35, left: 35 }}
              {@const width3 = 280}
              {@const height3 = 200}
              {@const allValues = historicalOutcomes.data.flatMap(d => seriesKeys.map(k => d[k] ?? 0))}
              {@const yMax = Math.ceil(Math.max(...allValues) / 10) * 10}
              {@const yTicks = [0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round(yMax * 3 / 4), yMax]}

              <!-- Screen reader data summary -->
              <div class="sr-only">
                Data summary: Stop outcome rates by year. {#each historicalOutcomes.data as d}{d.year}: {(d.warnings ?? 0).toFixed(0)}% warnings, {(d.citations ?? 0).toFixed(0)}% citations, {(d.arrests ?? 0).toFixed(0)}% arrests, {(d.noAction ?? 0).toFixed(0)}% no action. {/each}
              </div>
              <div class="flex flex-col" role="img" aria-label="Line chart showing stop outcome rates by year">
                <svg viewBox="0 0 {width3 + padding3.left + padding3.right} {height3 + padding3.top + padding3.bottom}" class="w-full h-[220px] sm:h-[260px] md:h-[280px]">
                  <!-- Grid lines -->
                  {#each yTicks as tick}
                    <line x1={padding3.left} y1={padding3.top + (1 - tick / yMax) * height3} x2={padding3.left + width3} y2={padding3.top + (1 - tick / yMax) * height3} stroke="#e2e8f0" stroke-width="0.5" />
                  {/each}

                  <!-- X-axis -->
                  <line x1={padding3.left} y1={padding3.top + height3} x2={padding3.left + width3} y2={padding3.top + height3} stroke="#94a3b8" stroke-width="1" />

                  <!-- Y-axis labels -->
                  {#each yTicks as tick}
                    <text x={padding3.left - 6} y={padding3.top + (1 - tick / yMax) * height3 + 3} text-anchor="end" font-size="8" fill="#64748b">{tick}%</text>
                  {/each}

                  <!-- X-axis year labels: every 5th year + last -->
                  {#each years3 as year, i}
                    {#if year % 5 === 0 || i === years3.length - 1}
                      <text x={padding3.left + (i / (years3.length - 1)) * width3} y={padding3.top + height3 + 16} text-anchor="middle" font-size="9" fill="#64748b">{year}</text>
                    {/if}
                  {/each}

                  <!-- Lines + data points for each outcome -->
                  {#each seriesKeys as key}
                    {@const color = outcomeColors[key]}
                    {@const values = historicalOutcomes.data.map(d => d[key] ?? 0)}

                    <!-- Line -->
                    <polyline
                      fill="none"
                      stroke={color}
                      stroke-width="2.5"
                      points={values.map((v, i) => `${padding3.left + (i / (years3.length - 1)) * width3},${padding3.top + (1 - v / yMax) * height3}`).join(" ")}
                    />

                    <!-- Data point circles -->
                    {#each values as v, i}
                      <g
                        class="cursor-pointer"
                        tabindex="0"
                        role="button"
                        aria-label="{outcomeLabels[key]}: {v.toFixed(1)}% in {years3[i]}"
                        on:mouseenter={(e) => showTooltip(e, `${outcomeLabels[key]}: ${v.toFixed(1)}% (${years3[i]})`)}
                        on:mouseleave={hideTooltip}
                        on:focus={(e) => showTooltip(e, `${outcomeLabels[key]}: ${v.toFixed(1)}% (${years3[i]})`)}
                        on:blur={hideTooltip}
                      >
                        <circle cx={padding3.left + (i / (years3.length - 1)) * width3} cy={padding3.top + (1 - v / yMax) * height3} r="8" fill="transparent" />
                        <circle cx={padding3.left + (i / (years3.length - 1)) * width3} cy={padding3.top + (1 - v / yMax) * height3} r="3" fill={color} class="pointer-events-none" />
                      </g>
                    {/each}
                  {/each}
                </svg>

                <!-- Compact legend -->
                <div class="flex flex-wrap justify-center gap-3 mt-1">
                  {#each seriesKeys as key}
                    <span class="flex items-center gap-1">
                      <span class="w-2.5 h-2.5 rounded-sm" style="background-color: {outcomeColors[key]}"></span>
                      <span class="text-[10px] text-slate-600">{outcomeLabels[key]}</span>
                    </span>
                  {/each}
                </div>
                <p class="mt-2 text-center text-[10px] text-slate-500">{home_chart_outcomes_note()}</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </section>

  <HomeAgencyMetricTable agencies={data.agencies} />

  <div class="mx-auto mt-2 max-w-5xl px-4 pb-8 text-sm text-slate-600 sm:px-6">
    <a class="underline" href={`/${locale}/287g`}>{home_287g_link()}</a>
  </div>

  <!-- Download Section -->
  <section id="download" class="border-t border-slate-200 bg-white py-12">
    <div class="mx-auto max-w-4xl px-6">
      <h2 class="mb-6 text-center text-3xl font-bold text-slate-900">
        {home_toc_download()}
      </h2>
      <p class="mb-8 text-center text-lg text-slate-700">
        {home_download_description()}
      </p>

      <!-- v2 downloads — manifest-driven so JSON shows as one combined file -->
      <p class="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
        {home_download_v2_heading()}
      </p>
      {#if v2DownloadGroups.length}
        <div class="grid gap-6 md:grid-cols-3">
          {#each v2DownloadGroups as downloadGroup}
            <div class="flex flex-col rounded-lg border-2 border-slate-200 bg-slate-50 p-6 text-center">
              <h3 class="mb-2 text-xl font-bold text-slate-900">
                {downloadGroupMeta[downloadGroup.group]?.title ?? downloadGroup.group.toUpperCase()}
              </h3>
              <p class="mb-4 min-h-[72px] text-sm text-slate-600">
                {downloadGroupMeta[downloadGroup.group]?.description ?? home_download_format_fallback()}
              </p>
              {#each downloadGroup.files as file, i (file.path)}
                <a
                  href={withDataBase(`/data/downloads/${file.path}`)}
                  download
                  on:click={() => handleDownloadClick(file, withDataBase(`/data/downloads/${file.path}`))}
                  class={`block rounded-lg bg-[#1b613c] px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#105430] ${i < downloadGroup.files.length - 1 ? "mb-3" : ""}`}
                >
                  <span class="block">{getDownloadLabel(file)}</span>
                  {#if file.size_bytes}
                    <span class="mt-1 block text-[11px] font-medium text-white/85">{formatBytes(file.size_bytes)}</span>
                  {/if}
                </a>
              {/each}
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex h-[180px] items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50">
          <span class="text-sm text-slate-500">{home_download_loading()}</span>
        </div>
      {/if}

      <!-- Wide-format (one row per agency-year) — bespoke section
           with year picker. Driven by manifest entries tagged
           format: "wide" so sizes and the year list track the
           pipeline output. Hidden entirely when no wide files are
           published. -->
      {#if hasWideDownloads}
        <div class="mt-10 border-t border-slate-100 pt-8">
          <p class="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            {home_download_wide_heading()}
          </p>
          <p class="mx-auto mb-6 max-w-2xl text-center text-sm text-slate-600">
            {home_download_wide_description()}
          </p>
          <div class="grid gap-6 md:grid-cols-2">
            <div class="flex flex-col rounded-lg border-2 border-slate-200 bg-slate-50 p-6 text-center">
              <h3 class="mb-1 text-lg font-bold text-slate-900">
                {home_download_wide_all_title()}
              </h3>
              <p class="mb-4 min-h-[40px] text-sm text-slate-600">
                {home_download_wide_all_subtitle()}
              </p>
              {#if wideAllYears.csv}
                <a
                  href={withDataBase(`/data/downloads/${wideAllYears.csv.path}`)}
                  download
                  on:click={() => handleWideDownload(wideAllYears.csv, withDataBase(`/data/downloads/${wideAllYears.csv.path}`))}
                  class="mb-3 block rounded-lg bg-[#1b613c] px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#105430]"
                >
                  <span class="block">CSV</span>
                  {#if wideAllYears.csv.size_bytes}
                    <span class="mt-1 block text-[11px] font-medium text-white/85">{formatBytes(wideAllYears.csv.size_bytes)}</span>
                  {/if}
                </a>
              {/if}
              {#if wideAllYears.parquet}
                <a
                  href={withDataBase(`/data/downloads/${wideAllYears.parquet.path}`)}
                  download
                  on:click={() => handleWideDownload(wideAllYears.parquet, withDataBase(`/data/downloads/${wideAllYears.parquet.path}`))}
                  class="block rounded-lg border-2 border-[#1b613c] px-5 py-2 text-sm font-semibold text-[#1b613c] no-underline transition-colors hover:bg-[#1b613c] hover:text-white"
                >
                  <span class="block">Parquet</span>
                  {#if wideAllYears.parquet.size_bytes}
                    <span class="mt-0.5 block text-[11px] font-medium opacity-80">{formatBytes(wideAllYears.parquet.size_bytes)}</span>
                  {/if}
                </a>
              {/if}
            </div>

            <div class="flex flex-col rounded-lg border-2 border-slate-200 bg-slate-50 p-6 text-center">
              <h3 class="mb-1 text-lg font-bold text-slate-900">
                {home_download_wide_year_title()}
              </h3>
              <p class="mb-4 min-h-[40px] text-sm text-slate-600">
                {home_download_wide_year_subtitle()}
              </p>
              {#if wideYears.length}
                <label class="mb-3 flex items-center justify-center gap-2 text-sm text-slate-600">
                  <span>{home_download_wide_year_picker_label()}</span>
                  <select
                    bind:value={selectedWideYear}
                    class="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900"
                  >
                    {#each wideYears as y}
                      <option value={y}>{y}</option>
                    {/each}
                  </select>
                </label>
                {#if wideSelectedFiles.csv}
                  <a
                    href={withDataBase(`/data/downloads/${wideSelectedFiles.csv.path}`)}
                    download
                    on:click={() => handleWideDownload(wideSelectedFiles.csv, withDataBase(`/data/downloads/${wideSelectedFiles.csv.path}`))}
                    class="mb-3 block rounded-lg bg-[#1b613c] px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#105430]"
                  >
                    <span class="block">CSV — {selectedWideYear}</span>
                    {#if wideSelectedFiles.csv.size_bytes}
                      <span class="mt-1 block text-[11px] font-medium text-white/85">{formatBytes(wideSelectedFiles.csv.size_bytes)}</span>
                    {/if}
                  </a>
                {/if}
                {#if wideSelectedFiles.parquet}
                  <a
                    href={withDataBase(`/data/downloads/${wideSelectedFiles.parquet.path}`)}
                    download
                    on:click={() => handleWideDownload(wideSelectedFiles.parquet, withDataBase(`/data/downloads/${wideSelectedFiles.parquet.path}`))}
                    class="block rounded-lg border-2 border-[#1b613c] px-5 py-2 text-sm font-semibold text-[#1b613c] no-underline transition-colors hover:bg-[#1b613c] hover:text-white"
                  >
                    <span class="block">Parquet — {selectedWideYear}</span>
                    {#if wideSelectedFiles.parquet.size_bytes}
                      <span class="mt-0.5 block text-[11px] font-medium opacity-80">{formatBytes(wideSelectedFiles.parquet.size_bytes)}</span>
                    {/if}
                  </a>
                {/if}
              {:else}
                <span class="text-sm text-slate-500">{home_download_loading()}</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Previous release (v1, 2020–2024) — simple link list -->
      <div class="mt-10 border-t border-slate-100 pt-6">
        <p class="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          {home_download_v1_heading()}
        </p>
        {#if v1DownloadGroups.length}
          <div class="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {#each v1DownloadGroups as downloadGroup}
              {#each downloadGroup.files as file (file.path)}
                <a
                  href="{dataBaseUrl}/downloads/{file.path}"
                  download
                  on:click={() => handleDownloadClick(file, `${dataBaseUrl}/downloads/${file.path}`)}
                  class="text-sm text-slate-500 no-underline hover:text-slate-800"
                >
                  {getDownloadLabel(file)}
                  <span class="font-mono text-xs uppercase text-slate-400">.{downloadGroup.group}</span>
                  {#if file.size_bytes}
                    <span class="text-xs text-slate-400">({formatBytes(file.size_bytes)})</span>
                  {/if}
                </a>
              {/each}
            {/each}
          </div>
        {:else}
          <p class="text-center text-sm text-slate-400">{home_download_loading()}</p>
        {/if}
      </div>

      <p class="mt-8 text-center text-sm text-slate-600">
        {@html home_download_about_note({ link: `<a href="#about" class="text-[#1b613c] underline hover:text-[#105430]">${home_about_link()}</a>` })}
      </p>
    </div>
  </section>

  <!-- Hire Us CTA -->
  <section class="border-t border-slate-200 bg-white py-8 sm:py-10">
    <div class="mx-auto max-w-4xl px-6 text-center">
      <p class="mb-4 text-lg font-semibold text-slate-900">
        {home_footer_cta()}
      </p>
      <a
        href="mailto:davideads@recoveredfactory.net"
        class="inline-block rounded-lg bg-[#1b613c] px-6 py-3 font-semibold text-white no-underline transition-colors hover:bg-[#105430] focus:outline-none focus:ring-2 focus:ring-[#1b613c] focus:ring-offset-2"
        aria-label="Send email to get in touch about hiring us"
      >
        {home_footer_contact()}
      </a>
    </div>
  </section>

  <!-- MCP server -->
  <section id="mcp" class="border-t border-slate-200 bg-white py-12">
    <div class="mx-auto max-w-4xl px-6">
      <div class="text-center">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-[#1b613c]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1b613c]">
          {home_mcp_banner_tag()} · MCP
        </span>
        <h2 class="mt-3 text-3xl font-bold text-slate-900">
          {home_mcp_heading()}
        </h2>
        <p class="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-700">
          {home_mcp_intro()}
        </p>
      </div>

      <div class="mt-8 grid gap-6 md:grid-cols-2">
        <!-- Who it's for + examples -->
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h3 class="text-lg font-bold text-slate-900">{home_mcp_who_heading()}</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-700">{home_mcp_who_text()}</p>

          <h3 class="mt-6 text-lg font-bold text-slate-900">{home_mcp_examples_heading()}</h3>
          <ul class="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
            <li class="flex gap-2">
              <span class="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1b613c]" aria-hidden="true"></span>
              <span>{home_mcp_example_1()}</span>
            </li>
            <li class="flex gap-2">
              <span class="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1b613c]" aria-hidden="true"></span>
              <span>{home_mcp_example_2()}</span>
            </li>
            <li class="flex gap-2">
              <span class="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1b613c]" aria-hidden="true"></span>
              <span>{home_mcp_example_3()}</span>
            </li>
          </ul>
        </div>

        <!-- Connect / config snippet -->
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h3 class="text-lg font-bold text-slate-900">{home_mcp_connect_heading()}</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-700">{home_mcp_connect_intro()}</p>
          <ul class="mt-2 space-y-0.5 font-mono text-[11px] leading-snug text-slate-500">
            <li>{home_mcp_connect_path_macos()}</li>
            <li>{home_mcp_connect_path_windows()}</li>
          </ul>

          <div class="relative mt-4">
            <pre class="overflow-x-auto rounded-md border border-slate-300 bg-slate-900 px-4 py-3 pr-20 text-[11px] leading-relaxed text-slate-100"><code>{mcpConfigSnippet}</code></pre>
            <button
              type="button"
              on:click={copyMcpConfig}
              class="absolute right-2 top-2 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              {mcpCopyState === "done" ? home_mcp_copy_button_done() : home_mcp_copy_button()}
            </button>
          </div>

          <p class="mt-3 text-xs text-slate-500">
            <span class="font-semibold uppercase tracking-wide text-slate-400">{home_mcp_endpoint_label()}:</span>
            <code class="ml-1 break-all font-mono text-[11px] text-slate-700">{mcpUrl}</code>
          </p>
        </div>
      </div>

      <p class="mt-6 text-center text-sm">
        <a
          href={mcpRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          on:click={() => trackEvent("mcp_docs_click", { target: "github" })}
          class="text-[#1b613c] underline hover:text-[#105430]"
        >
          {home_mcp_docs_link()}
        </a>
      </p>
    </div>
  </section>

  <!-- About the Data -->
  <section
    id="about"
    class="border-t border-slate-200 bg-slate-50 py-12"
    bind:this={aboutSectionEl}
  >
    <div class="mx-auto max-w-4xl px-6">
      <div class="content min-h-[200px]">
        {#if aboutDataHtml}
          {@html aboutDataHtml}
        {/if}
      </div>
    </div>
  </section>
</main>

<!-- Global tooltip -->
{#if tooltip.show}
  <div
    class="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-slate-800 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full whitespace-nowrap"
    style="left: {tooltip.x}px; top: {tooltip.y}px;"
  >
    {tooltip.content}
    <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
  </div>
{/if}
