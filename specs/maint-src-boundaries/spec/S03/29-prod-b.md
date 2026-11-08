# S03-29: mark cx-productivity/lib/tph {page,run,write}
Kind: mini
ID: S03-29
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks tph/page.ts, tph/run.ts, tph/write.ts.

## Files
- Edit: `src/features/cx-productivity/lib/tph/page.ts` | first statement
- Edit: `src/features/cx-productivity/lib/tph/run.ts` | first statement
- Edit: `src/features/cx-productivity/lib/tph/write.ts` | first statement

## Context
- `src/app/api/tph/tasks/route.ts:5-6` | consumers are API routes (server)
- `tests/jobs/helpers.ts:9` | tests import tph via vitest alias stub — unaffected

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. tph/page.ts: insert the marker import.
2. tph/run.ts: insert the marker import.
3. tph/write.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-29.md (<=10 lines); TL alone updates TRACKER.md.
