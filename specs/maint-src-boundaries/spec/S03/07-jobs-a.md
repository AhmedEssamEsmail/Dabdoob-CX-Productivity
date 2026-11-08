# S03-07: mark shared/jobs {csv,env,freshdesk} + env composition note
Kind: mini
ID: S03-07
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3 (+#2 composition direction)
Skills: none
Budget: files=3; actions=3; changed_lines=9; minutes=8

## Goal
`import 'server-only'` marks csv.ts, env.ts, freshdesk.ts; env.ts also gains the
one-line composition-layer note (PLAN #2: intentional shared→cx-productivity edge).

## Files
- Edit: `src/features/shared/jobs/csv.ts` | first statement
- Edit: `src/features/shared/jobs/env.ts` | marker + header comment line
- Edit: `src/features/shared/jobs/freshdesk.ts` | first statement

## Context
- `src/features/shared/jobs/env.ts:1-27` | doc header; append a line to it:
  `* Composition layer: this file intentionally imports pure cx-productivity`
  `* engines (prod engine/validation, tph) and wires them to storage/mail —`
  `* the only sanctioned shared -> feature edge (docs/ARCHITECTURE.md).`
- `src/features/shared/jobs/env.ts:41-43` | the cx-productivity imports it documents

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
In env.ts also extend the top doc-comment with the 3 composition lines above.
Out of scope: grid-slots (moved to cx-productivity by S02), every other file.

## Actions
1. csv.ts + freshdesk.ts: insert the marker import.
2. env.ts: insert the marker import.
3. env.ts: add the 3-line composition note inside the top doc-comment.

## Done when
- All 3 files marked; env header documents the composition edge; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
env.ts records its intentional shared→feature edge (S07-01 exempts it in eslint).
Write results/S03-07.md (<=10 lines); TL alone updates TRACKER.md.
