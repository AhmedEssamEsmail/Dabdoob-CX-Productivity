# S07-02: Lookup indexes — prod_*, roster, agg_inflow_hourly
Kind: mini
ID: S07-02
Parent: S07
Owner: supabase-expert
Depends: S07-01
Criteria: PLAN #7 (index group A)
Skills: none
Budget: files=1; actions=6; changed_lines=40; minutes=5

## Goal
One migration file creating the six audit-listed indexes on prod_*,
roster and agg tables — all `IF NOT EXISTS`, `CONCURRENTLY` where the
expert's Postgres skill requires for hot tables.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`; record the actual filename in results

## Context
- PLAN criterion #7 index list (authoritative): prod_intervals(date), prod_flags(date), prod_flags(agent_email), prod_daily_layers(date), roster(lower(email)), agg_inflow_hourly(year,date)
- `supabase/migrations/014_migration_hardening.sql:25-58` | `*_uidx`/idx naming + commenting convention
- PLAN #3 filtered reads make these hot: prod_intervals windowed reads (S02-01), roster ilike email (S01-02), agg_inflow_hourly reads (jobs)

## Contract
- `prod_intervals(date)`; `prod_flags(date)`; `prod_flags(agent_email)`; `prod_daily_layers(date)`; `roster(lower(email))` (expression index — the S01-02 `.ilike`/lowercase email lookups); `agg_inflow_hourly(year,date)`.
- Each `CREATE INDEX IF NOT EXISTS <descriptive_name>`; comment the calling path per the 014 convention. Non-unique plain b-trees only.
- Idempotent re-apply; remote apply is user-approved, not this leaf.
Out of scope: tickets/refresh_log/queue_submissions indexes (S07-03), uniques (S07-01), policies.

## Actions
1. CREATE INDEX on `prod_intervals(date)`.
2. CREATE INDEX on `prod_flags(date)`.
3. CREATE INDEX on `prod_flags(agent_email)`.
4. CREATE INDEX on `prod_daily_layers(date)`.
5. CREATE INDEX on `roster(lower(email))` (expression index).
6. CREATE INDEX on `agg_inflow_hourly(year,date)`.

## Done when
- Migration file contains exactly these six indexes, idempotent.
- `supabase migration lint` (or skill-equivalent check) passes.

## Verify
- Run: `supabase migration list` -> the new file is registered.

## Handoff
S07-03 follows serially on the shared catalog. Write results/S07-02.md
(<=10 lines) with the filename; TL alone updates TRACKER.md.
