# S03-19: mark cx-people/lib {kpi/index,kpi/server,meetings}
Kind: mini
ID: S03-19
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks the kpi pair and meetings.ts.

## Files
- Edit: `src/features/cx-people/lib/kpi/index.ts` | first statement
- Edit: `src/features/cx-people/lib/kpi/server.ts` | first statement
- Edit: `src/features/cx-people/lib/meetings.ts` | first statement

## Context
- `src/features/cx-people/components/` | no component imports these lib modules — safe

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. kpi/index.ts: insert the marker import.
2. kpi/server.ts: insert the marker import.
3. meetings.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-19.md (<=10 lines); TL alone updates TRACKER.md.
