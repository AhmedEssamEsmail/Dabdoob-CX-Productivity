# S09-01: content-hash dedupe_key mints (kill positional keys)
Kind: mini
ID: S09-01
Parent: S09
Owner: dev
Depends: none
Criteria: PLAN #5; finding sec-1 (reports/sec-1.md) — MED
Skills: none
Budget: files=3; actions=7; changed_lines=200; minutes=10

## Goal
The flipped `upsertOn` dedupe keys are minted positionally (`'mig-'+ctx.index`,
`'v1-mig-'+ctx.index`) while the DDL backfill numbers by `id` order. If a
source sheet gains/loses/reorders rows before an approved re-run, `mig-N` maps
to a different source row and the upsert silently UPDATEs the wrong live row —
cross-row corruption. Mint each key as a content hash of the row's natural
identity cells instead, keeping the 'mig-'/'v1-mig-' source namespaces.

## Files
- Edit: `src/features/shared/migration/mappings/queue-quality.ts` | mint sites ~lines 508, 557, 562 + doc mentions ~254-256, 270-271, 613-614
- Edit: `src/features/shared/migration/mappings/v1-ops-sched.ts` | ShiftPlan transform ~line 138 + doc mentions ~lines 33, 182
- Create: `tests/lib/migration-dedupe-key.test.ts` | same-behaviour unit tests

## Context
- `src/features/shared/migration/mappings/ops-tabs.ts:23-26,142` | sha1
  precedent: `createHash('sha1').update(s).digest('hex')` over cells joined '|'
- `src/features/shared/migration/mappings/queue-quality.ts:486-563` | the
  three mint sites + their row-key shapes
- `src/features/shared/migration/mappings/v1-ops-sched.ts:120-139,29-44` |
  ShiftPlan transform + sheetToDb (v1 'tl'->tl_email lands post-sheetToDb)
- `supabase/migrations/20261109130633_dedupe_uniques_people_sched.sql:91-114` |
  sched_plan natural identity = (month, tl_email, date, shift, variant)
- `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql:90-109` |
  qa_access_log identity = (email, action, submitted_by, submitted_at)

## Contract
- `dedupe_key = '<prefix>' + sha1hex(identity cells joined '|', each
  String(v ?? ''))`, still only minted when the key is unset (keep the
  existing undefined/null/'' guard).
- Identity tuples, fixed order, post-sheetToDb row keys as upserted:
  - sched_plan (core transform AND v1 ShiftPlan): month, tl_email, date,
    shift, variant  — MUST match the DDL dedupe group.
  - qa_access_log: email, action, submitted_by, submitted_at.
  - refresh_log log_id: job, started_at, finished_at, rows_in, rows_out,
    source_cursor, status, error, note (full event tuple; prefix 'mig-').
- Prefixes unchanged: 'mig-' core/refresh_log, 'v1-mig-' v1 ShiftPlan.
- Degenerate rows: if ALL identity cells are empty keep the positional
  fallback `'mig-'+ctx.index` / `'v1-mig-'+ctx.index` (preserves uniqueness;
  FD_AUX blank-skip precedent).
- REPRESENTATION PARITY (handoff to S09-02): hash the text form actually
  upserted/stored. If a cell is a typed column (e.g. date) whose sheet format
  PostgREST would cast to a different text form, normalise in the transform
  before hashing and RECORD the exact format in results/S09-01.md — the SQL
  backfill must produce byte-identical strings.
- Local `sha1` helper per file (ops-tabs precedent); no new shared module.
Out of scope: SQL migration files (S09-02), engine.ts, validate.ts (it executes
ROW_TRANSFORMS so it inherits the scheme), any other mapping/table.

## Actions
1. Add the sha1 helper to queue-quality.ts; sched_plan mint ->
   'mig-'+sha1(month|tl_email|date|shift|variant).
2. QaAccessLog mint -> 'mig-'+sha1(email|action|submitted_by|submitted_at).
3. refresh_log log_id mint -> 'mig-'+sha1(job|started_at|finished_at|rows_in|
   rows_out|source_cursor|status|error|note).
4. Update the stale 'mig-<index>' doc comments + DECISIONS strings in
   queue-quality.ts.
5. v1-ops-sched.ts: sha1 helper + ShiftPlan mint ->
   'v1-mig-'+sha1(month|tl_email|date|shift|variant); update comments ~
   lines 33/182.
6. tests/lib/migration-dedupe-key.test.ts: same cells+different ctx.index ->
   same key; changed cell -> different key; prefix retained; all-empty
   identity -> positional fallback; one fixed-vector sha1 assertion.
7. Verify representation parity for `date` (sched_plan) and record the exact
   hashed format in results/S09-01.md for S09-02.

## Done when
- `grep -n "ctx.index"` on both edited files shows only the empty-identity
  fallback paths.
- `npx vitest run tests/lib/migration-dedupe-key.test.ts` passes.
- `npx tsc --noEmit` exit=0.
- results/S09-01.md records the exact identity order + hashed text format per
  table.

## Verify
- Run: `npx vitest run tests/lib/migration-dedupe-key.test.ts` -> pass
- Run: `npx tsc --noEmit` -> exit=0

## Handoff
S09-02 mirrors this exact format in the pending DDL backfills; it needs the
identity order + text-format note from results/S09-01.md.
Write results/S09-01.md (<=10 lines); TL alone updates TRACKER.md.
