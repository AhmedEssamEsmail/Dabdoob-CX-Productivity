# S02-01: dedupe + UNIQUE — queue/agg snapshot tables
Kind: mini
ID: S02-01
Parent: S02
Owner: supabase-expert
Depends: none
Criteria: PLAN #5 (insert-only hardening, queue/agg family)
Skills: none (supabase-expert reads its own DB skills)
Budget: files=1; actions=9; changed_lines=350; minutes=10

## Goal
One generated migration removing existing duplicates and adding UNIQUE
indexes on the 8 queue/agg insert-only tables, using the keys below so the
mapping `upsertOn` flips (S02-04/08) have a real conflict target.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`

## Context
- `supabase/migrations/20261108204952_*.sql` | the dedupe pattern to copy
  (DELETE ... IS NOT DISTINCT FROM, keep highest id; CREATE UNIQUE INDEX IF NOT EXISTS)
- `src/features/shared/migration/mappings/queue-quality.ts:85-152` | the
  mappings' columns + require fields these keys come from
- `supabase/migrations/007_queue.sql:39-46,135-141` | aging/sched_plan DDL
- `specs/megaplan/audits/migration-run.md:160-162` | the 23-table hazard list

## Contract
Tables and intended keys (natural unique per source row):
aging_open_tickets→ticket_id · agg_queue_now→(queue,kind) ·
agg_inflow_weekly→(period,channel,country) ·
agg_inflow_monthly→(period,channel,country) · agg_agent_perf→(email,period) ·
agg_agent_daily→(date,email) · agg_snapshots_today→snapshot_key ·
qa_volume→(date,channel,contact_type).
Rule: before each index, NULL-probe every key column; if any is nullable AND
the table holds NULL-key rows, fall back to a generated `dedupe_key TEXT`
column (backfill `'mig-' || (row_number() OVER (ORDER BY id) - 1)`, UNIQUE)
and record `transform:dedupe_key` for that table in results. Dedupe deletes
keep the highest `id` per key group (last write wins). Survivor columns stay
untouched; no shape changes.
Out of scope: applying remotely; touching any other table; RLS (existing
policies already cover these tables).

## Actions
1. `supabase migration new <name>`; record the filename in results; header
   comment citing PLAN #5 + the key table.
2. aging_open_tickets: NULL-key probe as a SQL comment + guarded DELETE
   dedupe (pattern of 20261108204952) on ticket_id (or dedupe_key fallback)
   + `CREATE UNIQUE INDEX IF NOT EXISTS aging_open_tickets_ticket_id_uidx`.
3. agg_queue_now: same probe/dedupe/unique-index sequence on (queue,kind).
4. agg_inflow_weekly: same on (period,channel,country).
5. agg_inflow_monthly: same on (period,channel,country).
6. agg_agent_perf: same on (email,period).
7. agg_agent_daily: same on (date,email).
8. agg_snapshots_today: same on snapshot_key.
9. qa_volume: same on (date,channel,contact_type); then write
   `results/S02-01.md` (<=10 lines) listing table→final key + any
   `transform:dedupe_key` flags.

## Done when
- One migration file covers all 8 tables: dedupe DELETE + UNIQUE each.
- Every key choice + fallback is written in `results/S02-01.md`.
- SQL is idempotent (IF NOT EXISTS / IS NOT DISTINCT FROM guards).

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-01-tsc.log 2>&1; echo "exit=$?"` -> exit=0 (SQL-only change must not break the tree).

## Handoff
`results/S02-01.md` carries the authoritative table→upsertOn key list for
S02-04 (queue-quality flips) and S02-08 (qa_volume). Write it; TL updates
TRACKER.md.
