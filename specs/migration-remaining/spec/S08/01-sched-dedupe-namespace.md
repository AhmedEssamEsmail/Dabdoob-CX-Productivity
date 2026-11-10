# S08-01: disjoint dedupe_key namespace for v1 ShiftPlan -> sched_plan
Kind: mini
ID: S08-01
Parent: S08
Owner: dev
Depends: none
Criteria: PLAN #5; finding qa-1 (reports/qa-1.md)
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=5

## Goal
The v1_ops ShiftPlan transform must mint dedupe_key values that can never
collide with core-workbook sched_plan rows or the DDL backfill, both of which
use the 'mig-<n>' namespace (silent ON CONFLICT overwrite = data loss on the
approval-gated run).

## Files
- Edit: `src/features/shared/migration/mappings/v1-ops-sched.ts` | transform mint ~line 138 + two stale doc mentions

## Context
- `src/features/shared/migration/mappings/v1-ops-sched.ts:126-139` | ShiftPlan
  transform minting `'mig-' + ctx.index`
- `src/features/shared/migration/mappings/queue-quality.ts` | core sched_plan
  transform minting the same `'mig-'` namespace
- `supabase/migrations/20261109130633_dedupe_uniques_people_sched.sql:103-114` |
  DDL backfill minting `'mig-' || (rn-1)`

## Contract
Keep the transform signature, guard and segments_json logic untouched. Only
the dedupe_key literal changes, to `'v1-mig-' + ctx.index`.
Out of scope: every other mapping/transform; engine.ts; validate.ts; SQL.

## Actions
1. In ROW_TRANSFORMS.ShiftPlan change the minted key to `'v1-mig-' + ctx.index`.
2. Update the stale `'mig-<index>'` doc mentions (mapping comment ~line 33 and
   the DECISIONS[0] string) to say `v1-mig-`.
3. Confirm no other `'mig-'` literal remains in this file.

## Done when
- `grep -n "mig-" src/features/shared/migration/mappings/v1-ops-sched.ts`
  shows only `v1-mig-` occurrences.
- `npx tsc --noEmit` exit=0.

## Verify
- Run: `npx tsc --noEmit` -> exit=0
- Run: `grep -n "'mig-'" src/features/shared/migration/mappings/v1-ops-sched.ts`
  -> 0 matches (the bare prefix is gone).

## Handoff
v1 sched_plan upserts can no longer overwrite core sched_plan rows; recorded
in TRACKER gate log for the approval runbook.
Write results/S08-01.md (<=10 lines); TL alone updates TRACKER.md.
