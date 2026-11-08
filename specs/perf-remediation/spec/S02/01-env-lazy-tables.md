# S02-01: buildJobEnv stops preloading 12 prod tables; prefetch is the only loader
Kind: mini
ID: S02-01
Parent: S02
Owner: dev
Depends: none
Criteria: PLAN #2 (buildJobEnv lazy loads)
Skills: none
Budget: files=1; actions=4; changed_lines=120; minutes=8

## Goal
`src/features/shared/jobs/env.ts` loads zero prod tables at build time.
Tables enter the run memo only via `opts.tables` and `env.prefetchTables()`;
`prod_intervals` keeps its `intervalBound` (today-45d) window inside
`prefetchTables`; `opts.roster === false` skips the roster read entirely.

## Files
- Edit: `src/features/shared/jobs/env.ts` | `PROD_TABLES`/`wanted` preload (265-290), `prefetchTables` (474-488), `prodRows`/`cachedLive` miss handling (346-350, 463-465), `BuildJobEnvOptions` (244-258), JSDoc header (1-31)

## Context
- `src/features/shared/jobs/env.ts:229-290` | PROD_TABLES list + eager Promise.all preload to remove
- `src/features/shared/jobs/env.ts:474-499` | prefetchTables + ensureIntervals (intervalBound var, :275)
- `src/features/shared/jobs/env.ts:265-271` | roster/config build to gate behind opts.roster
- `src/features/shared/jobs/env.ts:155-227` | JobEnv interface (sync prodRows contract — stays sync)
- `tests/jobs/helpers.ts` | test env fake — if it mimics the eager preload, update it so job tests still pass

## Contract
- `buildJobEnv(opts)` issues NO `db().from(<prod table>)` reads; only config (`configAll`) and, unless `opts.roster === false`, `readRows('roster')`.
- `BuildJobEnvOptions` gains `roster?: boolean` (default true). When false: `dir` = `pwDirectory_([], cfg.admin_emails)`, `roster` = null, `headcount` = [] (`ensureHeadcount` month-book fallback unchanged).
- `prefetchTables('prod_intervals')` applies `.gte('date', intervalBound)`; other names keep `select('*').limit(200000)`. MissingOk semantics preserved (error -> [] + tableErrors).
- `prodRows(name)`/`cachedLive(name)` on a table never loaded: return [] and set `tableErrors[name] = 'not prefetched'` (once per name). Loaded-empty still returns [] with no error.
- All other seams (ops queue, flushWrites, workbooks, activityRows, markDirty) unchanged.
Out of scope: every job fn file (S02-02..05), routes, engine pure fns.

## Actions
1. Delete the `PROD_TABLES`-based eager preload; preload only `opts.tables` (keep tableErrors capture).
2. Add `roster?: boolean` to BuildJobEnvOptions and gate the `readRows('roster')` call on it.
3. In `prefetchTables`, apply the `intervalBound` `gte('date', ...)` when `name === 'prod_intervals'`.
4. In `prodRows` and `cachedLive`, record `tableErrors[name] = 'not prefetched'` when `tables[name]` was never fetched; update the file header JSDoc + JobEnv docs to describe the lazy contract.

## Done when
- No `Promise.all(wanted.map(...))` preload of PROD_TABLES remains.
- `opts.roster === false` produces an env with empty dir/headcount and zero roster read.
- `prodRows('prod_flags')` on an env that never prefetched it yields [] plus `tableErrors.prod_flags`.
- `npx tsc --noEmit` clean; `npx vitest run tests/jobs` green.

## Verify
- Run: `npx vitest run tests/jobs` -> all pass.

## Handoff
Downstream S02-02..05 add `prefetchTables` lists inside job fns; S02-06 audits
remaining buildJobEnv callers. Write results/S02-01.md (<=10 lines); TL alone updates TRACKER.md.
