# S02-01: copy grid-slots into cx-productivity + repoint consumers
Kind: mini
ID: S02-01
Parent: S02
Owner: dev
Depends: none
Criteria: PLAN #2
Skills: none
Budget: files=3; actions=2; changed_lines=125; minutes=10

## Goal
`grid-slots.ts` exists at its owning feature path with identical contents and
exports; the two consumers already import the new path. Old file still exists
(S02-02 deletes it — intermediate duplicate compiles because nothing conflicts).

## Files
- Create: `src/features/cx-productivity/lib/tph/grid-slots.ts` | verbatim copy of `shared/jobs/grid-slots.ts` (all 112 lines, doc header included)
- Edit: `src/features/cx-productivity/jobs/backfill.ts` | import line 24
- Edit: `tests/jobs/grid-slots.test.ts` | import line 8

## Context
- `src/features/shared/jobs/grid-slots.ts` | the file to copy verbatim
- `src/features/cx-productivity/jobs/backfill.ts:24` | `from '@/features/shared/jobs/grid-slots'`
- `tests/jobs/grid-slots.test.ts:8` | same specifier

## Contract
Absolute `@/` imports inside the copied file stay unchanged
(`cx-productivity/lib/prod/engine`, `cx-productivity/lib/tph/page`,
`shared/lib/adapters`). All exports identical: `gridStatusChannel_`,
`tphGridFromIntervals_`, `IntervalRow`, `DerivedDay`. No `import 'server-only'`
in this leaf (S03-30 adds it).
Out of scope: deleting the old file (S02-02); env.ts/mirrors.ts moves (forbidden — composition layer).

## Actions
1. Create the new file as a verbatim copy (do not rename/reorder anything).
2. Repoint the two consumer imports to `@/features/cx-productivity/lib/tph/grid-slots`.

## Done when
- New file exists with identical exports; both consumers compile against it.

## Verify
- Run: `npx vitest run tests/jobs/grid-slots.test.ts` -> all tests pass

## Handoff
New canonical path `@/features/cx-productivity/lib/tph/grid-slots`; S02-02 deletes
the old file; S03-30 marks the new one `server-only`.
Write results/S02-01.md (<=10 lines); TL alone updates TRACKER.md.
