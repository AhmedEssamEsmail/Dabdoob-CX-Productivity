# 00 — Source-health audit endpoint

One admin endpoint that answers "why is everything zero". This is the backbone of the error-clarity work — its checks feed `describeDbError` (02) and decide whether 04 (legacy migration) applies.

## Deliverable

`GET /api/admin/source-health` → `{ ok, checks: [{ name, ok, detail, hint }] }`

- Auth: `requireRole(['admin'])` + `viewAsGuard` (same pattern as `run-step`).
- Each check returns a human-readable `detail` (what was found) and `hint` (what to do about it).

## Checks

### Tables — `.from(t).select('*').limit(1)` each, report exists/empty/missing

`config`, `roster`, `view_as`, `options`, `popups`, `mail_log`, `holidays`, `health`, `refresh_log`,
`prod_intervals`, `prod_flags`, `prod_flag_log`, `prod_daily_layers`, `prod_daily_layers_effective`, `prod_flag_analytics`, `prod_tph_days`, `prod_tph_cases`, `prod_tph_touches`, `prod_tph_calls`, `prod_tph_tasks`, `prod_quarterly_reports`, `prod_window_hist`,
`tickets`, `agg_queue_now`, `agg_inflow_hourly`, `agg_snapshots_today`, `aging_open_tickets`, `queue_submissions`, `dq_aging_flags`,
`fd_activities`, `maqsam_calls`, `freshchat` (WP1 creates these — report missing until then),
`fcr_daily`, `qa_audits`, `sc_daily`, `people`, `work_calendar`, `tl_snapshots`, `tlp_*`, `one_on_one_schedule`, `kpi_*_log`.

Each missing table's hint names which migration/job produces it (003 vs placeholder/other-app vs mirror sync).

### Config keys — report present/absent + redacted value shape

`ss_productivity_id`, `fd_activity_ss_id`, `daily_report_ss_id`, `business_tz`, `data_tz`, `activity_local_tz`,
`productivity_files` (parse the JSON map; report which of `2026-07` … current month have workbook ids and whether a `fallback`/`default` entry exists),
`tph_*` seed keys (`tph_minutes_per_case`, `tph_cap_window_min`, `tph_calls_minute_factor`, `tph_eligible_days`, `tph_day_hours`, `tph_channels`, `tph_ticket_statuses`),
`prod_*` settings.

### Env vars — presence only, never values

`CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_SHEET_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Sheet reachability — `fetchWorkbookTabs` probes (from `src/lib/jobs/sheets.ts`)

- `fd_activity_ss_id` → tab `Activities`: row count + earliest/latest timestamp → answers "does history reach July".
- `daily_report_ss_id` → tab `Freshchat`: row count + date range.
- Each `productivity_files[yyyy-MM]` workbook → `Maqsam Calls`, `FD_AUX`, `Headcount`: present/absent per month.
- Productivity store (`ss_productivity_id`, or the migrate route's hardcoded legacy id `1h77da05...` — read the migrate route's constant) → presence + row counts for `prod_tph_days`, `prod_tph_cases`, `prod_tph_touches`, `prod_tph_calls`, `prod_intervals`, `prod_flags`, `prod_daily_layers`. **This output decides whether 04 runs.**

### Cron health

- Latest `refresh_log` rows per job + last `health` row per job.
- `CRON_SECRET` presence check already above; report "crons can never have run" when `refresh_log` is empty AND `CRON_SECRET` absent.

## Response example

```json
{
  "ok": false,
  "checks": [
    { "name": "table:fd_activities", "ok": false, "detail": "table missing (PGRST205)", "hint": "Run migration 004_mirror_tables.sql, then POST /api/admin/mirrors {full:true,since:'2026-06-24'}" },
    { "name": "config:productivity_files", "ok": false, "detail": "months 2026-07..2026-09 have no workbook id", "hint": "Set config key productivity_files with per-month workbook ids; Maqsam/FD_AUX backfill impossible for unconfigured months" },
    { "name": "sheet:Activities", "ok": true, "detail": "12,340 rows, 2026-07-03 → 2026-10-31" }
  ]
}
```

## Acceptance

- Endpoint returns 200 with the full check matrix for an admin; 401/403 for non-admin.
- Every check carries `detail` + `hint`; nothing throws (a check that errors is itself a failed check with the error as detail).
- The TPH page (02) links to it from the `storeErrors` banner.
- `[H]` flagged before implementation: exact response consumption by UI is new — keep shape stable so the page can render it generically.
