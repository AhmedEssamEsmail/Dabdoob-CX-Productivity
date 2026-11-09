# FIX-19: Bound `buildAgentAggregates_` prod_daily_layers read (perf-5)
Kind: mini
ID: FIX-19
Parent: -
Owner: dev
Depends: FIX-16
Criteria: perf-1 finding perf-5 (LOW, blocking per PM): `prod_daily_layers.select('*')` unbounded — ~15k rows/yr growth, nightly full read
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=6

## Goal
The nightly `prod_daily_layers` read fetches only the window `dqAgentPerf_` can
consume, instead of all-time rows.

## Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | the read in `buildAgentAggregates_` (~line 226) only
- Edit: `tests/jobs/queue-tickets-read.test.ts` | add a second focused case asserting the prod_daily_layers bound (created by FIX-16; extend its stub)

## Context
- `src/features/cx-queue/lib/jobs.ts:222-236` | `buildAgentAggregates_` — `select('*')` at :226; `today` (`dqDateKey_`) already computed at :225
- `src/features/cx-queue/lib/index.ts:760-807` | `dqAgentPerf_` — actual horizon: daily rows `today-30` (:775) and periods 7d/prev7d/mtd (:768-772); month start <= 31d back. Nothing older is read.
- `specs/perf-remediation/reports/perf-1.md` (finding perf-5) | reviewer fix: `gte('date', ...)` bound matching dqAgentPerf_'s horizon (or documented acceptance)

## Contract
- Add `.gte('date', dqAddDays_(today, -45))` (or the local add-days helper already imported) to the prod_daily_layers read — a superset of the real 31d horizon with margin. If verification shows `dqAgentPerf_` reads further back (e.g. year-over-year in the dead `Number(today.slice(5,7)) <= 2` branch), widen the bound to cover it and say so in results.
- Column name is `date`; rows with blank `date` are dropped by dqAgentPerf_ anyway (`!r.date` guard).
- Reuse FIX-16's thenable stub: extend the new spec file with a case asserting `.gte('date', ...)` is recorded on the `prod_daily_layers` builder.
Out of scope: everything else in jobs.ts and index.ts; the perf-2 tickets read (FIX-16).

## Actions
1. Add the `.gte('date', today-45d)` bound to the read.
2. Extend the FIX-16 spec file with the prod_daily_layers bound assertion.
3. Typecheck + run the spec file.

## Done when
- The read is date-bounded to >= today-45d (or the verified horizon); no row inside 7d/prev7d/mtd/30d windows is dropped.
- New assertion passes; would fail on the unbounded read.
- `npx tsc --noEmit` clean; `npx vitest run tests/jobs/queue-tickets-read.test.ts` green.

## Verify
- Run: `npx vitest run tests/jobs/queue-tickets-read.test.ts` -> all pass; `npx tsc --noEmit` -> 0 errors.

## Handoff
None.
Write results/FIX-19.md (<=10 lines); TL alone updates TRACKER.md.
