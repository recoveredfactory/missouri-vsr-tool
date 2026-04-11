<script>
  import { onMount } from "svelte";
  import { QuickScore } from "quick-score";
  import { withDataBase } from "$lib/dataBase";

  /** @type {import('./$types').PageData} */
  export let data;

  // Use the current origin for generated snippets so they work in local dev,
  // staging, and production without manual adjustment.
  let currentOrigin = import.meta.env.PUBLIC_SITE_URL ?? "https://vsr.recoveredfactory.net";
  onMount(() => {
    currentOrigin = window.location.origin;
  });

  // Chart type registry — add new types here as they're built
  const chartTypes = [
    {
      value: "agency-metric-line",
      label: "Agency Metric (Line Chart)",
      description: "Time series line chart for a single metric across race categories",
    },
  ];

  let selectedChartType = chartTypes[0].value;
  let agencyQuery = "";
  let agencyDropdownOpen = false;
  let agencyResults = [];
  /** @type {any} */
  let selectedAgency = null;
  /** @type {any} */
  let agencyData = null;
  let agencyLoading = false;
  /** @type {{ key: string; label: string }[]} */
  let availableMetrics = [];
  let selectedMetricKey = "";
  let selectedLang = "en";
  let copiedSnippet = "";

  // Agency search
  $: enrichedAgencies = (data.agencies || []).map((a) => ({
    ...a,
    search: [a.canonical_name, a.agency_slug, ...(a.names || []), a.county]
      .filter(Boolean)
      .join(" "),
  }));
  $: scorer = enrichedAgencies.length ? new QuickScore(enrichedAgencies, ["search"]) : null;

  const toLabel = (item) => item?.canonical_name || item?.names?.[0] || item?.agency_slug || "";

  const runSearch = (query) => {
    if (!query.trim() || !scorer) {
      agencyResults = [];
      agencyDropdownOpen = false;
      return;
    }
    agencyResults = scorer.search(query.trim()).slice(0, 10);
    agencyDropdownOpen = agencyResults.length > 0;
  };

  const selectAgency = async (agency) => {
    selectedAgency = agency;
    agencyQuery = toLabel(agency);
    agencyResults = [];
    agencyDropdownOpen = false;
    selectedMetricKey = "";
    agencyData = null;
    availableMetrics = [];
    agencyLoading = true;

    try {
      const resp = await fetch(withDataBase(`/data/dist/agency_year/${agency.agency_slug}.json`));
      if (resp.ok) {
        agencyData = await resp.json();
        availableMetrics = buildMetricList(agencyData);
      }
    } catch {
      agencyData = null;
    } finally {
      agencyLoading = false;
    }
  };

  const metricSuffixes = [
    "-percentage",
    "-rank",
    "-rank-no-mshp",
    "-percentile",
    "-percentile-no-mshp",
  ];

  const humanizeId = (id) => {
    if (!id) return "";
    return String(id)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const metricLabelForKey = (rowKey) => {
    const id = rowKey?.split("--").pop() || rowKey;
    return humanizeId(id);
  };

  const buildMetricList = (d) => {
    if (!Array.isArray(d?.rows)) return [];
    const seen = new Set();
    const metrics = [];
    for (const row of d.rows) {
      const key = row?.row_key;
      if (!key || seen.has(key)) continue;
      if (metricSuffixes.some((s) => key.endsWith(s))) continue;
      seen.add(key);
      metrics.push({ key, label: metricLabelForKey(key) });
    }
    return metrics;
  };

  // Embed URL and code generation
  // Preview uses a relative path so it works in dev without hitting production.
  // Generated snippets use currentOrigin (set to window.location.origin on mount)
  // so they automatically point to local dev, staging, or production.
  $: embedPath =
    selectedAgency && selectedMetricKey
      ? `/${selectedLang}/embed/agency-metric-line/${selectedAgency.agency_slug}/${encodeURIComponent(selectedMetricKey)}`
      : null;

  $: webComponentCode = embedPath
    ? generateWebComponent(selectedAgency.agency_slug, selectedMetricKey, selectedLang, currentOrigin)
    : "";
  $: iframeResponsiveCode = embedPath ? generateIframe(embedPath, currentOrigin, "responsive") : "";
  $: iframeFixedCode = embedPath ? generateIframe(embedPath, currentOrigin, "fixed") : "";

  const generateWebComponent = (agency, metric, lang, baseUrl) => {
    const attrs = [
      `chart="agency-metric-line"`,
      `agency="${agency}"`,
      `metric="${metric}"`,
      lang !== "en" ? `lang="${lang}"` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return `<vsr-chart ${attrs}></vsr-chart>\n<script src="${baseUrl}/embed/vsr-chart.js"><\\/script>`;
  };

  const generateIframe = (path, baseUrl, variant) => {
    const src = `${baseUrl}${path}`;
    if (variant === "responsive") {
      return `<iframe\n  src="${src}"\n  style="width:100%;aspect-ratio:16/9;border:none;display:block;"\n  title="Missouri Vehicle Stops chart"\n  loading="lazy"\n></iframe>`;
    }
    return `<iframe\n  src="${src}"\n  width="640"\n  height="420"\n  style="border:none;display:block;"\n  title="Missouri Vehicle Stops chart"\n  loading="lazy"\n></iframe>`;
  };

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      copiedSnippet = key;
      setTimeout(() => {
        copiedSnippet = "";
      }, 2000);
    } catch {
      // fallback: noop
    }
  };

  const handleAgencyKeydown = (event) => {
    if (event.key === "Escape") {
      agencyDropdownOpen = false;
      agencyResults = [];
    }
    if (event.key === "Enter" && agencyResults.length > 0) {
      event.preventDefault();
      selectAgency(agencyResults[0].item);
    }
  };

  const clearAgency = () => {
    selectedAgency = null;
    agencyQuery = "";
    agencyResults = [];
    agencyDropdownOpen = false;
    agencyData = null;
    availableMetrics = [];
    selectedMetricKey = "";
  };
