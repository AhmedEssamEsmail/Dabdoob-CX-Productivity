# S03-20: mark cx-people/lib {notes,one-on-one-reminders,one-on-ones-delete}
Kind: mini
ID: S03-20
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks notes.ts, one-on-one-reminders.ts, one-on-ones-delete.ts.

## Files
- Edit: `src/features/cx-people/lib/notes.ts` | first statement
- Edit: `src/features/cx-people/lib/one-on-one-reminders.ts` | first statement
- Edit: `src/features/cx-people/lib/one-on-ones-delete.ts` | first statement

## Context
- `src/features/cx-people/components/` | no component imports these lib modules — safe

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. notes.ts: insert the marker import.
2. one-on-one-reminders.ts: insert the marker import.
3. one-on-ones-delete.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-20.md (<=10 lines); TL alone updates TRACKER.md.
