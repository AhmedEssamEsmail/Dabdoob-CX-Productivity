# S03-24: mark cx-hub/lib {aggregates,home-cards,myday-google}
Kind: mini
ID: S03-24
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks aggregates.ts, home-cards.ts, myday-google.ts.

## Files
- Edit: `src/features/cx-hub/lib/aggregates.ts` | first statement
- Edit: `src/features/cx-hub/lib/home-cards.ts` | first statement
- Edit: `src/features/cx-hub/lib/myday-google.ts` | first statement

## Context
- `src/app/api/hub/home/route.ts:4` | aggregates consumer is an API route (server)
- `src/features/cx-hub/components/` | components import hub-shared only — lib is server-only

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. aggregates.ts: insert the marker import.
2. home-cards.ts: insert the marker import.
3. myday-google.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-24.md (<=10 lines); TL alone updates TRACKER.md.
