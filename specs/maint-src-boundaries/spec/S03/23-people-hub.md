# S03-23: mark cx-people/lib {tasks,work-core} + cx-hub/lib/admin
Kind: mini
ID: S03-23
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks tasks.ts, work-core.ts (people tail) and hub admin.ts.

## Files
- Edit: `src/features/cx-people/lib/tasks.ts` | first statement
- Edit: `src/features/cx-people/lib/work-core.ts` | first statement
- Edit: `src/features/cx-hub/lib/admin.ts` | first statement

## Context
- `src/app/api/people/tasks/route.ts:3` | tasks consumer is an API route (server)
- `src/app/api/hub/admin/route.ts:15` | admin consumer is an API route (server)

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. tasks.ts: insert the marker import.
2. work-core.ts: insert the marker import.
3. admin.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-23.md (<=10 lines); TL alone updates TRACKER.md.
