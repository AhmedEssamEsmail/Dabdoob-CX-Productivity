# S03-30: mark cx-productivity tph/grid-slots + jobs {backfill,productivity}
Kind: mini
ID: S03-30
Parent: S03
Owner: dev
Depends: S03-01, S02-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks the relocated grid-slots.ts and two jobs modules.

## Files
- Edit: `src/features/cx-productivity/lib/tph/grid-slots.ts` | first statement (exists only after S02-01)
- Edit: `src/features/cx-productivity/jobs/backfill.ts` | first statement
- Edit: `src/features/cx-productivity/jobs/productivity.ts` | first statement

## Context
- `scripts/ops/probe-flags.ts:3-4` | tsx script reaching these — S03-32 provides its tsconfig shim
- `src/app/api/admin/backfill/route.ts:5` | backfill consumer is an API route (server)

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. tph/grid-slots.ts: insert the marker import (below its doc header).
2. jobs/backfill.ts: insert the marker import.
3. jobs/productivity.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-30.md (<=10 lines); TL alone updates TRACKER.md.
