# S08-02: tph lib stops doing PostgREST on the anon auth client
Kind: mini
ID: S08-02
Parent: S08
Owner: dev
Depends: S08-01
Criteria: PLAN #8 (no server table reads via the anon-key auth client)
Skills: none
Budget: files=2; actions=4; changed_lines=50; minutes=6

## Goal
`cx-productivity/lib/tph/write.ts` and `run.ts` replace every
`await createAuthClient()` used for `.from(...)` table access with `db()`
(service role after S08-01). Auth helpers themselves are untouched.

## Files
- Edit: `src/features/cx-productivity/lib/tph/write.ts` | `createAuthClient()` at ~:89,:157,:222 + its import (:3)
- Edit: `src/features/cx-productivity/lib/tph/run.ts` | `createAuthClient()` at ~:45,:59,:75,:110,:168,:194,:221 + its import (:3)

## Context
- `src/features/shared/platform/repo.ts:24-26` | `db()` — the service client to import
- `src/features/cx-productivity/lib/tph/write.ts:89,157,222` | the three auth-client sites (writes: tph days/tasks/cases upserts)
- `src/features/cx-productivity/lib/tph/run.ts:45-221` | seven auth-client sites (run/read paths)
- `src/features/cx-productivity/lib/tph/page.ts` | ALREADY swapped to db() by S03-01 — do not touch

## Contract
- Each `const supabase = await createAuthClient()` becomes `const supabase = db()` (or direct `db().from(...)` where the variable is single-use); `createAuthClient` imports removed from both files.
- `import { db } from '@/features/shared/platform/repo'` (match the codebase's alias style).
- Zero behavioral change to queries — only the client object.
Out of scope: page.ts (done), routes (S08-03), any query-logic edits.

## Actions
1. write.ts: swap all `createAuthClient()` table-client uses to `db()`; drop the import.
2. run.ts: same for its seven sites; drop the import.
3. Grep both files: no `createAuthClient` remains.
4. `npx tsc --noEmit` clean.

## Done when
- `createAuthClient` appears nowhere in either file; all `.from(` calls run on `db()`.
- `npx vitest run tests/golden/tph.test.ts tests/jobs` green.

## Verify
- Run: `npx vitest run tests/golden/tph.test.ts tests/jobs` -> all pass.

## Handoff
Clears the lib for S08-04's deny-all migration. Write results/S08-02.md
(<=10 lines); TL alone updates TRACKER.md.
