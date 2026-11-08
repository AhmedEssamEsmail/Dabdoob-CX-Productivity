# S03-31: mark cx-productivity/jobs {quarterly,tph}
Kind: mini
ID: S03-31
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=2; actions=2; changed_lines=4; minutes=5

## Goal
`import 'server-only'` marks the last two productivity jobs modules.

## Files
- Edit: `src/features/cx-productivity/jobs/quarterly.ts` | first statement
- Edit: `src/features/cx-productivity/jobs/tph.ts` | first statement

## Context
- `src/app/api/cron/` routes | jobs consumers are cron routes (server)

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. quarterly.ts: insert the marker import.
2. tph.ts: insert the marker import.

## Done when
- Both files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
Marking set complete — S03-32 may dispatch once other packages' leaves land.
Write results/S03-31.md (<=10 lines); TL alone updates TRACKER.md.
