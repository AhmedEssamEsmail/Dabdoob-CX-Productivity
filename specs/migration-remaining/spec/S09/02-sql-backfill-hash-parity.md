# S09-02: DDL backfills emit the same content-hash dedupe_key
Kind: mini
ID: S09-02
Parent: S09
Owner: supabase-expert
Depends: S09-01
Criteria: PLAN #5; finding sec-1 (reports/sec-1.md) — MED
Skills: Supabase skill/MCP per your role SKILL.md
Budget: files=2; actions=5; changed_lines=80; minutes=10

## Goal
The two pending dedupe migrations backfill `dedupe_key` positionally
('mig-'||row_number-1 by id order). S09-01 switches the transforms to
`'mig-'+sha1(identity cells)` — the backfills must emit byte-identical keys or
the first approved re-run inserts a full duplicate set instead of matching the
backfilled rows.

## Files
- Edit: `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql` | qa_access_log backfill ~lines 90-109
- Edit: `supabase/migrations/20261109130633_dedupe_uniques_people_sched.sql` | sched_plan backfill ~lines 103-111 + comment ~23-30

## Context
- `specs/migration-remaining/results/S09-01.md` | exact identity-cell order
  and hashed text format per table (contract source of truth)
- `specs/migration-remaining/spec/S09/01-content-hash-dedupe-keys.md` |
  Contract section — canonical format
- `src/features/shared/migration/mappings/queue-quality.ts:545-563` | the
  two transforms whose output must match
- `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql:19-31` |
  refresh_log block — NO change (log_id is app-minted; no backfill exists)

## Contract
- Backfill emits `'<prefix>' || lower(hex(sha1(...)))` producing the SAME
  string the transform sends: sha1 of the identity columns joined '|', each
  `coalesce(col::text,'')`, order per S09-01 results:
  - sched_plan: month, tl_email, date, shift, variant (prefix 'mig-')
  - qa_access_log: email, action, submitted_by, submitted_at (prefix 'mig-')
- sha1 in Postgres = pgcrypto `digest(...,'sha1')` -> `encode(...,'hex')`;
  enable the extension idempotently the way this project's migrations do
  (check schema qualification / search_path precedent in supabase/migrations).
- Column text casts MUST reproduce the stored form the upsert writes (typed
  columns like `date` — see S09-01's parity note); when in doubt prefer the
  form PostgREST returns.
- Keep `dedupe_key IS NULL` guards and all DELETE/CREATE ... IF NOT EXISTS
  untouched — re-apply must stay a no-op; file stays a single migration.
- v1-mig- rows need no backfill (no v1 ShiftPlan rows exist remotely yet).
Out of scope: refresh_log (no backfill), 20261109130706 queue_agg (natural
keys), transform code, applying the migration (NEEDS_APPROVAL stands).

## Actions
1. Read results/S09-01.md; pin the canonical format from it.
2. Enable pgcrypto idempotently + rewrite the sched_plan backfill UPDATE to
   'mig-'||sha1hex(month|tl_email|date|shift|variant); update comments.
3. Rewrite the qa_access_log backfill to
   'mig-'||sha1hex(email|action|submitted_by|submitted_at); update comments.
4. Confirm both files stay idempotent (NULL guards, IF NOT EXISTS).
5. Sanity-check expression types/casts compile against the table DDLs.

## Done when
- Both backfills emit the contract format with `IS NULL` guards intact.
- Migration files remain idempotent and self-contained.
- results/S09-02.md records the exact SQL expression used per table.

## Verify
- Run: `supabase db lint` (or the project's closest local SQL parse) -> no errors; record what was run.

## Handoff
After PM approval + apply, a re-run's upsert keys equal backfilled keys ->
idempotent updates, no cross-row overwrite.
Write results/S09-02.md (<=10 lines); TL alone updates TRACKER.md.
