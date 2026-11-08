# S03-08: mark shared/jobs {mirrors,sheets,steps} + mirrors composition note
Kind: mini
ID: S03-08
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3 (+#2 composition direction)
Skills: none
Budget: files=3; actions=3; changed_lines=9; minutes=8

## Goal
`import 'server-only'` marks mirrors.ts, sheets.ts, steps.ts; mirrors.ts also
gains the one-line composition-layer note (second sanctioned shared→feature edge).

## Files
- Edit: `src/features/shared/jobs/mirrors.ts` | marker + header comment line
- Edit: `src/features/shared/jobs/sheets.ts` | first statement
- Edit: `src/features/shared/jobs/steps.ts` | first statement

## Context
- `src/features/shared/jobs/mirrors.ts:1-18` | doc header; append:
  `* Composition layer: intentionally imports pure cx-productivity engines`
  `* (prodToday_, tphClock_) to sync mirror tables — sanctioned shared -> feature`
  `* edge alongside jobs/env.ts (docs/ARCHITECTURE.md).`
- `src/features/shared/jobs/mirrors.ts:22-23` | the cx-productivity imports it documents

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
In mirrors.ts also extend the top doc-comment with the 3 composition lines above.
Out of scope: every other file.

## Actions
1. sheets.ts + steps.ts: insert the marker import.
2. mirrors.ts: insert the marker import.
3. mirrors.ts: add the 3-line composition note inside the top doc-comment.

## Done when
- All 3 files marked; mirrors header documents the composition edge; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
mirrors.ts records its intentional shared→feature edge (S07-01 exempts it in eslint).
Write results/S03-08.md (<=10 lines); TL alone updates TRACKER.md.
