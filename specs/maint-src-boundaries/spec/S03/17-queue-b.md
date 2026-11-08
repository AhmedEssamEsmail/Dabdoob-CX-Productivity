# S03-17: mark cx-queue/lib {scheduler,server,tlqueue}
Kind: mini
ID: S03-17
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks scheduler.ts, server.ts, tlqueue.ts.

## Files
- Edit: `src/features/cx-queue/lib/scheduler.ts` | first statement
- Edit: `src/features/cx-queue/lib/server.ts` | first statement
- Edit: `src/features/cx-queue/lib/tlqueue.ts` | first statement

## Context
- `src/app/api/cron/job-tl-queue/route.ts:9` | tlqueue consumer is a cron route (server)

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. scheduler.ts: insert the marker import.
2. server.ts: insert the marker import.
3. tlqueue.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-17.md (<=10 lines); TL alone updates TRACKER.md.
