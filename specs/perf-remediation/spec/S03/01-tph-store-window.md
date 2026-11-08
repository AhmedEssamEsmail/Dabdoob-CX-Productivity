# S03-01: tphLoadStore_ reads a bounded date window on the service client
Kind: mini
ID: S03-01
Parent: S03
Owner: dev
Depends: S02-01
Criteria: PLAN #3 (tphLoadStore_ 8-table full reads -> filtered)
Skills: none
Budget: files=3; actions=5; changed_lines=80; minutes=8

## Goal
`tphLoadStore_` stops reading the five `prod_tph_*` tables in full and stops
using the anon-key auth client for table reads. It accepts an optional
`dateParam`, computes a lower bound `lo`, and issues `.gte('date', lo)` via
`db()`; the two date-aware routes pass their param through.

## Files
- Edit: `src/features/cx-productivity/lib/tph/page.ts` | `tphLoadStore_` (129-175): signature + filtered db() reads
- Edit: `src/app/api/tph/page/route.ts` | pass `searchParams.get('date')` into tphLoadStore_
- Edit: `src/app/api/tph/trend/route.ts` | pass `searchParams.get('from')` into tphLoadStore_

## Context
- `src/features/cx-productivity/lib/tph/page.ts:129-141` | the 8 Promise.all reads to convert (config, roster, 5x prod_tph_*, refresh_log)
- `src/features/cx-productivity/lib/tph/page.ts:267,278-288,339-365` | consumers: day rows need `date===d`; `tphEligible_` needs touches for `tph_eligible_days` (28); `getTphTrend` needs up to `TPH_TREND_MAX_DAYS`; tasks need `date===d`
- `src/features/shared/platform/repo.ts:24-26` | `db()` — the table-read client to use (service-role after S08-01)
- `src/features/shared/platform/stores.ts:27-40` | exists/storeErrors convention to preserve (mark() per table)

## Contract
- New signature: `tphLoadStore_(dateParam?: string | null)`. Return type `TphStore` unchanged.
- `lo = min(validDateParam || today, dqAddDays_(today, -max(tph_eligible_days||28, TPH_TREND_MAX_DAYS)))` — an invalid/absent param yields the default window.
- prod_tph_days/cases/touches/calls/tasks: `.select('*').gte('date', lo)` (keep the existing per-table row limits). refresh_log tail and config/roster reads unchanged in shape but run on `db()`.
- `createAuthClient` import removed from page.ts; `storeErrors`/`mark()` semantics unchanged.
- TphStore consumers (getTphPage/getTphTrend) unchanged.
Out of scope: the other six tph routes (S03-02), write.ts/run.ts client swap (S08-02), env.ts.

## Actions
1. page.ts: change `tphLoadStore_` signature and compute `lo` per the contract.
2. page.ts: swap all eight reads to `db()` with `.gte('date', lo)` on the five prod_tph_* selects; drop the createAuthClient import.
3. api/tph/page route: pass `searchParams.get('date')`.
4. api/tph/trend route: pass `searchParams.get('from')`.
5. Self-check every TphStore field still feeds its consumers (eligible/trend windows covered by `lo`).

## Done when
- No `select('*')` on a prod_tph_* table lacks `.gte('date', lo)`; no `createAuthClient` remains in page.ts.
- `npx tsc --noEmit` clean; `npx vitest run tests/golden/tph.test.ts` green.

## Verify
- Run: `npx vitest run tests/golden/tph.test.ts` -> all pass.

## Handoff
`tphLoadStore_(dateParam?)` is the contract S03-02 threads through the six
remaining routes. Write results/S03-01.md (<=10 lines); TL alone updates TRACKER.md.
