# perf3-05 — sc_daily month index (perf-10)

Status: DONE (no-op, satisfied-by-existing)
Index: `sc_daily_month_date_email_key` — unique btree on (month, date, email), leftmost `month`, auto-created by `UNIQUE (month, date, email)` at supabase/migrations/20261105172248_people.sql:315. Fully serves `eq('month')` reads/deletes (scorecard-server.ts:454,541); a dedicated idx_sc_daily_month would be redundant — none created.
Evidence source: migration files (no MCP remote access). Reconcile 20261106151132 only renames legacy agent_email-shaped sc_daily aside; drop migration 20261116175742 drops only sc_daily_legacy_pre008 — constraint intact on the live shape.
Remote writes: none. Files changed: this results file only.
Checks: `ls supabase/migrations | tail -3` — no new file (expected; no-op justified above).
