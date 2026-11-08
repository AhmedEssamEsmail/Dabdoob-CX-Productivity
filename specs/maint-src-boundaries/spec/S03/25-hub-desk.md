# S03-25: mark cx-hub/lib {myday,roster} + cx-desk/lib/jobshared
Kind: mini
ID: S03-25
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks myday.ts, roster.ts (hub tail) and desk jobshared.ts.

## Files
- Edit: `src/features/cx-hub/lib/myday.ts` | first statement
- Edit: `src/features/cx-hub/lib/roster.ts` | first statement
- Edit: `src/features/cx-desk/lib/jobshared.ts` | first statement

## Context
- `src/app/api/hub/my-day/route.ts:18`, `src/app/api/hub/roster/route.ts:15` | consumers are API routes (server)

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. myday.ts: insert the marker import.
2. roster.ts: insert the marker import.
3. jobshared.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-25.md (<=10 lines); TL alone updates TRACKER.md.
