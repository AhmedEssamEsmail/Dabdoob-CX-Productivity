# S03-14: mark cx-quality/lib {engine,index,migrate}
Kind: mini
ID: S03-14
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks engine.ts, index.ts, migrate.ts.

## Files
- Edit: `src/features/cx-quality/lib/engine.ts` | first statement
- Edit: `src/features/cx-quality/lib/index.ts` | first statement
- Edit: `src/features/cx-quality/lib/migrate.ts` | first statement

## Context
- `src/features/cx-quality/components/` | no component imports cx-quality/lib — safe to mark

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. engine.ts: insert the marker import.
2. index.ts: insert the marker import.
3. migrate.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-14.md (<=10 lines); TL alone updates TRACKER.md.
