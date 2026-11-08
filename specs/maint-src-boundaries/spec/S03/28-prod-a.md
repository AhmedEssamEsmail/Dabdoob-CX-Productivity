# S03-28: mark cx-productivity/lib {prod/engine,prod/validation,tph/index}
Kind: mini
ID: S03-28
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks prod/engine.ts, prod/validation.ts, tph/index.ts.

## Files
- Edit: `src/features/cx-productivity/lib/prod/engine.ts` | first statement
- Edit: `src/features/cx-productivity/lib/prod/validation.ts` | first statement
- Edit: `src/features/cx-productivity/lib/tph/index.ts` | first statement

## Context
- `src/features/cx-productivity/lib/prod-validation.ts` | CLIENT-reachable (pv-shared + moved pages) — do NOT confuse with prod/validation.ts (this leaf marks it)
- `src/features/shared/jobs/env.ts:41-43` | composition consumer of these engines

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: prod-validation.ts (client), prod-validation.test.ts, every other file.

## Actions
1. prod/engine.ts: insert the marker import.
2. prod/validation.ts: insert the marker import.
3. tph/index.ts: insert the marker import.

## Done when
- All 3 files start with the marker; prod-validation.ts untouched; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-28.md (<=10 lines); TL alone updates TRACKER.md.
