<script>
  import {
    census_heading,
    census_toggle_hide,
    census_toggle_show,
    census_source_attribution,
    census_race_heading,
    census_no_race_data,
    census_location_heading,
    census_congressional_district,
    census_congressional_districts,
    census_state_legislative_district,
    census_state_legislative_districts,
    census_metro_area_label,
    census_acs_tables_heading,
    census_acs_table_row_count,
    census_acs_col_category,
    census_acs_col_value,
    census_acs_col_pct,
    census_acs_col_moe,
    census_no_acs_data,
    census_acs_survey_note_full,
    census_acs_survey_note_brief,
    census_geography_note,
  } from "$lib/paraglide/messages";

  /** @type {object|null} */
  export let geocodioDemographics = null;
  /** @type {string} */
  export let agencySlug = "";

  let expanded = false;

  const trackEvent = (event, payload = {}) => {
    if (typeof window === "undefined") return;
    window.umami?.track?.(event, payload);
  };

  const toggle = () => {
    const next = !expanded;
    expanded = next;
    trackEvent(next ? "agency_census_expand" : "agency_census_collapse", {
      agency: agencySlug,
      hasJurisdictionData: Boolean(geocodioDemographics),
    });
  };
</script>

{#if geocodioDemographics}
  <section class="mb-10">
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <button
        type="button"
        class="flex w-full items-center gap-4 text-left"
        aria-expanded={expanded}
        aria-controls="census-panel"
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
            {census_heading()}
          </h2>
        </div>
      </button>
      {#if expanded}
        <div id="census-panel" class="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <article class="rounded-xl border border-slate-300 bg-slate-50/50 p-4 sm:p-5">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p class="text-sm text-slate-700">
                {census_source_attribution()}
              </p>
              {#if geocodioDemographics.formattedAddress}
                <p class="text-sm text-slate-600">{geocodioDemographics.formattedAddress}</p>
              {/if}
            </div>

            {#if geocodioDemographics.summaryStats.length}
              <div class="mt-4 grid gap-2 sm:grid-cols-3">
                {#each geocodioDemographics.summaryStats as stat}
                  <div class="rounded-lg border border-slate-300 bg-white p-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {stat.label}
                    </p>
                    <p class="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
                      {stat.value}
                    </p>
                  </div>
                {/each}
              </div>
            {/if}

            <div class="mt-5 grid gap-3 md:grid-cols-2 md:items-start">
              <div class="rounded-lg border border-slate-300 bg-white p-3">
                <h4 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  {census_race_heading()}
                </h4>
                {#if geocodioDemographics.raceRows.length}
                  <div class="mt-2 grid gap-y-2 text-sm text-slate-800">
                    {#each geocodioDemographics.raceRows as row}
                      <div class="flex items-baseline justify-between gap-3">
                        <span>{row.label}</span>
                        <span class="font-mono tabular-nums text-slate-900">{row.display}</span>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="mt-2 text-sm text-slate-700">
                    {census_no_race_data()}
                  </p>
                {/if}
              </div>

              <div class="rounded-lg border border-slate-300 bg-white p-3">
                <h4 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  {census_location_heading()}
                </h4>
                <dl class="mt-2 space-y-3 text-sm text-slate-800">
                  <div>
                    <dt class="font-medium text-slate-600">
                      {geocodioDemographics.congressionalDistricts.length > 1
                        ? census_congressional_districts()
                        : census_congressional_district()}
                    </dt>
                    <dd class="mt-0.5">
                      {#if geocodioDemographics.congressionalDistricts.length}
                        {#each geocodioDemographics.congressionalDistricts as district, index}
                          <span>{district}{index < geocodioDemographics.congressionalDistricts.length - 1 ? ", " : ""}</span>
                        {/each}
                      {:else}
                        —
                      {/if}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-medium text-slate-600">
                      {geocodioDemographics.stateLegislativeDistricts.length > 1
                        ? census_state_legislative_districts()
                        : census_state_legislative_district()}
                    </dt>
                    <dd class="mt-0.5">
                      {#if geocodioDemographics.stateLegislativeDistricts.length}
                        {#each geocodioDemographics.stateLegislativeDistricts as district, index}
                          <span>{district}{index < geocodioDemographics.stateLegislativeDistricts.length - 1 ? ", " : ""}</span>
                        {/each}
                      {:else}
                        —
                      {/if}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-medium text-slate-600">{census_metro_area_label()}</dt>
                    <dd class="mt-0.5">{geocodioDemographics.metroAreaName || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {#if geocodioDemographics.acsTableGroups.length}
              <div class="mt-5">
                <h4 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  {census_acs_tables_heading()}
                </h4>
                <div class="mt-2 space-y-3">
                  {#each geocodioDemographics.acsTableGroups as group}
                    <div class="rounded-lg border border-slate-300 bg-white p-3">
                      <h5 class="text-sm font-semibold text-slate-900">{group.label}</h5>
                      <div class="mt-2 space-y-2">
                        {#each group.tables as table}
                          <details class="rounded-md border border-slate-200 bg-slate-50/70">
                            <summary class="cursor-pointer list-none px-3 py-2.5">
                              <div class="flex items-center justify-between gap-3">
                                <span class="text-sm font-medium text-slate-900">{table.title}</span>
                                <span class="shrink-0 text-xs text-slate-600">{census_acs_table_row_count({ count: table.rowCount })}</span>
                              </div>
                            </summary>
                            <div class="border-t border-slate-200 px-3 pb-3 pt-2">
                              <div class="mt-1 overflow-x-auto">
                                <table class="min-w-full table-auto border-collapse">
                                  <colgroup>
                                    <col />
                                    <col style="width: 7rem;" />
                                    <col style="width: 5rem;" />
                                    <col style="width: 6rem;" />
                                  </colgroup>
                                  <thead>
                                    <tr class="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-600">
                                      <th class="py-1 text-left">{census_acs_col_category()}</th>
                                      <th class="py-1 text-right">{census_acs_col_value()}</th>
                                      <th class="py-1 text-right">{census_acs_col_pct()}</th>
                                      <th class="py-1 text-right">{census_acs_col_moe()}</th>
                                    </tr>
                                  </thead>
                                  <tbody class="divide-y divide-slate-200">
                                    {#each table.rows as row}
                                      <tr class="text-sm text-slate-800">
                                        <td class="py-1.5 pr-2">{row.label}</td>
                                        <td class="py-1.5 text-right font-mono tabular-nums text-slate-900">
                                          {row.valueDisplay || "—"}
                                        </td>
                                        <td class="py-1.5 text-right font-mono tabular-nums text-slate-900">
                                          {row.percentDisplay || "—"}
                                        </td>
                                        <td class="py-1.5 text-right font-mono tabular-nums text-slate-500">
                                          {row.moeDisplay ? `±${row.moeDisplay}` : "—"}
                                        </td>
                                      </tr>
                                    {/each}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </details>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {:else if !geocodioDemographics.hasAcs}
              <p class="mt-4 text-sm text-slate-700">
                {census_no_acs_data()}
              </p>
            {/if}

            <p class="mt-4 text-xs leading-relaxed text-slate-600">
              {#if geocodioDemographics.surveyYears}
                {geocodioDemographics.surveyDurationYears
                  ? census_acs_survey_note_full({ years: geocodioDemographics.surveyYears, duration: geocodioDemographics.surveyDurationYears })
                  : census_acs_survey_note_brief({ years: geocodioDemographics.surveyYears })}
              {/if}
              {#if geocodioDemographics.censusYear}
                {census_geography_note({ year: geocodioDemographics.censusYear })}
              {/if}
            </p>
          </article>
        </div>
      {/if}
    </div>
  </section>
{/if}
