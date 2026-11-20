# fix-data-1: data-analyst findings, round 1

Blocking findings from `reports/data-1.md` (MED only; `data-3` is LOW -> deferred).
Project root: `C:\Users\AHMED\KPIs\CX-Hub`. All paths below are relative to it.

## data1-01: `have` snapshot-key lookup must span every cp year (year-boundary bug)
Kind: mini
ID: data1-01
Parent: fix-data-1
Owner: data-engineer
Depends: none
Criteria: reports/data-1.md row `data-1` (MED)
Skills: none
Budget: files=2; actions=3; changed_lines=80; minutes=10

### Goal
`dqCheckinTick_` must not re-capture (upsert live numbers over) an already-frozen
cross-year snapshot. On Jan 1, a Dec-31 cp inside its 6h window must see its
existing `queue_snapshots` rows via `have` even though those rows carry
`year=2025` while `today`'s year is 2026.

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqCheckinTick_` only, the `have` load (~lines 362-368)
- Edit: `tests/golden/queue-checkin-auto.test.ts` | add ONE regression test for the same behaviour

### Context
- `src/features/cx-queue/lib/jobs.ts:357-435` | the tick loop; `cps` (line 362) spans yesterday+today; `have` loaded `.eq('year', year)` where `year` = today's year (lines 363-368); captured rows carry `year: Number(cp.date.slice(0, 4))` (line 401)
- `src/features/cx-queue/lib/jobs.ts:385-410` | capture branch that wrongly re-upserts live rows when `have[cp.key]` is false
- `tests/golden/queue-checkin-auto.test.ts` | seed() pattern and existing 'retries an orphaned submission' test to copy
- `reports/data-1.md` | finding `data-1` row (exact fix suggestion)

### Contract
After the change, `have` covers every year present in `cps` (e.g. `.in('year',
[...new Set(cps.map((c) => Number(c.date.slice(0, 4))))])` per the report, or
`.in('snapshot_key', cps.map((c) => c.key))`). No other behaviour changes: the
`todays` load (line 383) stays `.eq('year', year).eq('slot_date', today)`; the
capture/upsert shape is untouched.
Out of scope: the `subDone`/popup logic (data1-02); `subErr` handling (data-3, deferred); any other function in jobs.ts.

### Actions
1. Change the `have` snapshot-key SELECT so it covers all years (or keys) in `cps`, per the report's exact fix.
2. Add a regression test: seed `queue_snapshots` rows for a yesterday-year cp (configure a slot whose cp falls inside the 6h window across the year boundary, e.g. a '23:00' slot on Dec 31 ticked early Jan 1; extend `seed()` with a slot/config override if needed), run the tick, assert `captured === 0`, seeded rows unchanged, and any inserted submission's `queues_json.data_as_of` equals the frozen value.
3. Run the targeted vitest command; it must pass.

### Done when
- `have` is populated for cross-year cp keys (no `year`-only-today filter).
- New regression test fails on the pre-fix code and passes after.
- Existing tests in `queue-checkin-auto.test.ts` still pass.

### Verify
- Run: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> all tests pass

### Handoff
data1-02 edits the same file; TL serialises it after this leaf completes.
Write results/data1-01.md (<=10 lines); TL alone updates TRACKER.md.

## data1-02: missed-checkin popup must be resolved even when the submission already exists
Kind: mini
ID: data1-02
Parent: fix-data-1
Owner: data-engineer
Depends: data1-01
Criteria: reports/data-1.md row `data-2` (MED)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=10

### Goal
A `queue_checkin_missed` popup for a slot that HAS a submission must be resolved.
Today, if `appendRow` succeeded but `resolvePopups` threw, every later tick hits
`if (subDone[cp.key]) continue` and never retries the resolve — the popup stays
open forever for a done slot.

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqCheckinTick_` only, the `subDone` guard + insert/resolve block (~lines 412-434)
- Edit: `tests/golden/queue-checkin-auto.test.ts` | add ONE regression test for the same behaviour

### Context
- `src/features/cx-queue/lib/jobs.ts:385-435` | the per-cp loop; `if (subDone[cp.key]) continue` at line 413 sits before the try that does `appendRow` then `resolvePopups` (lines 414-434); `subDone[cp.key] = true` is set inside the try before `resolvePopups` (line 430-431)
- `reports/data-1.md` | finding `data-2` row (exact fix suggestion)
- `tests/golden/queue-checkin-auto.test.ts:123-135` | existing popup test pattern (popup seed shape: kind `queue_checkin_missed`, ref = cp.key)

### Contract
Move popup resolution out of the insert-guarded path per the report's exact fix:
when `subDone[cp.key]` is true (pre-existing or just-inserted submission), the
tick still attempts `resolvePopups('queue_checkin_missed', cp.key, 'system:job')`.
A resolve failure must not break capture or throw out of the loop (keep/extend
the existing warn-and-continue pattern). No changes to `appendRow` args, the
`subDone` preload, or `dqRemindMissedCheckins_`.
Out of scope: the `have` lookup (data1-01); `subErr` handling (data-3, deferred); any other function in jobs.ts.

### Actions
1. Restructure lines 412-434 so `resolvePopups` also runs when `subDone[cp.key]` is already true (e.g. resolve inside the `subDone` branch before `continue`, in its own try/catch), keeping the post-insert resolve intact.
2. Add a regression test: seed a `queue_submissions` row for the cp AND an unresolved `queue_checkin_missed` popup, run the tick, assert `subs()` length stays 1 and the popup's `resolved_at` is set.
3. Run the targeted vitest command; it must pass.

### Done when
- `resolvePopups` is attempted for cps in `subDone`, not only after a fresh insert.
- New regression test fails on the pre-fix code and passes after.
- Existing tests in `queue-checkin-auto.test.ts` still pass.

### Verify
- Run: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> all tests pass

### Handoff
None.
Write results/data1-02.md (<=10 lines); TL alone updates TRACKER.md.
