# Shard 80 — Full historical data migration (Sheets → Supabase)

> Locked decision D-DATA: migrate everything. Runs per-module inside each shard (schema first, then backfill), closes as a final validation sweep here. Scope L.

## Method (extend existing `migration/` pipeline)

- `migration/migrate.ts` already handles config, roster, view_as, 12 `prod_*`, `qa_*` tables via `google-spreadsheet` → batched upserts with counts logged.
- Per module: add a `migrate<Module>()` following the same pattern; dedupe on natural keys; record skipped rows + reasons (as the prod migration did — e.g. "61 skipped no-email").
- Read-only sources (`DQ_READ_ONLY_IDS`) are ingest-only; never write back.
- Multi-year `CC2 Data {year}` stores: iterate configured `ss_data_{year}_id` config keys.
- Trackers with `storage_mode` sheet-backed: migrate rows into internal tables (owner rule: migrate to Supabase then continue there).

## Inventory (source spreadsheet → tables)

| Source | Store key | Tables |
|---|---|---|
| CC2 Core | `CC_DATA_SPREADSHEET_ID` | Config✓, Roster✓, ViewAs✓, Options, Popups, MailLog, Health, holidays, `PW_TABLES` (15), notes/hard-cases tabs, Trackers, TrackerFields, sched_*, `KPI_LOG_HEADERS` (3), `TLP_HEADERS` (4), `MD_HEADERS` (3), `SC_*` (3), FollowUpDone |
| CC2 Tickets | `ss_tickets_id` | tickets, esc_seen |
| CC2 Live | `ss_live_id` | aging_open_tickets, agg_queue_now, agg_inflow_*, agg_agent_*, agg_snapshots_today, refresh_log, queue_status_submissions, aging_flags, tlp_* |
| CC2 Data {year} | `ss_data_{year}_id` | queue_snapshots, agg_inflow_hourly, agg_productivity_daily, sc_daily, sc_behaviour |
| CC2 Quality | `ss_quality_id` | qa_forms, qa_queue, qa_audits (+QE_* engine tabs, qa_access_log, ctl/dispute/calibration/kb tabs) |
| CC2 Productivity | `ss_productivity_id` | prod_* (done, re-verify) |
| Tracker spreadsheets | per-tracker config | tracker record tables |
| V1 productivity workbook | `productivity_files`/fallback | V1 import for agents page (`MigrateV1Tasks.js`, `scDerive_` inputs) |

✓ = already migrated and count-verified.

## Validation

- Extend `migration/validate.ts`: per-table row counts source vs target, sampled field-level diffs, aggregate checksums (e.g. sum of numeric cols) per table; produce `migration/report-<module>.md`.
- Re-run aggregate parity: same date ranges → same totals as legacy jobs produce (golden inputs `Systems_Rawdata_Full.xlsx` + live sheets).

## Gates

- Counts match (or documented skips) for every table in the inventory.
- `migrate:validate` exits green; report committed to `specs/cx-hub/migration-report.md`.
