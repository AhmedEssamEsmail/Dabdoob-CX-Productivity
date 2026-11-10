# S04-01: fc_messages raw mirror table
Kind: mini
ID: S04-01
Parent: S04
Owner: supabase-expert
Depends: none
Criteria: PLAN #1 (fc_messages store → migrated via raw mirror)
Skills: none (supabase-expert reads its own DB skills)
Budget: files=1; actions=4; changed_lines=70; minutes=8

## Goal
One generated migration creating `public.fc_messages` — the raw-mirror sink
for the 'Freshchat Detailed Msgs' sheet (`1ZxDxS…`) which no ported import
reads today — in the established mirror-table shape.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`

## Context
- `supabase/migrations/004_mirror_tables.sql:12-37,56-62` | the mirror shape
  to copy verbatim (dedupe_key UNIQUE, ts_ms, cols jsonb, synced_at, ts index,
  app_all)
- `supabase/migrations/012_pg_cron_schedule.sql:237` | "fc_messages — NOT
  ported (B3 creds + WP-53/WP-F16)" — this table is the Postgres sink that
  note asks for
- `specs/migration-remaining/PLAN.md:54-55` | mirror tables allowed where a
  ported import has no natural target

## Contract
Same columns/types/indexes as `freshchat` in 004: `id` identity PK,
`dedupe_key text UNIQUE`, `ts_ms bigint`, `cols jsonb`,
`synced_at timestamptz`, `idx_fc_messages_ts` on ts_ms, RLS enable + `app_all`
policy. `ts_ms` stays nullable — the backfill leaves it NULL on rows whose
timestamp column can't be parsed.
Out of scope: other tables; applying remotely; the backfill itself (S04-07).

## Actions
1. `supabase migration new <name>`; record the filename in results.
2. CREATE TABLE fc_messages in the 004 mirror shape + ts index.
3. RLS enable + app_all policy.
4. Write `results/S04-01.md` (<=10 lines): filename + shape confirmation.

## Done when
- Migration creates fc_messages identical in shape to the 004 mirrors.
- SQL idempotent (IF NOT EXISTS).

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s04-01-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S04-07 backfills rows as {dedupe_key, ts_ms, cols, synced_at}. Write
`results/S04-01.md`; TL updates TRACKER.md.
