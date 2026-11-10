# S10-06: engine.ts dup-skip counter + run-2 §4 NULL-key residual note
Kind: mini
ID: S10-06
Parent: S10
Owner: data-engineer
Depends: S10-05 (shares migration-run-2.md)
Criteria: finding data-6 (reports/data-1.md) — LOW
Skills: none
Budget: files=3; actions=4; changed_lines=40; minutes=8

## Goal
Write-time `skipped` counts require-filter drops only; upsertOn dup-collapses
silently shrink `migrated`, so the run ledger cannot reconcile
`read = migrated + skipped` the way the validator counts it. Add a dup-skip
counter, fold it into `skipped`, and document the NULL-key upsert residual.

## Files
- Edit: `src/features/shared/migration/engine.ts` | `TableResult` ~line 223, dedupe block ~253-257, return ~273
- Edit: `migration/migrate-all.ts` | the `skipped=` log template ~lines 67/77/83
- Edit: `specs/megaplan/audits/migration-run-2.md` | §4 (~lines 46-53) — append residual note AFTER S10-05's edit lands

## Context
- `src/features/shared/migration/engine.ts:223-273` | TableResult shape,
  `skipped` computed pre-dedupe (line 251), `seen` Map collapse, return shape
- `migration/migrate-all.ts:67,77,83` | `skipped=${r.skipped ?? 0}` prints
- `specs/migration-remaining/logs/null-key-probes.md` | 14/14 probes = 0 —
  the residual is theoretical today
- `src/features/shared/migration/engine.ts:256` | `String(r[k])` on a NULL
  key cell -> 'null' composite: dedupes locally but NULL never conflicts
  remotely -> residual dup-per-run

## Contract
- `TableResult` gains `dupSkipped?: number`. In `migrateTable`: count
  `dupSkipped = mapped.length - seen.size` when `upsertOn` is set (0
  otherwise), return `skipped` = require-drops + dupSkipped and `dupSkipped`
  separately — the breakdown stays visible AND `read = migrated + skipped`
  reconciles.
- migrate-all log lines may append `dup=${r.dupSkipped ?? 0}` when cheap; no
  other print/logic changes. `backfillTrackerRecords` untouched.
- run-2 §4 note (2-3 lines): upsertOn dup-collapses are counted as
  `dupSkipped`/skipped; NULL-key cells stringify to 'null' locally but never
  conflict remotely — residual dup-per-run risk, currently 0 NULLs probed.
Out of scope: validator (S10-02), mappings, other CLI files, the §1 headline
(S10-05's edit).

## Actions
1. engine.ts: `dupSkipped` on TableResult + count + reconcile in the return.
2. migrate-all.ts: include `dup=` in the skipped print (same lines).
3. migration-run-2.md §4: append the NULL-key residual note.
4. `npx tsc --noEmit` + a scoped `--dry` table to sanity-check the counter.

## Done when
- `npx tsc --noEmit` exit=0.
- `npx tsx migration/migrate-all.ts --dry` exit=0 (spot-check one upsertOn
  table's line still prints; dup-collapses now counted).
- §4 note present in migration-run-2.md.

## Verify
- Run: `npx tsc --noEmit` -> exit=0

## Handoff
None.
Write results/S10-06.md (<=10 lines); TL alone updates TRACKER.md.
