# S11-01: ARCHITECTURE.md cron table matches the deployed schedule
Kind: mini
ID: S11-01
Parent: root
Owner: tech-writer
Depends: S09-01
Criteria: PLAN #11 (docs flag: ARCHITECTURE.md cron table update)
Skills: none
Budget: files=1; actions=2; changed_lines=20; minutes=4

## Goal
`ARCHITECTURE.md`'s cron/scheduled-jobs table lists the final Vercel
schedule set — including the five entries added by S09-01 — and notes that
pg_cron remains installed-but-unused.

## Files
- Edit: `ARCHITECTURE.md` | the cron/jobs schedule table only (project root)

## Context
- `vercel.json` | authoritative schedule list after S09-01 (13 entries total)
- `supabase/migrations/012_pg_cron_schedule.sql` | why pg_cron rows exist but nothing is scheduled (keep the doc note consistent)

## Contract
- Update/add rows so every vercel.json cron path+schedule appears; mark pg_cron "installed, not scheduled (Vercel owns scheduling)".
- Doc-only: no code fences altered beyond the table text; no other sections touched.
Out of scope: README, other docs, code.

## Actions
1. Sync the cron table to vercel.json's final set.
2. Note the pg_cron-unused status.

## Done when
- Every vercel.json cron path appears in the doc table; pg_cron status noted.

## Verify
- Run: `git diff --stat` -> only ARCHITECTURE.md changed (or equivalent manual check).

## Handoff
None — last leaf. Write results/S11-01.md (<=10 lines); TL alone updates TRACKER.md.
