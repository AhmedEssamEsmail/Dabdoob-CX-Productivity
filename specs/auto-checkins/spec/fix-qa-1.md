# fix-qa-1 — auto-checkins qa round 1 fixes

Source report: `specs/auto-checkins/reports/qa-1.md`. Only blocking finding qa-1 (MED)
is dispatched here; qa-2 and qa-3 are LOW -> deferred in TRACKER.

## qa1-01: retry auto-submission when the snapshot exists but the insert never landed
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: qa-1.md row qa-1 (MED); PLAN #2/#3
Skills: none
Budget: files=2; actions=4; changed_lines=150; minutes=10

### Goal
In `dqCheckinTick_`, a slot whose `queue_snapshots` upsert succeeded but whose
`queue_submissions` insert (or `resolvePopups`) threw is permanently orphaned:
next tick `have[cp.key]` short-circuits at jobs.ts:368 so the submission is never
retried and missed reminders keep firing for 12h. Make the submission step retry
for every processed checkpoint that has a captured snapshot but no submission row.

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqCheckinTick_` region ~357-419 (capture loop + lazy `subDone` load + insert block); may add one small local helper for reading snapshot rows back by `snapshot_key`
- Edit: `tests/golden/queue-checkin-auto.test.ts` | add ONE regression test in the existing describe block

### Context
- `src/features/cx-queue/lib/jobs.ts:350-425` | `dqCheckinTick_` current loop; `have` gate at :368 is the bug; lazy `subDone` load at :389-401; insert block at :402-418
- `src/features/cx-queue/lib/jobs.ts:338-344` | `dqAutoCheckinQueues_` — reuse for queues_json on retried rows (field names: `oldest_h` -> `oldestH`, `data_as_of`)
- `tests/golden/queue-checkin-auto.test.ts` | existing harness: `hubSetTables` seeds `queue_snapshots`/`queue_submissions`; CP_KEY '2026-10-15|14:00'
- `specs/auto-checkins/reports/qa-1.md` row qa-1 | QA's suggested fixes (either is acceptable)

### Contract
Invariant: for every checkpoint `cp` the tick processes (past `readAfter`), if a
`queue_snapshots` row with `snapshot_key = cp.key` exists and no `queue_submissions`
row exists for `cp.key`, the tick attempts the insert — whether the snapshot was
captured this tick or an earlier one. Insert stays insert-only/idempotent; a human
submission is never overwritten. A failure inside the insert/`resolvePopups` block
must not abort the rest of the tick: catch it, `hbBeat('queue_snapshot','warn',...)`
and continue so the next tick retries (the `subDone[cp.key]` flip must only happen
after a successful insert). Retried submissions reuse the already-captured snapshot
rows (query `queue_snapshots` by `snapshot_key`, or reuse `rows` when captured this
tick) so queues_json always reflects frozen snapshot data — never re-read `live` for
a retry. Keep behaviour unchanged for slots with no snapshot at all.
Out of scope: `dqRemindMissedCheckins_`, any other file, schema changes, the LOW
findings, retroactive submissions for pre-deploy captures.

### Actions
1. Restructure the `dqCheckinTick_` loop so the `have[cp.key]` skip applies only to
   snapshot capture, not to the submission existence check (e.g. keep capture under
   `!have[cp.key]`, then run a separate submission gate for processed cps; or apply
   QA's alternative equivalent structure).
2. Load `subDone` once per tick for all relevant cp dates (existing lazy query may
   move earlier) and, for a cp with a snapshot but `!subDone[cp.key]`, fetch its
   captured `queue_snapshots` rows by `snapshot_key` (skip if none) and run the
   existing insert + `resolvePopups` inside a try/catch that warns via `hbBeat` and
   continues the loop.
3. Add one regression test: seed `queue_snapshots` with rows for CP_KEY (no
   submission), run `dqCheckinTick_(NOW_ON_TIME, { fresh: true })`, assert one
   `queue_submissions` row is inserted with `snapshot_key = CP_KEY`,
   `submitted_by 'system:job'`, and queues_json built from the seeded snapshot rows.
4. Run the targeted vitest command below plus `npx tsc --noEmit`; write results file.

### Done when
- New regression test fails on the pre-fix code path (snapshot exists + no
  submission + `have[cp.key]` true -> previously skipped) and passes after.
- All 4 pre-existing tests in the file still pass (idempotency, late, non-fresh).
- `npx tsc --noEmit` clean; insert failure path warns instead of throwing through
  the loop (visible in code, not required to test).

### Verify
- Run: `npx vitest run tests/golden/queue-checkin-auto.test.ts tests/golden/queue-checkin.test.ts` -> all pass
- Run: `npx tsc --noEmit` -> exit 0

### Handoff
`dqCheckinTick_` retries orphaned auto-submissions each tick; evidence for qa-1
re-review is the new test + the restructured gate.
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
