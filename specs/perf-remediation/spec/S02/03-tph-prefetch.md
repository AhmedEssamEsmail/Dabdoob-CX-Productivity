# S02-03: tph jobs prefetch their prod tables; hourly runs rosterless
Kind: mini
ID: S02-03
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #2 (job-tph-hourly reads <=3 tables instead of 12 + roster + config)
Skills: none
Budget: files=3; actions=4; changed_lines=40; minutes=6

## Goal
`jobTphHourly` and `jobTphPastDays` declare their prod tables via
`prefetchTables`; the hourly route opts out of the roster preload so the run
issues config + 2 prod reads (<=3 total).

## Files
- Edit: `src/features/cx-productivity/jobs/tph.ts` | prefetch lists inside `jobTphHourly` (22-31) and `jobTphPastDays` (39-61)
- Edit: `src/app/api/cron/job-tph-hourly/route.ts` | `buildJobEnv({ roster: false })` if the capture path needs no directory/headcount
- Edit: `src/app/api/cron/job-tph-past-days/route.ts` | keep roster default OR pass explicit opts only if the audit below shows an unused load

## Context
- `src/features/cx-productivity/jobs/tph.ts:22-61` | both job fns (existing prefetch calls for agg_queue_now / tickets / agg_inflow_hourly)
- `src/features/cx-productivity/lib/tph/index.ts:1342,1419,1444,1460-1462,1710,1757,1908,1942` | prodRows table names read by tphCaptureCases_/tphBuildPastDays_ paths — union them
- `src/features/shared/jobs/env.ts:450-461` | ensureHeadcount month-book fallback (why past-days keeps the roster preload: skipping it triggers a heavier Sheets read)
- `src/features/shared/jobs/env.ts:244-258` | BuildJobEnvOptions incl. new `roster` flag (S02-01)

## Contract
- `jobTphHourly`: extend its prefetchTables call to include every prod_tph_* table `tphCaptureCases_` reads (expected `prod_tph_cases`; add `prod_tph_days` only if the grep proves it).
- `jobTphPastDays`: extend its prefetch to `['tickets','agg_inflow_hourly','prod_tph_touches','prod_tph_calls','prod_tph_cases','prod_tph_days','prod_tph_tasks']` minus any name the grep shows unread.
- `job-tph-hourly` route: `buildJobEnv({ roster: false })` ONLY when the capture path never touches `env.dir`/`env.roster`/`env.headcount` (grep `env\.dir|env\.headcount|env\.roster` in the tphCaptureCases_ path); otherwise leave the call unchanged and record why in results.
- `job-tph-past-days` route: default (roster preload feeds headcount and avoids the workbook fallback).
Out of scope: the 270s guard/budget (S09-02 — same file, runs after), env.ts.

## Actions
1. tph.ts: extend `jobTphHourly`'s prefetchTables list per grep of tphCaptureCases_ prodRows usage.
2. tph.ts: extend `jobTphPastDays`'s prefetchTables list per grep of tphBuildPastDays_ prodRows usage.
3. job-tph-hourly route: apply `{ roster: false }` when the audit allows (evidence in results).
4. job-tph-past-days route: audit-only (confirm roster preload is the cheaper path); no edit unless the audit contradicts.

## Done when
- No prod_tph_* name is read via prodRows in the tph job paths without a preceding prefetch of it.
- `npx tsc --noEmit` clean; `npx vitest run tests/jobs/tph-jobs.test.ts tests/golden/tph.test.ts` green.

## Verify
- Run: `npx vitest run tests/jobs/tph-jobs.test.ts tests/golden/tph.test.ts` -> all pass.

## Handoff
S09-02 edits these same files afterward (budget work). Report whether hourly
met the <=3-table target (config + declared prefetches) in results/S02-03.md
(<=10 lines); TL alone updates TRACKER.md.
