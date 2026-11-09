# FIX-07: pg_net health-check job so a failed tick cannot pass silently
Kind: mini
ID: FIX-07
Parent: -
Owner: supabase-expert
Depends: none
Criteria: sec-1 finding sec-3 (LOW, blocking per task) — fire-and-forget net.http_get
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase-postgres-best-practices\SKILL.md
Budget: files=2; actions=3; changed_lines=60; minutes=8

## Goal
The job-data-tick migration gains a second scheduled job that fails loudly in
`cron.job_run_details` when the most recent pg_net response for the tick is
not a 200 (rotated/mismatched `cron_secret` -> 401, or a 500, or a missing
response) — closing the silent-scheduler-outage gap. Remote apply is NOT this
leaf.

## Files
- Edit: `supabase/migrations/20261108231643_job_data_tick_pg_cron.sql` | add health-check job + extend unschedule guard + verification comments (lines ~28-65)
- Edit: `docs/ARCHITECTURE.md` | one runbook line under the pg_cron paragraph (~line 57-60) documenting the check + where failures surface

## Context
- `supabase/migrations/20261108231643_job_data_tick_pg_cron.sql` | whole file; NOT yet applied remotely (TRACKER NEEDS_APPROVAL) so in-place edit is safe — keep it apply-ready
- `reports/sec-1.md` finding sec-3 | "add a follow-up cron step or periodic check asserting recent net._http_response.status = 200"
- `supabase/migrations/012_pg_cron_schedule.sql` | blocked DRAFT — do not edit

## Contract
- Extend the unschedule-by-name guard to also unschedule `cxh-job-data-tick-health`.
- `SELECT cron.schedule('cxh-job-data-tick-health', '<periodic, your choice — e.g. hourly offset from the tick>', $cmd$ ... $cmd$)`
  whose body selects the latest `net._http_response` row (job-data-tick is the
  sole pg_net caller — state that assumption in a comment) and
  `RAISE EXCEPTION` naming the bad status/error when `status_code <> 200`,
  `timed_out`, `error_msg IS NOT NULL`, or no recent row exists.
- Keep the existing `*/15` tick job, settings guard and zero-literal-secrets
  rule; update the header + verification comment block (job list, the
  health-check query for `cron.job_run_details`).
- ARCHITECTURE.md: one sentence only — health job name, cadence, that failures
  surface in `cron.job_run_details`.
Out of scope: remote apply/approval, other migrations, route code, vault.

## Actions
1. Extend unschedule guard + schedule the health-check job with the assertion body.
2. Update header/verification comments in the migration.
3. Add the runbook line in docs/ARCHITECTURE.md.

## Done when
- `supabase migration list` still registers the file; no literal secret/URL added.
- Both job names appear in the unschedule guard and in `cron.schedule` calls.
- ARCHITECTURE.md mentions `cxh-job-data-tick-health` + `cron.job_run_details`.

## Verify
- Run: `supabase migration list` -> file registered (or skill equivalent lint).

## Handoff
NEEDS_APPROVAL unchanged: remote apply after `app.settings.*` provisioning,
before the vercel.json deploy. Write results/FIX-07.md (<=10 lines); TL alone
updates TRACKER.md.
