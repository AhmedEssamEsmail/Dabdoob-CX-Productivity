# S03-02: mark shared/platform {calendar,health,holidays}
Kind: mini
ID: S03-02
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks three server-exclusive platform modules.

## Files
- Edit: `src/features/shared/platform/calendar.ts` | first statement
- Edit: `src/features/shared/platform/health.ts` | first statement
- Edit: `src/features/shared/platform/holidays.ts` | first statement

## Context
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md` | server-only marker convention (Next handles it internally — no install)
- `src/features/shared/platform/index.ts:19-30` | barrel of the same set

## Contract
Insert `import 'server-only'` directly after any leading file-comment /
`/* eslint-disable */` header and before all other statements. One line + blank.
Out of scope: every other file; index.ts is marked in S03-03.

## Actions
1. calendar.ts: insert the marker import.
2. health.ts: insert the marker import.
3. holidays.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-02.md (<=10 lines); TL alone updates TRACKER.md.
