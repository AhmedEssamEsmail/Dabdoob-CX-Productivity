# FIX-02a: pg_cron + pg_net schedule for job-data-tick every 15 min
Kind: mini
ID: FIX-02a
Parent: -
Owner: supabase-expert
Depends: none
Criteria: qa-1 finding qa-2 (PM decision 2026-11-09); PLAN #9
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase-postgres-best-practices\SKILL.md
Budget: files=1; actions=4; changed_lines=80; minutes=8

## Goal
One new migration file that makes Supabase pg_cron call
`/api/cron/job-data-tick` every 15 minutes via pg_net — replacing the Vercel
daily cron (Hobby plan cannot do sub-daily). Remote apply is NOT this leaf.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new job_data_tick_pg_cron`; record the actual filename in results before editing

## Context
- `supabase/migrations/012_pg_cron_schedule.sql:60-77` | established pattern: `cron.schedule` + `net.http_get` + `jsonb_build_object('Authorization','Bearer ...')`, timeout 60000; unschedule-by-name guard for idempotence. NOTE: 012 is a blocked DRAFT — do not edit it.
- `src/app/api/cron/job-data-tick/route.ts:10-14` | route auth: `Authorization: Bearer <CRON_SECRET>` (returns 401 otherwise)
- `.devin/workflow.md` | agents write migration FILES only; remote apply needs user approval

## Contract
- `CREATE EXTENSION IF NOT EXISTS pg_cron` / `pg_net` (idempotence; already enabled by 011 remotely).
- Unschedule-by-name guard for jobname `cxh-job-data-tick`, then
  `SELECT cron.schedule('cxh-job-data-tick', '*/15 * * * *', $cmd$ ... $cmd$)`
  issuing ONE `net.http_get` to the app URL with the Bearer header, 60s timeout.
- Secret + URL come from DB-side config ONLY — `current_setting('<guc>', true)`
  and/or `vault.decrypted_secrets` at the expert's discretion per the official
  skill. ZERO literal secrets/URLs in the file (no {{PLACEHOLDER}} either —
  this file must be apply-ready).
- Header comment block: name the required DB settings/vault keys (e.g.
  `app.settings.app_url`, `app.settings.cron_secret`), state that apply is
  user-approved, and note the vercel.json entry is being removed in FIX-02b
  (apply must precede the vercel deploy to avoid a coverage gap).
Out of scope: other jobs in 012 (PM scoped cutover to job-data-tick only),
editing 012/011, remote apply, vercel.json, route code.

## Actions
1. `supabase migration new job_data_tick_pg_cron`; record filename.
2. Extensions + unschedule guard.
3. `cron.schedule` `*/15 * * * *` -> `net.http_get` with settings/vault-sourced URL + Bearer.
4. Header comment: required settings + apply-order warning.

## Done when
- File registered by `supabase migration list`; lint/skill local check passes.
- `grep` finds no literal secret or app URL in the file; schedule is `*/15`.
- Idempotent: re-apply replaces the job instead of duplicating.

## Verify
- Run: `supabase migration list` -> new file registered (or skill equivalent).

## Handoff
FIX-02b removes the Vercel entry + updates docs. NEEDS_APPROVAL: remote apply
after DB settings/vault keys are provisioned — before the vercel.json deploy.
Write results/FIX-02a.md (<=10 lines); TL alone updates TRACKER.md.
