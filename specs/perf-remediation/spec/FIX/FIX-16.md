# FIX-16: Bound `buildQueueAggregates_` tickets read server-side (perf-2)
Kind: mini
ID: FIX-16
Parent: -
Owner: dev
Depends: none
Criteria: perf-1 finding perf-2 (MED): `tickets` select with NO where — full seq scan of ~176k rows/72MB every job-data-tick (now */15)
Skills: none
Budget: files=2; actions=3; changed_lines=90; minutes=9

## Goal
The `tickets` read in `buildQueueAggregates_` fetches only rows the aggregate
can consume: every open-status row (aging board) plus rows created/resolved in
the recent window the counters use — instead of the whole 176k-row table.

## Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | the tickets query in `buildQueueAggregates_` (~lines 94-97) only
- Create: `tests/jobs/queue-tickets-read.test.ts` | focused regression test for the same bound

## Context
- `src/features/cx-queue/lib/jobs.ts:85-119` | `buildQueueAggregates_` — the unfiltered `.select('ticket_id,status,...')` at ~94-97; `opts`/`cfg` already loaded
- `src/features/cx-queue/lib/index.ts:540-620` | `dqAgingOpts_` (open statuses come from `dqSetting_(cfg,'open_statuses')`, ~546) and `dqBuildAging_` — verify which dates the created/resolved counters compare so the bound is a superset
- `tests/platform/repo.test.ts:1-45` | Proxy-based thenable `supa.from` stub pattern that records chained calls — reuse for the regression test
- `specs/perf-remediation/reports/perf-1.md` (finding perf-2) | reviewer-specified predicate: `status in open_statuses` OR `created_at >= today-1d` OR `resolved_at >= today-1d`

## Contract
- Apply a PostgREST `.or('status.in.(<open statuses>),created_at.gte.<bound>,resolved_at.gte.<bound>')` to the tickets read. Open statuses = the `open_statuses` set from `opts`/`cfg` actually consumed by `dqBuildAging_` (not a hardcoded list). Quote/escape status values inside `in.(...)` per PostgREST rules (values with spaces/parens need double quotes).
- `<bound>` = the window edge the created/resolved-today counters use, minus a 1-day safety margin (verify against `dqBuildAging_`; e.g. `dqAddDays_` of the data-tz today, -1). Timestamps: `created_at`/`resolved_at` accept ISO bounds.
- Everything downstream (`dqBuildAging_`, `dqRewrite_`, logging, Freshchat block) unchanged; `rowsIn` log may legitimately shrink.
Out of scope: other jobs.ts reads (buildAgentAggregates_ = FIX-19, inflow, prod_intervals), index.ts, config defaults.

## Actions
1. Add the `.or(...)` bound to the tickets read (open statuses from opts + date bound with margin).
2. Write the regression test: stub `supa.from`/`db()` per repo.test.ts pattern, invoke `buildQueueAggregates_`, assert the `tickets` builder recorded `.or(` containing `status.in` and both `.gte` terms (fails on the unfiltered read).
3. Run the new test + the queue-aggregates suite.

## Done when
- The tickets read carries the `.or` bound; no open row is excluded and created/resolved window is a superset of the counters' needs.
- New test fails on the pre-change query shape and passes now.
- `npx tsc --noEmit` clean; `npx vitest run tests/jobs/queue-tickets-read.test.ts tests/golden/queue-aggregates.test.ts` green.

## Verify
- Run: `npx vitest run tests/jobs/queue-tickets-read.test.ts tests/golden/queue-aggregates.test.ts` -> all pass; `npx tsc --noEmit` -> 0 errors.

## Handoff
FIX-19 touches the same file (`buildAgentAggregates_`) — must run after this leaf.
Write results/FIX-16.md (<=10 lines); TL alone updates TRACKER.md.
