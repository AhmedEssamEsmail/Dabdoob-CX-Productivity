# S02: grid-slots moves into cx-productivity
Kind: package
ID: S02
Dispatch: NEVER

## Goal and contract
`src/features/shared/jobs/grid-slots.ts` relocates verbatim to
`src/features/cx-productivity/lib/tph/grid-slots.ts` (beside the tph engine it
derives from). Exported names unchanged (`gridStatusChannel_`,
`tphGridFromIntervals_`, `IntervalRow`, `DerivedDay`). Only consumers —
`cx-productivity/jobs/backfill.ts` and `tests/jobs/grid-slots.test.ts` — repoint.
`env.ts`/`mirrors.ts` stay in `shared/jobs` (composition layer, documented in S07).

## Children
Index: `S02/00-index.md`
- #2 -> S02-01 (create copy + repoint 2 consumers), S02-02 (delete old file)

## Completion
No `shared/jobs/grid-slots` import remains anywhere; vitest grid-slots suite green.
