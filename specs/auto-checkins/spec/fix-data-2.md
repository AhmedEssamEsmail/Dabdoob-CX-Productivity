# fix-data-2: data-analyst findings, round 2

Blocking findings from `reports/data-2.md` (data-4 MED only; `data-3` is LOW -> stays deferred).
Project root: `C:\Users\AHMED\KPIs\CX-Hub`. All paths below are relative to it.

## data2-01: `snapKeys` select error must abort capture+auto-insert, not degrade to "no snapshots"
Kind: mini
ID: data2-01
Parent: fix-data-2
Owner: data-engineer
Depends: none
Criteria: reports/data-2.md row `data-4` (MED)
Skills: none
Budget: files=3; actions=3; changed_lines=70; minutes=10

### Goal
In `dqCheckinTick_`, a transient failure of the `queue_snapshots` `snapshot_key`
SELECT must be treated as "have = unknown, abort this tick's capture and
auto-insert" — never as "have = empty". Today the error is ignored, so every
in-window cp recaptures from live and the upsert overwrites already-frozen
rows (captured_at/data_as_of/numbers), then auto-inserts a submission
embedding wrong-as-of data — the same "frozen rows, never live" violation
class as data-1.

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqCheckinTick_` only, the `have`/`snapKeys` load (~lines 364-368) plus a guard so the per-cp capture/auto-insert loop is skipped on that error
- Edit: `tests/golden/queue-checkin-auto.test.ts` | add ONE regression test for the same behaviour
- Edit: `tests/golden/hub-fakes.ts` | add `in() { return dead }` to the `dead` query object (~line 121) so a `missing` table surfaces `{data:null,error}` through `.in()` instead of a TypeError (same pattern as the earlier `.not()` extension)

### Context
- `src/features/cx-queue/lib/jobs.ts:357-446` | `dqCheckinTick_`: `snapKeys` select at line 365 destructures only `data`; `have` fills lines 366-368; per-cp capture/upsert loop lines 385-442; `todays` load line 383, `dqRewrite_` line 444, `dqRemindMissedCheckins_` line 445
- `reports/data-2.md` | finding `data-4` row (exact fix suggestion)
- `tests/golden/hub-fakes.ts:107-132` | `dead` query returned for `hubDb.missing` tables; `hubDb.missing.add('queue_snapshots')` is the error-injection seam
- `tests/golden/queue-checkin-auto.test.ts:155-177` | cross-year frozen-snapshot test to copy; `seed()` and `subs()` helpers at lines 21-50

### Contract
Capture the select's `error`. When it is set: emit ONE
`hbBeat('queue_snapshot','warn', ...)` note naming the failure and skip the
entire per-cp capture + auto-insert loop for this tick (e.g. guard the loop,
or iterate `snapErr ? [] : cps` — implementer's choice). `todays` load,
`dqRewrite_('agg_snapshots_today', ...)` and `dqRemindMissedCheckins_` still
run. On success the current behaviour is byte-for-byte unchanged.
Out of scope: `subErr` handling (data-3, LOW, stays deferred); `todays`
error handling; any other function in jobs.ts.

### Actions
1. Destructure `error` (e.g. `snapErr`) from the `snapKeys` select; on error warn via `hbBeat` and skip the capture/auto-insert loop.
2. Add `in() { return dead }` to the `dead` chain in hub-fakes.ts.
3. Add a regression test: `seed()` with frozen snapshots for the cp, then `hubDb.missing.add('queue_snapshots')`, run `dqCheckinTick_(NOW_ON_TIME, { fresh: true })`; assert it resolves (no throw), `captured === 0`, `subs()` stays empty, and seeded `hubDb.tables['queue_snapshots']` rows are untouched. Run the targeted vitest command; it must pass.

### Done when
- A `snapKeys` select error produces a warn beat and zero capture/upsert/auto-insert attempts that tick.
- New regression test fails on the pre-fix code and passes after.
- Existing tests in `queue-checkin-auto.test.ts` still pass.

### Verify
- Run: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> all tests pass

### Handoff
None.
Write results/data2-01.md (<=10 lines); TL alone updates TRACKER.md.
