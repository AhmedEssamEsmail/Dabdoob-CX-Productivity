# S03-06: mark shared/platform {time,viewas} + shared/vendor/freshchat
Kind: mini
ID: S03-06
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks time.ts, viewas.ts (platform tail) and vendor/freshchat.ts.

## Files
- Edit: `src/features/shared/platform/time.ts` | first statement
- Edit: `src/features/shared/platform/viewas.ts` | first statement
- Edit: `src/features/shared/vendor/freshchat.ts` | first statement

## Context
- `src/features/shared/platform/viewas.ts:1-18` | doc header stays above the marker
- `src/features/shared/lib/api-error.ts:12` | imports VIEW_AS_READONLY from viewas — both marked, consistent

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
Out of scope: every other file.

## Actions
1. time.ts: insert the marker import.
2. viewas.ts: insert the marker import.
3. freshchat.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-06.md (<=10 lines); TL alone updates TRACKER.md.