</script>

<svelte:head>
  <title>Embed Code Generator — Missouri Vehicle Stops</title>
</svelte:head>

<div class="min-h-screen bg-slate-50">
  <header class="border-b border-slate-200 bg-white px-6 py-4">
    <div class="mx-auto max-w-4xl">
      <div class="flex items-baseline gap-3">
        <a href="/" class="text-sm font-semibold text-[#1b613c] no-underline hover:underline">
          Missouri Vehicle Stops
        </a>
        <span class="text-slate-300">/</span>
        <h1 class="text-sm font-semibold text-slate-700">Embed Code Generator</h1>
      </div>
      <p class="mt-1 text-xs text-slate-400">Internal tool — not linked publicly</p>
    </div>
  </header>

  <main class="mx-auto max-w-4xl px-6 py-8">
    <div class="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <!-- Left: Form -->
      <div class="space-y-6">
        <!-- Step 1: Chart type -->
        <section>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            1. Chart type
          </h2>
          <div class="space-y-2">
            {#each chartTypes as ct}
              <label
                class={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  selectedChartType === ct.value
                    ? "border-[#1b613c] bg-[#f0f7f3]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="chartType"
                  value={ct.value}
                  bind:group={selectedChartType}
                  class="mt-0.5 accent-[#1b613c]"
                />
                <div>
                  <div class="text-sm font-medium text-slate-800">{ct.label}</div>
                  <div class="mt-0.5 text-xs text-slate-500">{ct.description}</div>
                </div>
              </label>
            {/each}
          </div>
        </section>

        <!-- Step 2: Agency -->
        <section>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            2. Agency
          </h2>
          <div class="relative">
            <div class="flex items-center gap-2">
              <input
                type="search"
                placeholder="Search agencies…"
                bind:value={agencyQuery}
                on:keydown={handleAgencyKeydown}
                on:input={(e) => {
                  if (selectedAgency) clearAgency();
                  runSearch(e.currentTarget.value);
                }}
                autocomplete="off"
                spellcheck="false"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1b613c]"
              />
              {#if selectedAgency}
                <button
                  type="button"
                  on:click={clearAgency}
                  class="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-500 hover:bg-slate-50"
                  aria-label="Clear agency"
                >
                  ✕
                </button>
              {/if}
            </div>

            {#if agencyDropdownOpen && agencyResults.length > 0}
              <ul
                class="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 list-none overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
                role="listbox"
              >
                {#each agencyResults as result}
                  <li role="option" aria-selected="false">
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                      class="cursor-pointer px-3 py-2 text-sm hover:bg-indigo-50"
                      on:click={() => selectAgency(result.item)}
                      role="option"
                      aria-selected="false"
                      tabindex="0"
                    >
                      <div class="font-medium text-slate-900">{toLabel(result.item)}</div>
                      {#if result.item.county}
                        <div class="text-xs text-slate-500">{result.item.county}</div>
                      {/if}
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}

            {#if selectedAgency}
              <p class="mt-1.5 text-xs text-[#1b613c]">
                ✓ {toLabel(selectedAgency)}
                {#if selectedAgency.county}— {selectedAgency.county}{/if}
              </p>
            {/if}

            {#if agencyLoading}
              <p class="mt-1.5 text-xs text-slate-400">Loading metrics…</p>
            {/if}
          </div>
        </section>

        <!-- Step 3: Metric -->
        {#if availableMetrics.length > 0}
          <section>
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              3. Metric
            </h2>
            <select
              bind:value={selectedMetricKey}
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1b613c]"
            >
              <option value="">— Select a metric —</option>
              {#each availableMetrics as metric}
                <option value={metric.key}>{metric.label}</option>
              {/each}
            </select>
            {#if selectedMetricKey}
              <p class="mt-1 font-mono text-[10px] text-slate-400">{selectedMetricKey}</p>
            {/if}
          </section>
        {/if}

        <!-- Step 4: Language -->
        {#if selectedMetricKey}
          <section>
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              4. Language
            </h2>
            <div class="flex gap-3">
              {#each [{ value: "en", label: "English" }, { value: "es", label: "Español" }] as lang}
                <label
                  class={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                    selectedLang === lang.value
                      ? "border-[#1b613c] bg-[#f0f7f3] font-medium text-[#1b613c]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="lang"
                    value={lang.value}
                    bind:group={selectedLang}
                    class="accent-[#1b613c]"
                  />
                  {lang.label}
                </label>
              {/each}
            </div>
          </section>
        {/if}
      </div>

      <!-- Right: Preview + Output -->
      <div class="space-y-6">
        <!-- Preview -->
        <section>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Preview
          </h2>
          <div
            class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            style="aspect-ratio: 16/9;"
          >
            {#if embedPath}
              <iframe
                src={embedPath}
                style="width:100%;height:100%;border:none;display:block;"
                title="Chart preview"
              ></iframe>
            {:else}
              <div class="flex h-full items-center justify-center text-sm text-slate-400">
                Select an agency and metric to preview
              </div>
            {/if}
          </div>
          {#if embedPath}
            <a
              href={embedPath}
              target="_blank"
              rel="noopener noreferrer"
              class="mt-2 inline-block text-xs text-slate-400 hover:text-slate-600"
            >
              Open in new tab →
            </a>
          {/if}
        </section>

        <!-- Code snippets -->
        {#if embedPath}
          <section class="space-y-4">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Embed code
            </h2>

            <!-- Web component -->
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <span class="text-xs font-medium text-slate-600">Web component</span>
                <button
                  type="button"
                  on:click={() => copyToClipboard(webComponentCode, "wc")}
                  class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {copiedSnippet === "wc" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre
                class="overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-200"
              >{webComponentCode}</pre>
            </div>

            <!-- Responsive iframe -->
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <span class="text-xs font-medium text-slate-600">iframe (responsive)</span>
                <button
                  type="button"
                  on:click={() => copyToClipboard(iframeResponsiveCode, "iframe-r")}
                  class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {copiedSnippet === "iframe-r" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre
                class="overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-200"
              >{iframeResponsiveCode}</pre>
            </div>

            <!-- Fixed iframe -->
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <span class="text-xs font-medium text-slate-600">iframe (640×420)</span>
                <button
                  type="button"
                  on:click={() => copyToClipboard(iframeFixedCode, "iframe-f")}
                  class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {copiedSnippet === "iframe-f" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre
                class="overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-200"
              >{iframeFixedCode}</pre>
            </div>
          </section>
        {/if}
      </div>
    </div>
  </main>
</div>
