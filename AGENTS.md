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

## Git workflow

- Create feature branches as `XXXX-short-description` (example: `0046-nav-header-edits`).
- When merging a PR tied to an issue, include `closes #<issue_number>` in the PR merge message/body.
