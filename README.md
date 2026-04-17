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
can load everything from the CDN by setting `PUBLIC_DATA_BASE_URL`. When the
CDN base URL is set, the `/data/` prefix is stripped (so `/data/dist/...`
becomes `https://your-cdn/dist/...`). If `PUBLIC_DATA_BASE_URL` is empty in
local dev, the app will fall back to the production CDN. To force local files,
set `PUBLIC_DATA_BASE_URL=/data` and run `pnpm sync:data`.

### v2 data schema (current)

- `manifest.json` — release descriptor: `years`, `partial_coverage_years`, `canonical_metrics`.
- `agency_year/{slug}/{year}.json` — per-agency per-year data (partitioned; not monolithic).
- `report_dimensions.json` lists dimension IDs.
- `statewide_slug_baselines.json` uses `row_key` for lookups.
- `metric_year_subset.json` — compact indexed format: `{ agencies, years, columns, rows }`.

Schema details:

- `row_key` = canonical key (e.g. `stops`, `search-rate`, `stop-outcome--warning`)
- `row_id` = `<year>-<agency_slug>-<row_key>`

The app lazy-loads agency year data client-side when the user switches years.
Years 2001–2003 have partial coverage (~50% of agencies); a warning is shown when selected.

## Translations

For report labels, translation keys are derived from IDs:

- `table_<table_id>`
- `section_<section_id>`
- `metric_<metric_id>`

These live in `packages/web/messages/en.json` and `packages/web/messages/es.json`.

## Deployment env

- Set the deployed analytics ID with `sst secret set PUBLIC_UMAMI_WEBSITE_ID <value>`.
- Set `PUBLIC_DATA_BASE_URL` to your data CDN domain to avoid deploying large static datasets.

## Data CDN

The data bucket is managed outside this repo, but SST can create a CloudFront
distribution in front of it (prod stage only). Configure:

- `MISSOURI_VSR_BUCKET_NAME` + `MISSOURI_VSR_BUCKET_REGION`
- `DATA_CDN_DOMAIN` (ex: `data.vsr.recoveredfactory.net`)
- `PUBLIC_DATA_BASE_URL` to the same domain

After the first prod deploy, SST outputs `dataCdnDistributionId`. Use that ID
in the S3 bucket policy to allow CloudFront `s3:GetObject` access (CloudFront
origin access control). The bucket policy is managed outside this repo.

## Embed system

The internal embed code generator lives at `/embed` (not linked publicly). It lets you pick a chart, agency, and metric and outputs a web component snippet plus iframe fallbacks.

Embed pages live at `/<lang>/embed/<chart-type>/<params>`, e.g. `/en/embed/agency-metric-line/<slug>/<metricKey>`.

### Testing embeds locally in a live site (e.g. WordPress)

Browsers block HTTP iframes on HTTPS pages. To test embeds against a live site, run the dev server over HTTPS:

1. Add `LOCAL_HTTPS=true` to your root `.env` file.
2. Run `pnpm -F web dev` — the server starts at `https://localhost:5173`.
3. Visit `https://localhost:5173` and click through the browser's self-signed cert warning once.
4. The embed generator will produce snippets pointing to `https://localhost:5173`, which the live site can load.

Remove `LOCAL_HTTPS=true` when done — the self-signed cert warning is annoying in normal dev.

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
