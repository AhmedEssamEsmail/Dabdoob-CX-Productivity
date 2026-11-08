# S07-01: Dedupe pre-flight + unique constraints on prod_daily_layers and queue_submissions
Kind: mini
ID: S07-01
Parent: S07
Owner: supabase-expert
Depends: none
Criteria: PLAN #7 (dedupe pre-flight + uniques the app upserts assume)
Skills: none
Budget: files=1; actions=3; changed_lines=80; minutes=6

## Goal
One migration file that (1) removes existing duplicate rows on the two
upsert keys, then (2) creates the unique constraints — ending applyOp's
delete+insert fallback on these tables and making check-in submissions
idempotent.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`; record the actual filename in results before editing

## Context
- `src/features/shared/jobs/env.ts:355` | prod_daily_layers upsert keys hard-coded to (date,email,layer)
- `src/features/cx-queue/lib/pages.ts:215-222` | one queue_submissions row per (slot_date, slot); submission_id unique already exists from 014
- `supabase/migrations/014_migration_hardening.sql:35-41` | prior dedupe-warning convention + index naming (`*_uidx`)
- PLAN research: "prod_daily_layers + queue_submissions still lack uniques -> applyOp falls back to delete+insert"

## Contract
- Dedupe pre-flight: delete duplicate `prod_daily_layers` rows on (date,email,layer) keeping ONE surviving row per key (lowest id — state the rule in a comment); same for `queue_submissions` on (slot_date,slot) keeping the row the app would keep (latest update/id — pick one rule, comment it).
- `CREATE UNIQUE INDEX IF NOT EXISTS prod_daily_layers_date_email_layer_uidx ON public.prod_daily_layers (date, email, layer)` — skip if 014's version already exists remotely (IF NOT EXISTS handles it).
- `CREATE UNIQUE INDEX IF NOT EXISTS queue_submissions_slot_date_slot_uidx ON public.queue_submissions (slot_date, slot)`.
- Idempotent: re-apply is a no-op. Remote apply is user-approved, NOT this leaf.
Out of scope: the 11 lookup indexes (S07-02/03), RLS/policy changes (S08-04), any table data beyond the two dedupes.

## Actions
1. Dedupe prod_daily_layers on (date,email,layer).
2. Dedupe queue_submissions on (slot_date,slot).
3. Create the two unique indexes above (IF NOT EXISTS).

## Done when
- Migration file created via `supabase migration new`; content covers dedupe + both uniques, idempotent.
- `supabase migration lint` (or the expert skill's local check) passes; `npx tsc --noEmit` unaffected.

## Verify
- Run: `supabase migration list` -> the new file is registered (or the skill's equivalent local validation).

## Handoff
S07-02/03 append further migrations serially. Record the real filename +
chosen dedupe-survivor rules in results/S07-01.md (<=10 lines); TL alone updates TRACKER.md.
