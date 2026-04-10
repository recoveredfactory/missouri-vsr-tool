# Agent Notes

## Web app

- SvelteKit app lives in `packages/web`.
- Agency page uses Gridcraft for the metrics table (grouped by a synthesized
  `<table_id>--<section_id>` key).
- Search/filter is a Gridcraft filter on the metric column.

## Data schema (v2)

- Per-agency data is partitioned by year: `agency_year/{slug}/{year}.json` (not monolithic).
- `row_key` = canonical key (e.g. `stops`, `search-rate`, `stop-outcome--warning`).
- `row_id` = `<year>-<agency_slug>-<row_key>`.
- Baselines (`statewide_slug_baselines.json`) also key by canonical `row_key`.
- `manifest.json` drives year range; `partial_coverage_years` = [2001, 2002, 2003].
- Agency page lazy-loads year data on year selection; latest year is SSR-loaded.
- Sync the latest dataset from S3 with `pnpm sync:data` (pull-only).
- Data sync reads `MISSOURI_VSR_BUCKET_NAME` + `MISSOURI_VSR_S3_PREFIX` from `.env`.
- Set `MISSOURI_VSR_S3_PREFIX=releases/v2` to sync v2 data.

## Translation keys

Report dimension labels use ID-based keys:

- `section_<group_id>` — for canonical key prefix (e.g. `section_stop_outcome`, `section_core_counts`)
- `metric_<metric_id>` — for the last segment of the canonical key (e.g. `metric_stops`, `metric_warning`)

These are stored in `packages/web/messages/en.json` and `packages/web/messages/es.json`.
In v2, `table_*` keys are no longer used; grouping is by canonical key prefix only.

## Paraglide / i18n rules

- **`setLocale(locale)` does a full page reload** — this is intentional with the URL strategy. Never add `goto()` on top of it; they conflict. Just call `setLocale()` and let Paraglide handle navigation.
- **Named imports** are preferred: `import { my_key } from "$lib/paraglide/messages"`.
- **Wildcard import** (`import * as m`) is required in files that do dynamic
  `m[key]` bracket lookups (e.g. `MetricChartModal.svelte`,
  `HomeAgencyMetricTable.svelte`, `+layout.svelte`). Never remove it from those
  files — the build won't catch it but the runtime will crash.
- When auditing translation usage, grep for `m[` (bracket notation) in addition
  to `m.` and `m?.` — optional chaining also hides from naive greps.

## Svelte / SvelteKit gotchas

- `{expressions}` inside `<script type="application/ld+json">` (or any `<script>`
  tag) in a Svelte template are **not evaluated** — they render as literal text.
  Use `{@html \`<script ...>${JSON.stringify(data)}</script>\`}` instead.
- In SSR, `$:` reactive declarations run **after** all `const`/`let` statements.
  If a `const` depends on a `$:` variable it will see `undefined`. Make dependent
  assignments reactive too.

## Git workflow

- Create feature branches as `XXXX-short-description` (example: `0046-nav-header-edits`).
- When merging a PR tied to an issue, include `closes #<issue_number>` in the PR merge message/body.
