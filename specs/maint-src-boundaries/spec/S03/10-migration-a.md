# S03-10: mark shared/migration engine + 2 mappings
Kind: mini
ID: S03-10
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks the migration engine and two mapping tables.

## Files
- Edit: `src/features/shared/migration/engine.ts` | first statement
- Edit: `src/features/shared/migration/mappings/desk-operations.ts` | first statement
- Edit: `src/features/shared/migration/mappings/people-core.ts` | first statement

## Context
- `src/features/shared/migration/engine.ts:1-16` | doc header stays above the marker
- `src/features/shared/migration/engine.ts:28` | module-scope `process.env` already server-bound — marking matches reality

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
Out of scope: the other two mappings (S03-11); `migration/*.ts` scripts (self-contained).

## Actions
1. engine.ts: insert the marker import.
2. desk-operations.ts: insert the marker import.
3. people-core.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-10.md (<=10 lines); TL alone updates TRACKER.md.
