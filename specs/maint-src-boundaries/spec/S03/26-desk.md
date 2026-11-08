# S03-26: mark cx-desk/lib {kpilogs,maildesk,tlperformance}
Kind: mini
ID: S03-26
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks kpilogs.ts, maildesk.ts, tlperformance.ts.

## Files
- Edit: `src/features/cx-desk/lib/kpilogs.ts` | first statement
- Edit: `src/features/cx-desk/lib/maildesk.ts` | first statement
- Edit: `src/features/cx-desk/lib/tlperformance.ts` | first statement

## Context
- `src/app/api/mail-desk/route.ts:2`, `src/app/api/desk/job/mail/route.ts:2` | consumers are API routes (server)
- `src/features/cx-desk/components/` | components import only fetchJson (now shared/lib/fetch-json, unmarked) — lib is server-only

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. kpilogs.ts: insert the marker import.
2. maildesk.ts: insert the marker import.
3. tlperformance.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-26.md (<=10 lines); TL alone updates TRACKER.md.
