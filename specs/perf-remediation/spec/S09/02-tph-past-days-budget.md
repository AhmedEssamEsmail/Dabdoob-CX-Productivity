# S09-02: job-tph-past-days exits inside a <=60s internal budget
Kind: mini
ID: S09-02
Parent: S09
Owner: dev
Depends: S02-03
Criteria: PLAN #9 (internal budget <=60s or self-chunked per day — budget option chosen)
Skills: none
Budget: files=3; actions=4; changed_lines=60; minutes=8

## Goal
The past-days rebuild stops cleanly at a ~55s budget (exiting between day
steps, before Vercel's wall clock matters) instead of running the legacy
270s guard. The remaining days are covered by later scheduled runs /
admin backfill — record in results if the day-loop can't checkpoint
cleanly.

## Files
- Edit: `src/features/cx-productivity/lib/tph/index.ts` | the time guard inside `tphBuildPastDays_` (270s -> parameterized)
- Edit: `src/features/cx-productivity/jobs/tph.ts` | `jobTphPastDays` threads the budget (39-61)
- Edit: `src/app/api/cron/job-tph-past-days/route.ts` | pass the configured budget (serial after S02-03)

## Context
- `src/features/cx-productivity/jobs/tph.ts:33-58` | doc comment names the 270s guard; find its constant in `tphBuildPastDays_` via grep `270|timeGuard|budget` in lib/tph/index.ts
- `src/app/api/cron/job-tph-past-days/route.ts:6` | `maxDuration = 300` stays — the internal budget is the work-limit, not the HTTP cap
- `tests/jobs/tph-jobs.test.ts`, `tests/golden/tph.test.ts` | guard behavior may be faked by `now` injection — keep the same seam

## Contract
- The guard becomes a parameter: `tphBuildPastDays_` accepts an optional `budgetMs` (default keeps 270s so tests/other callers are unaffected) — OR reads `tph_past_days_budget_ms` from cfg with a 270s default; pick ONE, prefer the explicit param.
- `jobTphPastDays(env, opts?: { budgetMs?: number })` forwards it; route passes 55_000.
- Exit point stays between day steps (the loop already iterates days/steps — the budget check happens where the 270s check does); partial progress is still refresh-logged exactly like a guard trip today.
- Signature additions only — existing call shapes keep working.
Out of scope: schedule changes (S09-01), env.ts, chunking to one-day-per-invocation (non-goal per package contract).

## Actions
1. index.ts: parameterize the 270s guard (default unchanged).
2. tph.ts: `jobTphPastDays` accepts + forwards `budgetMs`.
3. route.ts: pass `{ budgetMs: 55_000 }`.
4. Verify a budget trip produces the same step-out/refresh_log evidence a 270s trip produces today (note in results).

## Done when
- The route's invocation self-limits ~55s while the default stays 270s elsewhere.
- `npx vitest run tests/jobs/tph-jobs.test.ts tests/golden/tph.test.ts` green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/jobs/tph-jobs.test.ts tests/golden/tph.test.ts` -> all pass.

## Handoff
None. Write results/S09-02.md (<=10 lines); TL alone updates TRACKER.md.
