# S07: Dedupe, unique constraints, and query indexes
Kind: package
ID: S07
Dispatch: NEVER

## Goal and contract
PLAN criterion #7: migration FILES (remote apply needs explicit user
approval — PLAN conventions) that (a) dedupe then add the missing unique
constraints the app's upsert keys assume — `prod_daily_layers(date,email,
layer)` (env.ts:355) and `queue_submissions(slot_date,slot)` (one
submission per slot-day, pages.ts:215-222; `submission_id` unique already
exists via 014) — and (b) create the audit-listed b-tree indexes:
prod_intervals(date), refresh_log(job,finished_at), tickets(status),
tickets(group_name), tickets(created_at), prod_flags(date),
prod_flags(agent_email), prod_daily_layers(date), roster(lower(email)),
agg_inflow_hourly(year,date), queue_submissions(slot_date). All DDL
idempotent (`IF NOT EXISTS`, `CONCURRENTLY` where the expert's skill
requires). Intent stated here; `supabase-expert` writes the SQL.
Non-goals: applying remotely, schema redesign, backfills beyond the dedupe.

## Children
Index: `S07/00-index.md`
- dedupe + 2 uniques: S07-01 | index group A (prod/roster/agg): S07-02 |
  index group B (tickets/refresh_log/queue_submissions): S07-03 — migration
  catalog shared, all three strictly serial.

## Completion
Three migration files exist, idempotent, verified `supabase migration lint`
or equivalent local check the expert's skill provides.
