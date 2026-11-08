# S02-04: backfill.ts declares its prod table union at buildJobEnv
Kind: mini
ID: S02-04
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #2 (per-job table list — admin backfill)
Skills: none
Budget: files=1; actions=3; changed_lines=30; minutes=5

## Goal
`src/features/cx-productivity/jobs/backfill.ts` passes the union of prod
tables it reads via `buildJobEnv({ tables: [...] })` (it builds its own env
at :102) — no table arrives via the removed eager preload.

## Files
- Edit: `src/features/cx-productivity/jobs/backfill.ts` | the `buildJobEnv({...})` call (~:102) and/or a `prefetchTables` beside the existing one at :147

## Context
- `src/features/cx-productivity/jobs/backfill.ts:81-86,163-169,257` | tables read via env.prodRows: prod_tph_touches, prod_tph_calls, prod_tph_cases, prod_tph_days (existing-check :169), prod_daily_layers, prod_flags, prod_intervals
- `src/features/shared/jobs/env.ts:244-258` | BuildJobEnvOptions.tables (preload at build) vs prefetchTables (on demand)

## Contract
- The env is built with `tables: ['prod_tph_touches','prod_tph_calls','prod_tph_cases','prod_tph_days','prod_tph_tasks','prod_daily_layers','prod_flags','prod_intervals']` — trimmed to exactly the names the file reads (verify with grep; prod_intervals loads with the intervalBound window via S02-01).
- Keep the existing `prefetchTables(['tickets','agg_inflow_hourly'])` at :147.
- Backfill is an admin/manual path: a single union preload at build is acceptable and simplest.
Out of scope: env.ts, any other job file, route files.

## Actions
1. Add the union `tables` list to the `buildJobEnv({...})` options (or an equivalent prefetchTables call before the first prodRows read).
2. Verify each listed name is actually read (grep evidence in results).
3. Confirm `prod_tph_tasks` inclusion/exclusion by greping `prod_tph_tasks` in the file; keep the list minimal.

## Done when
- Every `prodRows('<name>')` in backfill.ts is covered by the declared list.
- `npx tsc --noEmit` clean; `npx vitest run tests/jobs/backfill.test.ts` green.

## Verify
- Run: `npx vitest run tests/jobs/backfill.test.ts` -> all pass.

## Handoff
None. Write results/S02-04.md (<=10 lines); TL alone updates TRACKER.md.
