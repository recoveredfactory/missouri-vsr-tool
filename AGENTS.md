# Agent Notes

## Web app

- SvelteKit app lives in `packages/web`.
- Agency page uses Gridcraft for the metrics table (grouped by a synthesized
  `<table_id>--<section_id>` key).
- Search/filter is a Gridcraft filter on the metric column.

## Data schema

- Per-agency data is row-based with `row_key` and `row_id`.
- `row_key` = `<table_id>--<section_id>--<metric_id>`.
- `row_id` = `<year>-<agency_slug>-<row_key>`.
- Baselines (`statewide_slug_baselines.json`) also key by `row_key`.
- Sync the latest dataset from S3 with `pnpm sync:data` (pull-only).
- Data sync reads `MISSOURI_VSR_BUCKET_NAME` + `MISSOURI_VSR_S3_PREFIX` from `.env`.

## Translation keys

Report dimension labels use ID-based keys:

- `table_<table_id>`
- `section_<section_id>`
- `metric_<metric_id>`

These are generated from `packages/web/static/data/report_dimensions.json` and
stored in `packages/web/messages/en.json` and `packages/web/messages/es.json`.

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
