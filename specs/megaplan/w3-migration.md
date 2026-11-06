# Wave 3 — Data migration pipeline + vendor validation (6 WPs)

> Goal: extend the Sheets→Supabase pipeline to every unmigrated table (`00-gap-review.md` §7), so that when Google access lands (WP-51) the run is a single command. Code is unblocked now; the actual data run is credentialed.
> Method per `../cx-hub/80-data-migration.md`: extend `src/app/api/admin/migrate/route.ts` `MAPPINGS` (or `migration/migrate.ts` for CLI) — batched upserts, dedupe on natural keys, log skipped rows + reasons, read-only sources never written back. Headers come from each module's `*_HEADERS` constants in the legacy `.js` files (verified in `supabase/migrations/00N_*.sql` DDL).
> Depends on: W0. WP-34 needed before any live probe; WP-51 needed before the actual data run.

## WP-30 — queue + quality-engine table mappings

Add MAPPINGS for: `tickets` (FD_TICKET_HEADERS), `esc_seen`, `aging_open_tickets`, `aging_flags`, `queue_status_submissions` (DQ_SUBMISSIONS_HEADERS), `queue_snapshots` (incl. `year` column semantics), `agg_queue_now`, `agg_inflow_{daily,weekly,monthly,hourly}`, `agg_agent_perf`, `agg_agent_daily`, `agg_snapshots_today`, `refresh_log`, `agg_productivity_daily`, `sched_*`×7 (SCH_TABLES); quality engine: `qa_forms`, `qe_log`, `qe_candidates`, `qe_outcome`, `qe_catalogue`, `qe_build`, `qe_fd_cache`, `qa_access_log` + ctl/dispute/calibration/kb-gap tabs (find tab names in `Quality.js`/`QaEngine.js` ensureTable_ calls).
- Multi-year stores: iterate `ss_data_{year}_id` config keys (`CC2 Data {year}`).
- Source spreadsheet keys: `ss_tickets_id`, `ss_live_id`, `ss_quality_id` from `Stores.js`/`Config`.
- Gates: `tsc` clean; dry-run mode logs row counts per table (can't run live without creds — state that).

## WP-31 — people + core table mappings

Add MAPPINGS for: `actions`, `action_reviews`, `action_updates`, `action_task_details`, `action_planned_milestones`, `one_on_one_schedule`, `one_on_one_logs`, `one_on_one_topics`, `one_on_one_private_notes`, `meeting_series`, `meeting_series_members`, `meetings`, `meeting_attendees`, `pw_reminder_log`, `people_signals`, notes + hard-cases tabs (locate real tab names in `Notes.js`/`Actions.js`), `sc_daily`, `sc_behaviour`, `sc_months`; core: `Options`, `Popups`, `MailLog`, `Health`, `holidays`, `follow_up_done`; `kpi_behaviour_log`, `kpi_leave_log`, `kpi_ol_cases`.
- Soft-deleted rows (`one_on_one_logs.deleted_at` etc.): migrate them — D-DATA is full history.
- Gates: same as WP-30.

## WP-32 — desk + operations table mappings

Add MAPPINGS for: `tlp_resp_ratings`, `tlp_kb`, `tlp_otd`, `tlp_ticket_exclusions`, `tlp_shifts`, `tlp_queue_daily`, `tlp_team`, `tlp_area_metrics`, `mail_sla`, `mail_approvals`, `mail_approval_log`, `HeatmapInputs`, `HeatmapAssumptionSets`; `Trackers` + `TrackerFields` + every sheet-backed tracker's record tab (read `storage_mode`/`spreadsheet_id`/`tab_name`/`header_row` config rows — migrate records into internal tables per owner rule).
- Gates: same as WP-30.

## WP-33 — validator extension

- Extend `migration/validate.ts`: for every table in the full inventory produce source-sheet count vs Supabase count, skip-reason accounting, sampled field-level diff (first N rows), numeric checksums per table where meaningful.
- Emit `specs/megaplan/migration-report.md` scaffold (per-module sections; populated when the run lands).
- Gates: runs against local env without crashing when creds absent (graceful `SKIPPED — no credentials` rows).

## WP-34 — credential sync + vendor probes

- Copy Google/vendor env vars from `.env.production` → `.env.local` (listed in `BLOCKED_TASKS.md` B2 audit: `GOOGLE_*`, `FRESHDESK_*`, `FRESHCHAT_*`, `MAQSAM_*`). Never commit env files.
- Non-destructive probes (GET only): Freshdesk `/api/v2/tickets?per_page=1`, Maqsam base URL ping, Freshchat (expect fail — key absent → blocked register).
- Record which scopes the Google SA actually has (try a metadata GET on `GOOGLE_SHEET_ID`) — informs WP-51/52 feasibility.
- Gates: probe results written to `audits/credentials.md`; no secrets printed/committed.

## WP-35 — dry-run + skip ledger

- Run `migrate-dry-run` + the new mappings against whatever creds exist after WP-34; capture per-table `read/migrated/skipped` counts into `audits/migration-dryrun.md`.
- Any table that can't be read → append to blocked register with the exact sheet share needed.
- Gates: dry-run log committed; every unmigrated table has a reason row.

## Wave-3 exit criteria

Every table in §7 has a mapping + validator row; `migration-report.md` scaffold committed; creds audit doc lists exactly what's missing for the full run.
