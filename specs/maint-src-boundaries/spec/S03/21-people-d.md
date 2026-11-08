# S03-21: mark cx-people/lib {one-on-ones-page,one-on-ones,reminders}
Kind: mini
ID: S03-21
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks one-on-ones-page.ts, one-on-ones.ts, reminders.ts.

## Files
- Edit: `src/features/cx-people/lib/one-on-ones-page.ts` | first statement
- Edit: `src/features/cx-people/lib/one-on-ones.ts` | first statement
- Edit: `src/features/cx-people/lib/reminders.ts` | first statement

## Context
- `src/app/api/people/one-on-ones/route.ts:3` | page-lib consumer is an API route (server)

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. one-on-ones-page.ts: insert the marker import.
2. one-on-ones.ts: insert the marker import.
3. reminders.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-21.md (<=10 lines); TL alone updates TRACKER.md.
