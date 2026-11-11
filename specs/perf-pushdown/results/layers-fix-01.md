# layers-fix-01

Status: DONE. `/api/prod/analytics` projection fix applied per prod-analytics-cols.md.

Files:
- Edit: src/app/api/prod/analytics/route.ts (:66-69) — prod_daily_layers columns now `date,email,layer,"productiveMinResolution":productive_min_resolution,"productiveMinAux":productive_min_aux`
- No change to tests/perf/prod-analytics.test.ts (fake returns fixture rows; does not validate column strings).
- Other 3 projections verified OK — untouched.

Checks:
- `npx vitest run tests/perf/prod-analytics.test.ts` -> 4/4 pass
- `npx tsc --noEmit` -> 0 errors

Handoff: endpoint 500 root cause fixed; row keys stay camelCase via PostgREST aliases.
