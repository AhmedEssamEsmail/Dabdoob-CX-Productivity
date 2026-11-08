# S03-12: mark shared/lib {api-error,auth,supabase}
Kind: mini
ID: S03-12
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks the three remaining named shared/lib server modules.

## Files
- Edit: `src/features/shared/lib/api-error.ts` | first statement
- Edit: `src/features/shared/lib/auth.ts` | first statement
- Edit: `src/features/shared/lib/supabase.ts` | first statement

## Context
- `src/features/shared/lib/auth.ts:37-46` | golden tests mock this module down to
  createAuthClient — mock replaces the module, marker harmless under vitest alias
- `src/features/shared/lib/supabase.ts:3-6` | module-scope env access — already server-bound
- `src/features/shared/lib/fetch-json.ts` | S01 module is client code — do NOT mark
- `src/features/shared/lib/{adapters,errors,fragments}.ts` | excluded per PLAN — do NOT mark

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports
(api-error.ts has a doc header lines 1-9; auth.ts/supabase.ts start with imports —
marker becomes line 1 there).
Out of scope: adapters/errors/fragments/fetch-json, auth.test.ts (S06-01 rewrites it).

## Actions
1. api-error.ts: insert the marker import after its doc header.
2. auth.ts: insert the marker import as line 1.
3. supabase.ts: insert the marker import as line 1.

## Done when
- All 3 files start with the marker; tsc clean; `npx vitest run` still green (alias).

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-12.md (<=10 lines); TL alone updates TRACKER.md.
