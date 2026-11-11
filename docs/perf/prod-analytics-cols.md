# prod analytics remote column evidence (layers-scan-01)

Source: SELECT-only remote introspection, `BEGIN READ ONLY` tx via direct-pg pooler
(`aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.uugeyulccyytvgcabzzx`,
`migration/.env.db` password) — same approved class as pk-scan-01/S01-01. No DDL/DML.
Query: `information_schema.columns` (schema `public`), ordinal order.

## Actual remote columns

### prod_intervals (no `id`; PK `interval_key` — PK_OVERRIDES repo.ts:179)
`interval_key, date, agent_email, agent_name, status, source_status, start_at, end_at, minutes, source, snapshot_at, created_at`

Projection `route.ts:58` `date,agent_email,agent_name,status,start_at,end_at,minutes` → **all exist**. No change needed.

### prod_flags (no `id`; PK `flag_id` — PK_OVERRIDES repo.ts:146)
`flag_id, date, agent_email, agent_name, tl_email, raw_status, interval_start, interval_end, interval_min, spans_json, flagged_min, case_count, distinct_cases, case_ids_json, channel_mix_json, suggested_status, decision, validated_status, decided_by, decided_at, reason, review_open_ms, due_date, created_at, rule_json, updated_at, confidence_score, confidence_level, confidence_factors_json`

Projection `route.ts:62-63` `agent_email,date,decision,tl_email,decided_at,created_at,review_open_ms,validated_status,suggested_status,raw_status,spans_json,interval_start` → **all exist**. No change needed.

### prod_daily_layers (has `id` bigint — default pk path OK)
`id, layer, agent_name, date, email, inbound_avail_min, inbound_target, inbound_achieved, inbound_missed, inbound_prod_pct, inbound_gap, texting_avail_min, texting_target, texting_achieved, texting_prod_pct, texting_gap, wa_avail_min, wa_target, wa_achieved, wa_prod_pct, wa_gap, overall_prod_pct, total_audits, avg_score, productive_min_aux, productive_min_resolution, idle_min, computed_at`

Projection `route.ts:67` `date,email,layer,"productiveMinResolution","productiveMinAux"`:

| Projected | Remote | Verdict | Fix |
|---|---|---|---|
| `date` | `date` (text) | exists | — |
| `email` | `email` | exists | — |
| `layer` | `layer` | exists | — |
| `"productiveMinResolution"` | `productive_min_resolution` | **missing** — causes the live 500 | alias `"productiveMinResolution":productive_min_resolution` |
| `"productiveMinAux"` | `productive_min_aux` | **missing** | alias `"productiveMinAux":productive_min_aux` |

Matches the write-path map `env.ts:90-91` (`productiveMinAux`→`productive_min_aux`,
`productiveMinResolution`→`productive_min_resolution`). Engine reads camelCase keys
(`analytics.ts:149-150`) → PostgREST alias keeps row keys unchanged.

### prod_window_hist (has `id` integer — default pk path OK)
`id, date, class, windows, counts_json, computed_at`

Projection `route.ts:72` `date,class,counts_json` → **all exist**. No change needed.

## Verdicts for layers-fix-01

- Only `prod_daily_layers` projection is broken — the 20261031 domain migration created
  quoted camelCase cols in dev, but remote is snake_case (write path agrees).
- Recommended replacement select:
  `date,email,layer,"productiveMinResolution":productive_min_resolution,"productiveMinAux":productive_min_aux`
- All other projected columns verified present; no other aliases needed.
- No residual `.order('id')` 500 risk: prod_intervals/prod_flags covered by
  PK_OVERRIDES; prod_daily_layers/prod_window_hist have real `id` columns.
