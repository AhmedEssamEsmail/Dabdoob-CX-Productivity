# S03-13: mark cx-quality/lib {analytics,core,engine-live}
Kind: mini
ID: S03-13
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks three cx-quality lib modules.

## Files
- Edit: `src/features/cx-quality/lib/analytics.ts` | first statement
- Edit: `src/features/cx-quality/lib/core.ts` | first statement
- Edit: `src/features/cx-quality/lib/engine-live.ts` | first statement

## Context
- `src/features/cx-quality/components/` | no component imports cx-quality/lib (checked) — safe to mark

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. analytics.ts: insert the marker import.
2. core.ts: insert the marker import.
3. engine-live.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-13.md (<=10 lines); TL alone updates TRACKER.md.
