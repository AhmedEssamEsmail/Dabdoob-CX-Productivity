# layers-scan-01 — remote column evidence for prod analytics projections

Status: DONE. `docs/perf/prod-analytics-cols.md` written — all 4 tables' actual remote column lists recorded.
Method: SELECT-only `BEGIN READ ONLY` via direct-pg pooler (`information_schema.columns`); no DDL/DML — same approved class as pk-scan-01.
Verdict: only `prod_daily_layers` projection broken — `"productiveMinResolution"`/`"productiveMinAux"` don't exist remotely; actual cols `productive_min_resolution`/`productive_min_aux` (matches env.ts:90-91 write map).
Fix for layers-fix-01: alias form `"productiveMinResolution":productive_min_resolution,"productiveMinAux":productive_min_aux`; other 3 projections verified fully present.
No residual `.order('id')` 500 risk: prod_intervals/prod_flags have PK_OVERRIDES; prod_daily_layers/prod_window_hist have real `id`.
Checks: `grep -c "prod_" docs/perf/prod-analytics-cols.md` → 15 (4 tables with column lists). Handoff: layers-fix-01 consumes verdicts.
