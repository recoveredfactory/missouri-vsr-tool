<script>
  import { onMount } from "svelte";
  import { withDataBase } from "$lib/dataBase";

  // Labels come in as props because this component is embedded in locale-scoped
  // markdown files (about-the-data.{en,es}.md), so the host .md already knows
  // which strings to supply.
  export let filterLabel = "Filter";
  export let filterPlaceholder = "slug or name";
  export let ofLabel = "of";
  export let slugHeading = "Agency slug";
  export let yearsHeading = "Years reported";
  export let urlHeading = "URL";
  export let loadingLabel = "Loading agency index…";
  export let errorLabel = "Could not load agency index.";

  let agencies = [];
  let loadState = "loading"; // "loading" | "ready" | "error"
  let filter = "";

  // Base URL for per-agency year JSON. Kept relative to the configured data base
  // so dev and prod both resolve to the right CDN release.
  const agencyJsonBase = withDataBase("/data/dist/agency_year");

  onMount(async () => {
    try {
      const res = await fetch(withDataBase("/data/dist/agency_index.json"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      agencies = Array.isArray(data)
        ? data.slice().sort((a, b) =>
            (a?.agency_slug ?? "").localeCompare(b?.agency_slug ?? "")
          )
        : [];
      loadState = "ready";
    } catch (err) {
      console.error("[AgencyIndexTable] failed to load agency_index.json", err);
      loadState = "error";
    }
  });

  $: normalizedFilter = filter.trim().toLowerCase();
  $: visible = normalizedFilter
    ? agencies.filter((a) =>
        [a?.agency_slug, a?.canonical_name, ...(a?.names || [])]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(normalizedFilter))
      )
    : agencies;

  // Render `years_with_data` as a compact range — "2020–2024" when contiguous,
  // otherwise comma-joined ("2005, 2020, 2021"). Falls back to empty when the
  // pipeline hasn't emitted the field yet (see #187).
  const formatYears = (years) => {
    if (!Array.isArray(years) || !years.length) return "";
    const sorted = years
      .map(Number)
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => a - b);
    if (!sorted.length) return "";
    const contiguous = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1);
    if (contiguous && sorted.length > 1) {
      return `${sorted[0]}\u2013${sorted[sorted.length - 1]}`;
    }
    return sorted.join(", ");
  };
</script>

<div class="my-4">
  {#if loadState === "loading"}
    <p class="text-xs text-slate-500">{loadingLabel}</p>
  {:else if loadState === "error"}
    <p class="text-xs text-red-600">{errorLabel}</p>
  {:else}
    <label class="mb-3 flex items-center gap-2 text-xs">
      <span class="font-semibold uppercase tracking-wide text-slate-500">{filterLabel}</span>
      <input
        type="search"
        bind:value={filter}
        placeholder={filterPlaceholder}
        class="w-64 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono focus:border-[#1b613c] focus:outline-none focus:ring-1 focus:ring-[#1b613c]"
      />
      <span class="text-slate-500">
        {visible.length.toLocaleString()} {ofLabel} {agencies.length.toLocaleString()}
      </span>
    </label>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="text-left">{slugHeading}</th>
            <th class="text-left">{yearsHeading}</th>
            <th class="text-left">{urlHeading}</th>
          </tr>
        </thead>
        <tbody>
          {#each visible as agency (agency.agency_slug)}
            {@const url = `${agencyJsonBase}/${agency.agency_slug}.json`}
            <tr>
              <td>{agency.agency_slug}</td>
              <td>{formatYears(agency.years_with_data)}</td>
              <td><a href={url}>{url}</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
