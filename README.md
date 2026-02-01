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

## Data Notes

Static datasets live in `packages/web/static/data`.

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
