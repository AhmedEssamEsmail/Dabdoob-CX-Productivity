# S03-03: mark shared/platform {identity,index,mail}
Kind: mini
ID: S03-03
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks identity.ts, the platform barrel, and mail.ts.

## Files
- Edit: `src/features/shared/platform/identity.ts` | first statement
- Edit: `src/features/shared/platform/index.ts` | first statement
- Edit: `src/features/shared/platform/mail.ts` | first statement

## Context
- `src/features/shared/platform/identity.ts:1-23` | header comment stays above the marker
- `src/features/shared/platform/index.ts:19-30` | `export *` barrel — marker still required per-file

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports/exports.
Out of scope: every other file.

## Actions
1. identity.ts: insert the marker import.
2. index.ts: insert the marker import.
3. mail.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-03.md (<=10 lines); TL alone updates TRACKER.md.
