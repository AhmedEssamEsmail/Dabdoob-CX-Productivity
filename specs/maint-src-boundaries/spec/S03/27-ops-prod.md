# S03-27: mark cx-operations/lib/trackers + cx-productivity/lib {prod-access,prod/analytics}
Kind: mini
ID: S03-27
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks trackers.ts, prod-access.ts, prod/analytics.ts.

## Files
- Edit: `src/features/cx-operations/lib/trackers.ts` | first statement
- Edit: `src/features/cx-productivity/lib/prod-access.ts` | first statement
- Edit: `src/features/cx-productivity/lib/prod/analytics.ts` | first statement

## Context
- `src/features/cx-operations/components/trackers-page.tsx` | imports only shared modules + fetch-json — trackers lib is route-consumed
- `src/features/cx-productivity/lib/prod-validation.ts` | client-reachable — do NOT mark

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: prod-validation.ts, every other file.

## Actions
1. trackers.ts: insert the marker import.
2. prod-access.ts: insert the marker import.
3. prod/analytics.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-27.md (<=10 lines); TL alone updates TRACKER.md.
