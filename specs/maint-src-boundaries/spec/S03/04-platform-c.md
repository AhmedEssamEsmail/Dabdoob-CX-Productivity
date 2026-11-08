# S03-04: mark shared/platform {notify,options,popups}
Kind: mini
ID: S03-04
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks notify.ts, options.ts, popups.ts.

## Files
- Edit: `src/features/shared/platform/notify.ts` | first statement
- Edit: `src/features/shared/platform/options.ts` | first statement
- Edit: `src/features/shared/platform/popups.ts` | first statement

## Context
- `src/features/shared/platform/index.ts:19-30` | these three are barrel-exported members of the marked set

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
Out of scope: every other file.

## Actions
1. notify.ts: insert the marker import.
2. options.ts: insert the marker import.
3. popups.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-04.md (<=10 lines); TL alone updates TRACKER.md.
