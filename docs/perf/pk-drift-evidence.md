# pk-drift evidence — remote PK/unique scan (pk-scan-01)

Source: SELECT-only remote introspection, 2026-11 (session date). Method: `BEGIN READ ONLY` tx via pooler
(`aws-1-eu-central-1.pooler.supabase.com`, user `postgres.uugeyulccyytvgcabzzx`) — same approved class as
S01-01. Target verified: `dabdoob-cx-productivity (uugeyulccyytvgcabzzx) · production`.
NOTE: `npx supabase db query --remote --read-only` now 403s (Management-API privilege on saved login);
direct-pg SELECT via `migration/.env.db` password used instead — no DDL, no DML, no writes.

Queries: `information_schema.tables`/`columns`, `pg_index`+`pg_class` (`pg_get_indexdef`), `pg_class.reltuples`.

## Verdicts (one row per escalated table)

| Table | Exists | `id` col | Real PK | Other UNIQUE | Verdict | App reads (grep) |
|---|---|---|---|---|---|---|
| prod_intervals | yes | NO | `interval_key` (text NN) | idx `date`, idx `(date,agent_email)` | **pk=`interval_key`** | `readAllPaged` env.ts:527, api/prod/analytics:57 (live 500); `.from` flags/intervals/my-page routes |
| prod_flag_log | yes | NO | `log_id` (text NN) | idx `flag_id` (non-uniq) | **pk=`log_id`** | `.from` inserts decide/route.ts:129; reads via helpers possible |
| prod_flag_analytics | yes | NO | `(date, agent_email)` | idx `date` (non-uniq) | **pk=`[date,agent_email]`** | none matched in src/ reads |
| fcr_daily | yes | NO | `(date, agent_email)` | — | **pk=`[date,agent_email]`** | `readStore` cx-people/kpi/server.ts:87; `.from` api/fcr/daily |
| fcr_weekly | yes | NO | `(week, agent_email)` | — | **pk=`[week,agent_email]`** | aggregates.ts (name refs) |
| fcr_monthly | yes | NO | `(month, agent_email)` | — | **pk=`[month,agent_email]`** | aggregates.ts (name refs) |
| qa_forms | yes | YES bigint | `id` | `(form_id,version)` uniq | **pk=`id` — default OK, no override** | `qaRows_('qa_forms')` x13 cx-quality/lib/server.ts |
| freshchat | yes | YES bigint | `id` | `dedupe_key` uniq; idx `ts_ms` | **pk=`id` — default OK** | `readStore` cx-queue/lib/jobs.ts:132; `.from` run.ts:170 |
| fd_activities | yes | YES bigint | `id` | `dedupe_key` uniq; idx `ts_ms` | **pk=`id` — default OK** | `.from` tph/touches:30, tlqueue:620, engine-live:174, run.ts:48 |
| maqsam_calls | yes | YES bigint | `id` | `dedupe_key` uniq; idx `ts_ms` | **pk=`id` — default OK** | `.from` jobs.ts:181, run.ts:114, tlqueue:611 |
| queue_status_submissions | **ABSENT** | — | — | — | **absent — probable rename → `queue_submissions`** (pk `id`; uniq `submission_id`; uniq `(slot_date,slot)`) | `readStore('queue_status_submissions')` cx-people/one-on-ones-page.ts:578 hits a non-existent table |

## Notes for pk-apply-01

- **needs-ALTER: none.** Every existing escalated table has a usable unique key; 6 need `PK_OVERRIDES`
  entries (4 composite via string[]), 4 are already covered by the default `id` path.
- `prod_intervals.interval_key` IS the remote pkey — pk-drift-01's "not provably unique" resolved.
- `queue_status_submissions` is a stale table NAME in app code (legacy). Any `.order()` on it errors
  regardless of pk — PostgREST 404, not an ordering regression. Decide: rename call site to
  `queue_submissions` or remove the dead read (needs PM/user call; out of pk-apply-01's override scope).
- `dqReadTail` (stores.ts, hardcoded `.order('id')`): safe on the `id`-keyed tables above
  (freshchat/fd_activities/maqsam_calls/qa_forms), but must resolve via PK_OVERRIDES if it can be called
  on `prod_intervals`/`prod_flag_log`/`prod_flag_analytics`/`fcr_*`.
- Row estimates: fd_activities ~632k, maqsam_calls ~111k, prod_intervals ~23k, prod_flag_log ~1.8k,
  freshchat ~1.7k, prod_flag_analytics ~219; fcr_*/qa_forms unanalyzed (reltuples=-1).
- Tables expected to still 500 under readAllPaged until overrides land: `prod_intervals` (confirmed live),
  `prod_flag_log`, `prod_flag_analytics`, `fcr_daily`, `fcr_weekly`, `fcr_monthly` — IF paged reads reach
  them. `qa_forms`/`freshchat`/`fd_activities`/`maqsam_calls` cannot 500 on `.order('id')` (id exists).
