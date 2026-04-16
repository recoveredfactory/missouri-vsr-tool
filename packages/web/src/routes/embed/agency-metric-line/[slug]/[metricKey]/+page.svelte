<script>
  import { onMount } from "svelte";
  import { getLocale } from "$lib/paraglide/runtime";
  import { raceColors } from "$lib/colors.js";
  import * as m from "$lib/paraglide/messages";

  /** @type {import('./$types').PageData} */
  export let data;

  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? "https://vsr.recoveredfactory.net";
  const raceKeyOrder = ["White", "Black", "Hispanic", "Native American", "Asian", "Other"];

  let LineComponent;

  onMount(async () => {
    const mod = await import("$lib/components/MetricChartLines.svelte");
    LineComponent = mod.default;
  });

  const toNumber = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const getRaceValue = (row, race) => {
    if (!row || !race) return 0;
    if (race === "Native American") {
      return toNumber(
        row["Native American"] ?? row.native_american ?? row["native american"] ?? 0
      );
    }
    const lower = race.toLowerCase();
    return toNumber(row[race] ?? row[lower] ?? 0);
  };

  const normalizeAgency = (name) =>
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  $: normalizedAgencyName = normalizeAgency(data.agencyName);
  $: metricRowsSorted = (data.metricRows ?? [])
    .filter((row) => normalizeAgency(String(row?.agency || "")) === normalizedAgencyName)
    .sort((a, b) => Number(a?.year) - Number(b?.year))
    .filter((row) => row?.year !== null && row?.year !== undefined);

  $: activeRaceKeys = raceKeyOrder.filter((race) =>
    metricRowsSorted.some((row) => getRaceValue(row, race) !== 0)
  );

  $: lineSeries = activeRaceKeys.map((race) => ({
    race,
    data: metricRowsSorted.map((row) => ({
      year: String(row.year),
      race,
      value: getRaceValue(row, race),
    })),
  }));

  $: lineData = lineSeries.flatMap((s) => s.data);

  $: lineValuesByYear = lineSeries.reduce((acc, series) => {
    series.data.forEach((entry) => {
      if (!entry.year) return;
      if (!acc[entry.year]) acc[entry.year] = {};
      acc[entry.year][series.race] = entry.value;
    });
    return acc;
  }, {});

  $: isPercentageMetric = data.metricKey.endsWith("-percentage");

  const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

  $: formatChartValue = (value) => {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
    if (isPercentageMetric) return `${numberFormatter.format(value * 100)}%`;
    return numberFormatter.format(value);
  };

  const raceColor = (race) => raceColors[race] || "#25784c";

  const raceLabel = (key) => {
    switch (key) {
      case "White":
        return m.race_white();
      case "Black":
        return m.race_black();
      case "Hispanic":
        return m.race_hispanic();
      case "Native American":
        return m.race_native_american();
      case "Asian":
        return m.race_asian();
      case "Other":
        return m.race_other();
      default:
        return key;
    }
  };

  const humanizeId = (id) => {
    if (!id) return "";
    return String(id)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const labelForId = (prefix, id) => {
    if (!id) return "";
    const key = `${prefix}_${id}`
      .replace(/[^a-z0-9]/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    const fn = m[key];
    return typeof fn === "function" ? fn() : "";
  };

  const metricLabelForKey = (rowKey) => {
    const id = rowKey?.split("--").pop() || rowKey;
    return labelForId("metric", id) || humanizeId(id);
  };

  $: agencyName = data.agencyData?.agency ?? data.slug;
  $: metricLabel = metricLabelForKey(data.metricKey);

  let locale = "en";
  $: {
    try {
      locale = getLocale();
    } catch {
      locale = "en";
    }
  }

  $: agencyUrl = `${siteUrl}/${locale}/agency/${data.slug}`;
</script>

<svelte:head>
  <title>{agencyName} — {metricLabel} — Missouri Vehicle Stops</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex flex-col bg-white" style="height: 100dvh; min-height: 320px;">
  <div class="flex-shrink-0 px-4 pt-4 pb-1">
    <p class="text-[11px] uppercase tracking-[0.2em] text-slate-400 leading-none">{agencyName}</p>
    <h1 class="mt-1 text-sm font-semibold text-slate-900 leading-snug">{metricLabel}</h1>
  </div>

  <div class="min-h-0 flex-1 px-3 py-1">
    {#if lineData.length === 0}
      <div class="flex h-full items-center justify-center text-sm text-slate-400">
        No data available
      </div>
    {:else if LineComponent}
      <svelte:component
        this={LineComponent}
        {lineSeries}
        {lineData}
        {lineValuesByYear}
        raceKeys={activeRaceKeys}
        {raceLabel}
        {raceColor}
        {formatChartValue}
      />
    {:else}
      <div
        class="flex h-full items-center justify-center text-sm text-slate-400"
        aria-busy="true"
      >
        Loading…
      </div>
    {/if}
  </div>

  {#if activeRaceKeys.length > 0}
    <div
      class="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 text-xs text-slate-600"
    >
      {#each activeRaceKeys as race}
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block h-2.5 w-2.5 rounded-full"
            style="background:{raceColor(race)}"
          ></span>
          {raceLabel(race)}
        </span>
      {/each}
    </div>
  {/if}

  <div
    class="flex flex-shrink-0 items-center justify-between gap-4 border-t border-[#1b613c]/20 bg-[#f0f7f3] px-4 py-2.5"
  >
    <a
      href={agencyUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="text-xs font-semibold text-[#1b613c] no-underline hover:underline"
    >
      Missouri Vehicle Stops →
    </a>
    <a
      href="https://recoveredfactory.net/en/support"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center rounded bg-[#1b613c] px-2.5 py-1 text-xs font-semibold text-white no-underline hover:bg-[#105430]"
    >
      Support Recovered Factory
    </a>
  </div>
</div>
