# S03-22: mark cx-people/lib scorecard trio
Kind: mini
ID: S03-22
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks scorecard-server.ts, scorecard/fcr.ts, scorecard/index.ts.

## Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | first statement
- Edit: `src/features/cx-people/lib/scorecard/fcr.ts` | first statement
- Edit: `src/features/cx-people/lib/scorecard/index.ts` | first statement

## Context
- `src/app/api/cron/scorecard-nightly/route.ts:6` | scorecard-server consumer is a cron route (server)

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. scorecard-server.ts: insert the marker import.
2. scorecard/fcr.ts: insert the marker import.
3. scorecard/index.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-22.md (<=10 lines); TL alone updates TRACKER.md.
