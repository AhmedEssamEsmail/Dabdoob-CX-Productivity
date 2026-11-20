# TL report - auto-checkins FIX round 3 (reports/data-1.md)

## Outcome: COMPLETE — both MED findings fixed, gates green

## Findings routed (spec/fix-data-1.md)
| Finding | Leaf | Owner | Status |
|---|---|---|---|
| data-1 MED: cross-year `have` lookup | data1-01 | data-engineer | done |
| data-2 MED: popup resolve in insert-guarded path | data1-02 | data-engineer | done |
| data-3 LOW: `subErr` degrades to "no submissions" | - | - | deferred (LOW) |

## Changed files (DELTA for re-review)
- `src/features/cx-queue/lib/jobs.ts`
  - `dqCheckinTick_` `have` load: `.eq('year', year)` -> `.in('snapshot_key', cps.map(c => c.key))` (covers Dec-31 cp on Jan-1 tick; `todays` load untouched).
  - `subDone[cp.key]` guard: now attempts `resolvePopups('queue_checkin_missed', cp.key, 'system:job')` in its own try/catch + `hbBeat` warn before `continue`; post-insert resolve unchanged.
- `tests/golden/queue-checkin-auto.test.ts` (untracked, ongoing spec file)
  - +1 regression: frozen `2025-12-31|23:00` year-2025 rows on a Jan-1 tick -> captured 0, rows unchanged, submission embeds frozen `data_as_of` (verified failing pre-fix).
  - +1 regression: pre-existing submission + open `queue_checkin_missed` popup -> popup `resolved_at` set, subs stay 1 (verified failing pre-fix).
  - `seed()` gained a `slot` override for the cross-year test.

## Gates
- `npx tsc --noEmit` -> exit 0 (`logs/fix-data1-tsc.log`)
- `npx vitest run` targeted 5 files -> 54/54 pass (`logs/fix-data1-vitest.log`)

## Evidence
- `results/data1-01.md`, `results/data1-02.md`; worker logs `logs/data1-02-*.log`
- No review-gate shards spawned; re-review belongs to the PM.
- Note: owners wrote results files; one worker initially wrote to repo-root `results/` — moved to spec folder by TL.
