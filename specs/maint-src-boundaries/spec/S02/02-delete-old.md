# S02-02: delete the old shared/jobs/grid-slots.ts
Kind: mini
ID: S02-02
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #2
Skills: none
Budget: files=1; actions=1; changed_lines=112; minutes=5

## Goal
`src/features/shared/jobs/grid-slots.ts` is gone; nothing references it.

## Files
- Delete: `src/features/shared/jobs/grid-slots.ts` | whole file

## Context
- `src/features/cx-productivity/lib/tph/grid-slots.ts` | the replacement (S02-01)

## Contract
Delete the file only. Before deleting, confirm zero remaining references:
`grep -rn "shared/jobs/grid-slots" src tests` -> no matches. If a match exists,
stop and report — do not repoint it in this leaf.
Out of scope: env.ts/mirrors.ts (they stay — composition layer).

## Actions
1. Verify no references, then delete the file.

## Done when
- File deleted; `grep -rn "jobs/grid-slots" src tests` matches only the cx-productivity path; tsc clean.

## Verify
- Run: `npx vitest run tests/jobs/grid-slots.test.ts` -> pass; `npx tsc --noEmit` -> clean

## Handoff
`shared/jobs` now contains only the composition files env/mirrors (+csv/sheets/
steps/freshdesk/vendor-apis); the eslint guard (S07-01) may land.
Write results/S02-02.md (<=10 lines); TL alone updates TRACKER.md.
