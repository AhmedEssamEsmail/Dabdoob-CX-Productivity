# prod analytics projected columns (S06-01 / P-02)

Derived by grepping `r.<col>` / `row.<col>` reads in
`src/features/cx-productivity/lib/prod/analytics.ts` (`prodAnalytics_`),
`engine.ts` (`prodAnalyticsFor_`, `prodScope_`, `prodIntervalOf_`) and
`prod-validation.ts` (`effectiveStatus` via `prodEffectiveStatus_`).

- `prod_intervals`: `date, agent_email, agent_name, status, start_at, end_at, minutes`
  (`prodIntervalOf_` engine.ts:184-190; `date`/`agent_email` also feed the
  `inRange`/`scope` filters in `prodAnalyticsFor_` engine.ts:750-753).
- `prod_flags`: `agent_email, date, decision, tl_email, decided_at, created_at,
  review_open_ms, validated_status, suggested_status, raw_status, spans_json,
  interval_start` (analytics.ts:90-215; `effectiveStatus` reads
  decision/validated_status/suggested_status; `movedSpans` reads spans_json +
  raw_status + interval_start).
- `prod_daily_layers`: `date, email, layer, "productiveMinResolution",
  "productiveMinAux"` (analytics.ts:146-150; camelCase columns are quoted
  identifiers per 20261031193219_domain_tables.sql:36-49).
- `prod_window_hist`: `date, class, counts_json`
  (analytics.ts:290-304). Bound: `date >= week-21 AND date <= week+6` — the
  `[from, to]` window `prodAnalyticsFor_` computes (engine.ts:746-749); the
  calibration loop intends `r.date >= from` (the `from` ReferenceError is a
  preserved verbatim bug, analytics.ts:291-295). Only fetched for admins
  (`full`).

All four reads go through `readAllPaged` (PK-ordered `.range` paging, no
50k/20k caps). Expected indexes for the perf-gate EXPLAIN pass:
`idx_prod_intervals_date`, `idx_prod_daily_layers_date`,
`prod_window_hist.date` (no index seen in migrations — flag if EXPLAIN seq-scans).
