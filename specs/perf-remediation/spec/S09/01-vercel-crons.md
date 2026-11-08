# S09-01: vercel.json schedules job-data-tick + the four reminder crons
Kind: mini
ID: S09-01
Parent: S09
Owner: dev
Depends: none
Criteria: PLAN #9 (vercel.json schedules)
Skills: none
Budget: files=1; actions=5; changed_lines=20; minutes=4

## Goal
Append five `"crons"` entries to `vercel.json` matching the cadences the
migration-012 schedule draft recorded (times are UTC).

## Files
- Edit: `vercel.json` | the `"crons"` array (lines 3-220) — append only

## Context
- `vercel.json` | existing 8 crons incl. tph-hourly x2/h — all stay untouched
- `supabase/migrations/012_pg_cron_schedule.sql:52-154` | authoritative cadences:
  job-data-tick `*/15 * * * *`, oo-reminders `*/15 * * * *`,
  missed-1on1-check `30 19 * * *` (22:30 Kuwait), task-reminders `0 7 * * *` (10:00 KW), meeting-reminders `30 7 * * *` (10:30 KW)
- `src/app/api/cron/job-data-tick/route.ts`, `oo-reminders`, `task-reminders`, `meeting-reminders`, `missed-1on1-check` | routes exist + Bearer-gated already

## Contract
- Add exactly: `/api/cron/job-data-tick` `*/15 * * * *`; `/api/cron/oo-reminders` `*/15 * * * *`; `/api/cron/task-reminders` `0 7 * * *`; `/api/cron/meeting-reminders` `30 7 * * *`; `/api/cron/missed-1on1-check` `30 19 * * *`.
- JSON stays valid; no other key edited; no route file touched.
Out of scope: tph-hourly cadence (unchanged), pg_cron (stays unused), the missed-check `cxh-mail-desk`/other 012 jobs not in the PLAN list.

## Actions
1. Append `/api/cron/job-data-tick` `*/15 * * * *`.
2. Append `/api/cron/oo-reminders` `*/15 * * * *`.
3. Append `/api/cron/task-reminders` `0 7 * * *`.
4. Append `/api/cron/meeting-reminders` `30 7 * * *`.
5. Append `/api/cron/missed-1on1-check` `30 19 * * *`.

## Done when
- `vercel.json` parses (valid JSON); the five entries exist with exact paths/schedules; nothing else changed.

## Verify
- Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"` -> `ok`.

## Handoff
S11-01 documents the final schedule table. Write results/S09-01.md (<=10 lines); TL alone updates TRACKER.md.
