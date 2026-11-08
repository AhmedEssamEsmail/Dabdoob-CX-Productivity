# S03-16: mark cx-queue/lib {index,jobs,pages}
Kind: mini
ID: S03-16
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks index.ts, jobs.ts, pages.ts.

## Files
- Edit: `src/features/cx-queue/lib/index.ts` | first statement
- Edit: `src/features/cx-queue/lib/jobs.ts` | first statement
- Edit: `src/features/cx-queue/lib/pages.ts` | first statement

## Context
- `src/features/cx-queue/components/heatmap-page.tsx:15` | components reach only `../lib/heatmap-engine` (unmarked) — these three are safe

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: heatmap-engine.ts, every other file.

## Actions
1. index.ts: insert the marker import.
2. jobs.ts: insert the marker import.
3. pages.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-16.md (<=10 lines); TL alone updates TRACKER.md.
