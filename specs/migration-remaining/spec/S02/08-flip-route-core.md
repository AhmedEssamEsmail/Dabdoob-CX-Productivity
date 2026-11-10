# S02-08: upsertOn flip — route-core.ts qa_volume
Kind: mini
ID: S02-08
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #5 (mapping idempotency, route-core)
Skills: none
Budget: files=1; actions=2; changed_lines=20; minutes=5

## Goal
Flip the single insert-only mapping in `route-core.ts` (`qa_volume`) to
`upsertOn` using the key S02-01 recorded.

## Files
- Edit: `src/features/shared/migration/mappings/route-core.ts` | the qa_volume literal only (~lines 160-162)

## Context
- `results/S02-01.md` | authoritative key for qa_volume (candidate
  (date,channel,contact_type))
- `src/features/shared/migration/engine.ts:210-217` | upsertOn dedupe

## Contract
Add `upsertOn: '<key>'` to the qa_volume mapping only. No other edit.
Out of scope: everything else in the file; remote apply.

## Actions
1. Add `upsertOn` to the qa_volume mapping literal.
2. Typecheck.

## Done when
- qa_volume carries the S02-01 key; diff shows one added line.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-08-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
All 23 insert-only mappings now upsertOn; live re-run safety is gated on the
S02 migrations being applied (PM approval gate). Write `results/S02-08.md`;
TL updates TRACKER.md.
