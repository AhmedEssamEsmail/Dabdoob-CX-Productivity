# S02-02: productivity.ts step fns prefetch the prod tables they read
Kind: mini
ID: S02-02
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #2 (per-job table list for the prod daily chain)
Skills: none
Budget: files=1; actions=4; changed_lines=40; minutes=6

## Goal
Every exported step/job fn in `src/features/cx-productivity/jobs/productivity.ts`
prefetches exactly the prod tables its code path reads, before the first
`prodRows`/`cachedLive` call — the env no longer preloads anything.

## Files
- Edit: `src/features/cx-productivity/jobs/productivity.ts` | add `await env.prefetchTables([...])` inside `prodFlagsStep_`, `prodComputeStep_`, `prodFlagAnalyticsStep_`, and the daily job fn around :291

## Context
- `src/features/shared/jobs/env.ts:474-488` | prefetchTables seam (post-S02-01; prod_intervals gets the windowed read automatically)
- `src/features/cx-productivity/jobs/productivity.ts:88-94,198,247,291` | env.headcount/prodRows/ensureIntervals/existing prefetch call sites
- `src/features/cx-productivity/lib/prod/engine.ts:751-765,807-826,962` | engine reads: prod_intervals, prod_flags, prod_daily_layers, prod_window_hist (full only)
- `src/features/cx-productivity/jobs/quarterly.ts:34` | which table prodFlagAnalyticsStep_-style reads use (prod_flags -> prod_flag_analytics)

## Contract
- `prodFlagsStep_`: prefetch `['prod_intervals','prod_flags']` before stepping.
- `prodComputeStep_`: prefetch `['prod_intervals','prod_flags','prod_daily_layers','prod_window_hist']`.
- `prodFlagAnalyticsStep_`: prefetch `['prod_flags','prod_flag_analytics']`.
- The daily job fn's existing `prefetchTables(['tickets','agg_inflow_hourly'])` (:291) stays; if any step it invokes reads another prod table directly (grep `prodRows(` inside the file, ~:198), add that name to the same call.
- `env.ensureIntervals(dates)` call (:247) stays as-is.
Out of scope: env.ts, tph/backfill job fns, routes, engine internals.

## Actions
1. Add the prefetch call at the top of `prodFlagsStep_`.
2. Add the prefetch call at the top of `prodComputeStep_`.
3. Add the prefetch call at the top of `prodFlagAnalyticsStep_`.
4. Extend the :291 `prefetchTables` list with any prod_* table name read directly by that fn (grep evidence in results).

## Done when
- Grep `prodRows\(|cachedLive\(` inside productivity.ts shows every named table covered by a preceding prefetchTables call in the same fn.
- `npx tsc --noEmit` clean; `npx vitest run tests/golden/productivity.test.ts tests/jobs/productivity-snapshot.test.ts` green.

## Verify
- Run: `npx vitest run tests/golden/productivity.test.ts tests/jobs/productivity-snapshot.test.ts` -> all pass.

## Handoff
None beyond results. Write results/S02-02.md (<=10 lines); TL alone updates TRACKER.md.
