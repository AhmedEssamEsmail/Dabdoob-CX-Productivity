# S04-01: updateRows batches to <=2 PostgREST calls per batch
Kind: mini
ID: S04-01
Parent: S04
Owner: dev
Depends: none
Criteria: PLAN #4 (updateRows per-row find+update loop eliminated)
Skills: none
Budget: files=2; actions=4; changed_lines=150; minutes=10

## Goal
`updateRows` in `platform/repo.ts` performs one `.in(keyField, keys)` read
for all current rows, runs each guard client-side, then one
`.upsert(mergedRows, { onConflict: keyField })` — 2 calls per batch instead
of 2 per row. Falls back to the old per-row update path when the table has
no usable conflict key (mirroring applyOp's constraint-fallback).

## Files
- Edit: `src/features/shared/platform/repo.ts` | `updateRows` (197-230)
- Edit: `tests/platform/repo.test.ts` | extend/adjust cases for the batched path + fallback

## Context
- `src/features/shared/platform/repo.ts:197-230` | current per-row findRow + update loop; `sanitizeInput`, `UPDATE_STAMP_FIELDS`, guard contract
- `src/features/shared/jobs/env.ts:599-622` | applyOp's upsert->constraint-error->delete+insert fallback pattern to mirror (upsert fallback here is per-row update)
- `tests/platform/repo.test.ts` | existing updateRows coverage — mock shape may assume per-row calls; adapt it
- `src/features/cx-queue/lib/pages.ts:219-225` | a real caller (`updateRow` on submission_id) — signature stays

## Contract
- Behavior preserved: one result entry per update (row-or-null), `null` when no current matched; `opts.guard` runs against the current row BEFORE merging (a throw still aborts the batch); `sanitizeInput` + `delete data[keyField]` semantics kept; `stampUpdates` stamps updated_by/updated_at; submitted_* can never be patched.
- Fast path: (1) `db().from(table).select('*').in(keyField, keys)`; (2) merge `{...current, ...patch}` per matched key; (3) single `.upsert(merged, { onConflict: keyField })`. Return entries built from the merged rows (not a re-select).
- Fallback: if the upsert errors with a missing-conflict-target message (`/constraint|conflict|42P10/i`, same regex applyOp uses), fall back to the ORIGINAL per-row findRow+update path for the whole batch.
- Single-update calls (`updateRow`, or `updates.length===1`) may keep the direct path.
Out of scope: findRow/appendRows/other repo fns, callers' code, CACHE map (S10 covers my-day only anyway).

## Actions
1. Rewrite `updateRows` fast path per the contract (batched `.in()` select + merged single upsert).
2. Add the constraint-error fallback that re-runs the ORIGINAL per-row findRow+update loop for the batch.
3. Preserve the existing guard-before-merge + sanitize + stamping order in the rewrite (check against :197-230 before removing the old loop).
4. repo.test.ts: update mocks for the batched calls; assert per-entry results, null-on-miss, guard throw aborts, fallback path on constraint error.

## Done when
- A batch of N updates costs <=2 PostgREST calls on the fast path; per-entry semantics match the old contract.
- `npx vitest run tests/platform/repo.test.ts` green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/platform/repo.test.ts` -> all pass.

## Handoff
S08-01 will edit db() in this same file afterward (serial dependency).
Write results/S04-01.md (<=10 lines); TL alone updates TRACKER.md.
