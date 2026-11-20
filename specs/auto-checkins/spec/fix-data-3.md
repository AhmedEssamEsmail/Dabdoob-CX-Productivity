# fix-data-3: data-analyst findings, round 3

Blocking finding from `reports/data-3.md` (data-5 MED only; `data-3` LOW stays deferred).
Project root: `C:\Users\AHMED\KPIs\CX-Hub`. All paths below are relative to it.

## data3-01: `todays` select error must abort the agg_snapshots_today rewrite, not degrade to "no rows"
Kind: mini
ID: data3-01
Parent: fix-data-3
Owner: data-engineer
Depends: none
Criteria: reports/data-3.md row `data-5` (MED)
Skills: none
Budget: files=2; actions=2; changed_lines=60; minutes=10

### Goal
In `dqCheckinTick_`, a transient failure of the `queue_snapshots` `todays`
SELECT must be treated as "todays = unknown, abort the rewrite" — never as
"todays = empty". Today the error is ignored (`(...).data || []`), so the
same transient blip that trips `snapErr` yields `todays=[]` and
`dqRewrite_('agg_snapshots_today', [])` then DELETEs every row of
`agg_snapshots_today` — silently, emptying the today-snapshot view exactly
during the failure window. Same degrade class as the data-4 fix (data2-01).

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqCheckinTick_` only: the `todays` select (~line 388) plus a guard so `dqRewrite_('agg_snapshots_today', ...)` (~line 449) is skipped on that error
- Edit: `tests/golden/queue-checkin-auto.test.ts` | add ONE regression test for the same behaviour

### Context
- `src/features/cx-queue/lib/jobs.ts:357-451` | `dqCheckinTick_`: `todays` select at ~line 388 destructures only `.data`; `dqRewrite_` call at ~line 449; `dqRewrite_` deletes all rows first (jobs.ts:71-80); `snapErr` precedent at lines 365-373,390
- `reports/data-3.md` | finding `data-5` row (exact fix suggestion)
- `tests/golden/queue-checkin-auto.test.ts:179-197` | the snapErr regression test to copy; `hubDb.missing.add('queue_snapshots')` is the error-injection seam; `hubDb.tables['agg_snapshots_today']` can be seeded directly
- `tests/golden/hub-fakes.ts:107-133` | `dead` query chain already covers `select/eq/order/limit`, so the `todays` error propagates with NO fakes change

### Contract
Destructure the `todays` select's `error` (e.g. `todaysErr`). When it is set:
emit ONE `hbBeat('queue_snapshot','warn', ...)` note naming the failure and
skip `dqRewrite_('agg_snapshots_today', ...)` entirely this tick (guard the
call or early-shape `todays`; implementer's choice, matching the snapErr
pattern). `dqRemindMissedCheckins_` still runs; the function still returns
`captured`. On success the current behaviour is byte-for-byte unchanged.
Out of scope: `subErr` handling (data-3, LOW, stays deferred); the
`dqRemindMissedCheckins_` subErr noted in the report's assumptions; any other
function in jobs.ts; hub-fakes.ts (no change needed).

### Actions
1. Capture the `todays` select error; on error warn via `hbBeat` and skip the `dqRewrite_('agg_snapshots_today', ...)` call.
2. Add a regression test: `seed()` with frozen `queue_snapshots` rows AND at least one `agg_snapshots_today` row, then `hubDb.missing.add('queue_snapshots')`, run `dqCheckinTick_(NOW_ON_TIME, { fresh: true })`; assert it resolves (no throw) and `hubDb.tables['agg_snapshots_today']` still holds its seeded rows. Run the targeted vitest command; it must pass.

### Done when
- A `todays` select error produces a warn beat and `agg_snapshots_today` is untouched that tick.
- New regression test fails on the pre-fix code and passes after.
- Existing tests in `queue-checkin-auto.test.ts` still pass.

### Verify
- Run: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> all tests pass

### Handoff
None.
Write results/data3-01.md (<=10 lines); TL alone updates TRACKER.md.
