# S08-02: seed trackers + tracker_fields for aux_exceptions and wa_parcels
Kind: mini
ID: S08-02
Parent: S08
Owner: supabase-expert
Depends: none (same pending file as S06-04; not yet applied remotely)
Criteria: PLAN #5; finding qa-2 (reports/qa-1.md)
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase\SKILL.md
Budget: files=1; actions=3; changed_lines=60; minutes=10

## Goal
`tracker_records.tracker_id` has FK `REFERENCES trackers(tracker_id)`
(009_operations.sql:54). The two new sheet-backed tracker ids written by
ops-tabs.ts transforms (`aux_exceptions`, `wa_parcels`) have no registry rows
anywhere, so the live tracker_records upsert (281 rows) fails 23503 on the
first batch. Seed both trackers + their fields before the live run.

## Files
- Edit: `supabase/migrations/20261109134359_s06_new_tables.sql` | append seed section (committed, NOT yet applied)

## Context
- `supabase/migrations/009_operations.sql:64-79` | trackers seed precedent
  (column list + `ON CONFLICT (tracker_id) DO NOTHING`)
- `src/features/shared/migration/mappings/ops-tabs.ts:148-186` | transforms:
  aux_exceptions values={agent_mail,date,aux,duration}; wa_parcels values=
  {country,creation_date,warehouse,order_id,status_3pl,whatsapp_status,
  invoice_id,link,code,trailed,confirmed,date_only}; record_id/row_n semantics
- `supabase/migrations/009_operations.sql:33-48` | tracker_fields columns

## Contract
Two `INSERT INTO trackers ... ON CONFLICT (tracker_id) DO NOTHING` rows
(storage_mode 'external' per 009 header convention for sheet-backed trackers;
sensible name/tab_name) and `INSERT INTO tracker_fields ... ON CONFLICT
DO NOTHING` rows: aux_exceptions 4 fields, wa_parcels 12 fields, field_id =
the jsonb keys above, position in listed order, label = the sheet header text.
Idempotent: whole block re-runnable with no error and no dup rows.
Out of scope: applying the migration remotely (NEEDS_APPROVAL gate stands);
any other file; tracker_records data itself.

## Actions
1. Append the trackers seed block (2 rows, ON CONFLICT DO NOTHING).
2. Append the tracker_fields seed block (16 rows, ON CONFLICT DO NOTHING).
3. Self-review the SQL for syntax/idempotency; if the Supabase MCP is
   available, optionally SELECT to confirm neither tracker_id exists yet.

## Done when
- File contains both tracker_ids and all 16 (tracker_id, field_id) rows with
  ON CONFLICT DO NOTHING guards.
- No other repo file changed.

## Verify
- Run: `grep -c "ON CONFLICT" supabase/migrations/20261109134359_s06_new_tables.sql`
  -> >=2; `grep -n "aux_exceptions\|wa_parcels"` -> both tracker_ids present.

## Handoff
Live `--tables tracker_records` run unblocked once this file is applied under
the existing NEEDS_APPROVAL gate.
Write results/S08-02.md (<=10 lines); TL alone updates TRACKER.md.
