# Missouri VSR Tool

Monorepo for the Missouri VSR (Vehicle Stops Report) site. The web app lives in
`packages/web` (SvelteKit + SST), with space reserved for future services in
`packages/services`.

## Dev

- `pnpm dev` runs the SST dev server.
- `pnpm -F web dev` runs the SvelteKit Vite server directly.
- Create `.env` from `.env.example` to set the S3 bucket + prefix used by data sync.
- For analytics, set `PUBLIC_UMAMI_WEBSITE_ID` in the repo-root `.env` for local dev.
- `pnpm sync:data` pulls the latest data from S3 into `packages/web/static/data`.
- To use the CDN-backed dataset, set `PUBLIC_DATA_BASE_URL` (ex: `https://data.vsr.recoveredfactory.net`).

## Data Notes

Static datasets live in `packages/web/static/data` for local dev, but the app
can load everything from the CDN by setting `PUBLIC_DATA_BASE_URL`. The CDN
is expected to serve the same `/data/...` paths (ex: `/data/dist/...`).

- `agency_year/*.json` is row-based (array of rows).
- `report_dimensions.json` lists `table_id`, `section_id`, and `metric_id` keys.
- `statewide_slug_baselines.json` uses `row_key` for lookups.

Schema details:

- `row_key` = `<table_id>--<section_id>--<metric_id>`
- `row_id` = `<year>-<agency_slug>-<row_key>`

Use `row_key` for metric lookups; legacy `slug` is removed.

## Translations

For report labels, translation keys are derived from IDs:

- `table_<table_id>`
- `section_<section_id>`
- `metric_<metric_id>`

These live in `packages/web/messages/en.json` and `packages/web/messages/es.json`.

## Deployment env

- Set the deployed analytics ID with `sst secret set PUBLIC_UMAMI_WEBSITE_ID <value>`.
- Set `PUBLIC_DATA_BASE_URL` to your data CDN domain to avoid deploying large static datasets.

## Analytics events

- `search_action`: search box usage on home/agency header (payload: `action`, `method`, `term`, `slug`).
- `search_term`: header search debounced term (payload: `term`).
- `language_switch`: locale selector change (payload: `from`, `to`).
- `mobile_menu_toggle`: mobile menu open/close (payload: `action`, `source`).
- `download_click`: homepage dataset download CTA (payload: `label`, `href`).
- `agency_year_select`: agency page year selector click (payload: `year`, `source`, `agency`).
- `metric_search`: agency page metric search, debounced (payload: `term`, `year`, `agency`).
- `metric_open`: agency page metric click (payload: `metricKey`, `label`, `year`, `agency`).
- `agency_neighbors_expand`: neighboring agencies panel expanded (payload: `agency`, `touchingCount`, `containedCount`).
- `agency_neighbors_collapse`: neighboring agencies panel collapsed (payload: `agency`, `touchingCount`, `containedCount`).
