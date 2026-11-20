# tl-2 — auto-checkins FIX round (qa-1)

Source: `reports/qa-1.md` (FAIL, 1 MED open). Fix spec: `spec/fix-qa-1.md`.

## Dispatched
| Leaf | Owner | Status | Evidence |
|---|---|---|---|
| qa1-01 | dev | verified | `results/qa1-01.md`; jobs.ts retry gate + `dqSnapshotRows_`; new test 'retries an orphaned submission from the captured snapshot rows' |

## Changed files (DELTA scope for qa-2 re-review)
- `src/features/cx-queue/lib/jobs.ts` — submission existence check (`subDone`) now loads once per tick and runs for every processed cp that has a snapshot, independent of this-tick capture; insert + `resolvePopups` wrapped in try/catch -> `hbBeat` warn so a transient failure retries next tick; retry reuses frozen `queue_snapshots` rows (never `live`). New helper `dqSnapshotRows_`.
- `tests/golden/queue-checkin-auto.test.ts` — +1 regression test (seeded snapshot, no submission -> insert with `snapshot_key`, `system:job`, queues_json from frozen rows).

## Gates (round 2, TL-run)
- `npx vitest run tests/golden/queue-checkin-auto.test.ts tests/golden/queue-checkin.test.ts` -> 45/45 PASS (`spec/logs/fix-qa1-vitest.log`)
- `npx tsc --noEmit` -> exit 0 (`spec/logs/fix-qa1-tsc.log`)

## Deferred (LOW, per FIX rules)
- qa-2: delete 5 stray root logs (`results-ac01-*.log`, `tl-tsc-check.log`, `tl-vitest-full.log`)
- qa-3: assert no fresh `queue_checkin_missed` popup for the auto-submitted slot at NOW_LATE

## Notes for reviewer
- Retry gate keeps the existing 6h staleness window, so orphans older than 6h are not
  auto-backfilled — consistent with the report's accepted "no retroactive submission"
  design; transient failures (the MED) retry on the next tick.
- Non-fresh ticks still skip capture but DO retry orphaned submissions (freshness check
  lives inside the `!have[cp.key]` capture branch only).
