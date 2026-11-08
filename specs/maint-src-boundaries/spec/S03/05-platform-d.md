# S03-05: mark shared/platform {repo,settings,stores}
Kind: mini
ID: S03-05
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks the data-access trio repo.ts, settings.ts, stores.ts.

## Files
- Edit: `src/features/shared/platform/repo.ts` | first statement
- Edit: `src/features/shared/platform/settings.ts` | first statement
- Edit: `src/features/shared/platform/stores.ts` | first statement

## Context
- `src/features/shared/platform/index.ts:19-30` | barrel members of the marked set

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
Out of scope: every other file.

## Actions
1. repo.ts: insert the marker import.
2. settings.ts: insert the marker import.
3. stores.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-05.md (<=10 lines); TL alone updates TRACKER.md.
