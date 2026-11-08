# S02-05: quarterly.ts prefetches prod_flag_analytics
Kind: mini
ID: S02-05
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #2 (per-job table list — quarterly report)
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=4

## Goal
`src/features/cx-productivity/jobs/quarterly.ts` prefetches
`prod_flag_analytics` before its `env.prodRows('prod_flag_analytics')` read
(:34) — the only prod table the quarterly job consumes.

## Files
- Edit: `src/features/cx-productivity/jobs/quarterly.ts` | add one prefetch call before the :34 read (inside the job fn, before/at step start)

## Context
- `src/features/cx-productivity/jobs/quarterly.ts:34` | the prodRows read
- `src/features/shared/jobs/env.ts:474-488` | prefetchTables seam

## Contract
- `await env.prefetchTables(['prod_flag_analytics'])` precedes the read.
- The `prod_quarterly_reports` write stays a queued upsert (no preload needed — prodRows is never called on it).
Out of scope: env.ts, the cron route, other job files.

## Actions
1. Insert the prefetch call before the first prodRows use.
2. Confirm no other prodRows/cachedLive call exists in the file (grep evidence in results).

## Done when
- `prod_flag_analytics` is prefetched before read; no unfetched prodRows remains.
- `npx tsc --noEmit` clean; `npx vitest run tests/jobs/quarterly.test.ts` green.

## Verify
- Run: `npx vitest run tests/jobs/quarterly.test.ts` -> all pass.

## Handoff
None. Write results/S02-05.md (<=10 lines); TL alone updates TRACKER.md.
