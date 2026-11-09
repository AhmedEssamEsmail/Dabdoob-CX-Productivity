# FIX-17: Default bound on prod_intervals + prod_daily_layers GET routes (perf-3)
Kind: mini
ID: FIX-17
Parent: -
Owner: dev
Depends: none
Criteria: perf-1 finding perf-3 (LOW, blocking per PM): zero-param `select('*')` ships whole tables (prod_intervals ~23k/12MB)
Skills: none
Budget: files=2; actions=3; changed_lines=25; minutes=5

## Goal
Both admin/TL GET routes stop returning entire tables when called without a
`date` filter: a default recent-date window plus a hard row cap.

## Files
- Edit: `src/app/api/prod/intervals/route.ts` | the query builder block only
- Edit: `src/app/api/prod/daily-layers/route.ts` | the query builder block only

## Context
- `src/app/api/prod/intervals/route.ts:6-26` | current: optional `date`/`agent_email` eq filters, then unbounded `.order('start_at')`
- `src/app/api/prod/daily-layers/route.ts:6-30` | same shape (`date`/`agent_email`/`layer`, `.order('date', desc)`)
- `specs/perf-remediation/reports/perf-1.md` (finding perf-3) | reviewer fix: default date window (e.g. last 31d) or hard `.limit(5000)` when no params

## Contract
- In each route: when the `date` search param is absent, apply `.gte('date', <ISO date 31 days ago>)` (compute once in the handler, `new Date(Date.now() - 31*864e5).toISOString().slice(0,10)` or existing date helper if already imported — do not add imports beyond that).
- Always apply `.limit(5000)` as a backstop (after the filters, before/with `.order`).
- All existing param filters, ordering, auth and error handling unchanged.
Out of scope: other prod routes, pagination/response-shape changes, indexes.

## Actions
1. Add the 31-day `date` gte (no `date` param) + `.limit(5000)` in intervals route.
2. Same in daily-layers route.
3. Typecheck + lint the two files.

## Done when
- Zero-param calls are bounded by date>=31d AND limit 5000 in both routes.
- Param-filtered calls keep working identically (limit backstop aside).
- `npx tsc --noEmit` clean; eslint on the 2 files reports 0 new issues.

## Verify
- Run: `npx tsc --noEmit` -> 0 errors; `npx eslint src/app/api/prod/intervals/route.ts src/app/api/prod/daily-layers/route.ts` -> 0 errors.

## Handoff
None.
Write results/FIX-17.md (<=10 lines); TL alone updates TRACKER.md.
