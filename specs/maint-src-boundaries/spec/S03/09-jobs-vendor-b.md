# S03-09: mark shared/jobs/vendor-apis + shared/vendor {http,maqsam}
Kind: mini
ID: S03-09
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks vendor-apis.ts and the remaining vendor modules.

## Files
- Edit: `src/features/shared/jobs/vendor-apis.ts` | first statement
- Edit: `src/features/shared/vendor/http.ts` | first statement
- Edit: `src/features/shared/vendor/maqsam.ts` | first statement

## Context
- `src/features/shared/jobs/mirrors.ts:28` | consumes vendor-apis — all marked, consistent

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
Out of scope: every other file.

## Actions
1. vendor-apis.ts: insert the marker import.
2. http.ts: insert the marker import.
3. maqsam.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-09.md (<=10 lines); TL alone updates TRACKER.md.
