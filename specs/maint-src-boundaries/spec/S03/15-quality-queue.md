# S03-15: mark cx-quality/lib {pure,server} + cx-queue/lib/heatmap
Kind: mini
ID: S03-15
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks pure.ts, server.ts (quality tail) and queue heatmap.ts.

## Files
- Edit: `src/features/cx-quality/lib/pure.ts` | first statement
- Edit: `src/features/cx-quality/lib/server.ts` | first statement
- Edit: `src/features/cx-queue/lib/heatmap.ts` | first statement

## Context
- `src/app/api/qa/[action]/route.ts:2` | server.ts consumer (route only)
- `src/features/cx-queue/lib/heatmap-engine.ts` | CLIENT-reachable via heatmap-page — do NOT mark (separate file)
- `src/features/cx-quality/lib/server.ts:59` | local `type Row` referenced by S04

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: heatmap-engine.ts (client-reachable), every other file.

## Actions
1. pure.ts: insert the marker import.
2. server.ts: insert the marker import.
3. heatmap.ts: insert the marker import.

## Done when
- All 3 files start with the marker; heatmap-engine untouched; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-15.md (<=10 lines); TL alone updates TRACKER.md.
