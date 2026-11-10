# fix-tl-8 — code fix for LIVE-02 halt (reports/tl-8.md)

Single blocking code finding routed for FIX. The sched_overrides/sched_offdays
audit-column decision and the qa-7 collapse count are PM/owner decisions
(NEEDS_USER in tl-8) — NOT this leaf. No live writes anywhere in this file.

## tl8-01: tracker_records.submitted_by added to NULL_AS_EMPTY
Kind: mini
ID: tl8-01
Parent: LIVE (fix for tl-8 LIVE-02 halt)
Owner: dev
Depends: none
Criteria: reports/tl-8.md NEEDS_USER (b) — the code-only row
Skills: none
Budget: files=2; actions=2; changed_lines=15; minutes=8

### Goal
Stop mapRow re-nulling `submitted_by` on tracker_records rows: ops-tabs
ROW_TRANSFORMS set `submitted_by = ''` (AUXex + WA), but engine.ts mapRow
turns `''` back to null for tables absent from NULL_AS_EMPTY -> live run hit
NOT NULL violation (tracker_records.submitted_by is `text NOT NULL DEFAULT ''`
in 009_operations.sql:57). The NULL_AS_EMPTY docblock predicts this exactly.

### Files
- Edit: `src/features/shared/migration/mappings/desk-operations.ts` | NULL_AS_EMPTY map (~:327-359) — add `tracker_records: ['submitted_by']` entry (one line + optional short comment)
- Create: `specs/migration-remaining/results/tl8-01.md` | worker result note (coordination artifact)

### Context
- `src/features/shared/migration/engine.ts:183-198` | mapRow '' -> null unless `NULL_AS_EMPTY_MAP[mapping.table].has(col)`
- `src/features/shared/migration/mappings/desk-operations.ts:320-359` | NULL_AS_EMPTY docblock + existing entries (format to follow)
- `src/features/shared/migration/mappings/ops-tabs.ts:162,184` | transforms already emit `submitted_by = ''`
- `supabase/migrations/009_operations.sql:53-61` | tracker_records DDL: only submitted_by is `text NOT NULL DEFAULT ''` (values is jsonb; tracker_id/record_id/row_n always set by transforms)

### Contract
`NULL_AS_EMPTY` gains exactly one key: `tracker_records: ['submitted_by']`.
Additive only — no other entries, files, mappings or engine code touched.
Out of scope: sched_overrides/sched_offdays columns, qa-7 counts, any live
write (`--write`, non-`--dry` migrate-all, backfill scripts), TRACKER_RECORD_BACKFILLS.

### Actions
1. Add `tracker_records: ['submitted_by']` to NULL_AS_EMPTY with a one-line comment referencing the ops-tabs AUXex/WA transforms.
2. Verify via the targeted dry run below (read-only; never run without `--dry`).

### Done when
- `npx tsc --noEmit` exits 0.
- `npx tsx migration/migrate-all.ts --dry --tables tracker_records` exits 0 and shows tracker_records rows mapped (AUXex + WA), no NOT NULL errors.
- No file outside the Files list changed.

### Verify
- Run: `npx tsx migration/migrate-all.ts --dry --tables tracker_records` -> exit 0; log to `specs/migration-remaining/logs/tl8-01-dry.log`.

### Handoff
Unblocks LIVE-02 re-run of tracker_records (still gated on the PM's
sched_overrides/sched_offdays decision for the other two errors).
Write results/tl8-01.md (<=10 lines); TL alone updates TRACKER.md.

## tl8-02: sched_overrides/sched_offdays emit live-schema columns only
Kind: mini
ID: tl8-02
Parent: LIVE (fix for tl-8 LIVE-02 halt)
Owner: dev
Depends: none
Criteria: reports/tl-8.md NEEDS_USER (a) — PM DECIDED "drop the columns"
Skills: none
Budget: files=2; actions=4; changed_lines=30; minutes=8

### Goal
Live DDL has no audit columns on these two tables (007_queue.sql:
sched_overrides :118-122 = tl_email,date,shift,note; sched_offdays
:114-117 = tl_email,date only), so the LIVE-02 run died on
'submitted_at'/'note' not in schema cache. PM decision (tl-8
NEEDS_USER a): drop the columns from the mappings — the sheet
setBy/setAt/note values are knowingly NOT migrated (data loss accepted
by the owner). Emit only live-schema columns.

### Files
- Edit: `src/features/shared/migration/mappings/v1-ops-sched.ts` | sched_overrides mapping (~:57-69), sched_offdays mapping (~:82-94), DECISIONS entries (:202,:204)
- Create: `specs/migration-remaining/results/tl8-02.md` | worker result note (coordination artifact)

### Context
- `supabase/migrations/007_queue.sql:110-122` | live DDL: sched_offdays {tl_email,date}; sched_overrides {tl_email,date,shift,note}
- `src/features/shared/migration/mappings/v1-ops-sched.ts:57-94` | the two mappings + their comments
- `src/features/shared/migration/mappings/v1-ops-sched.ts:200-208` | DECISIONS array
- `src/features/shared/migration/mappings/v1-ops-sched.ts:160-163,177-183` | ROW_TRANSFORMS — ShiftOverrides writes row.note (KEEP: note still emitted); TLOffDays writes row.date (KEEP: date still emitted); neither writes the dropped columns

### Contract
- sched_overrides: `columns` becomes `['tl_email','date','shift','note']`; `sheetToDb` becomes `{ tl_email: 'tl' }`. upsertOn/require unchanged.
- sched_offdays: `columns` becomes `['tl_email','date']`; `sheetToDb` becomes `{ tl_email: 'tl' }`. upsertOn/require unchanged.
- Update the two mappings' comments (:58-60, :83-86) and their DECISIONS entries to record: PM decision (tl-8 NEEDS_USER a) = drop submitted_by/submitted_at (and sched_offdays.note); sheet setBy/setAt/note values are not migrated.
- Additive-safe: no other mapping, transform, file or engine code touched. ROW_TRANSFORMS unchanged.
- Out of scope: any DDL/ALTER migration, any live write (`--write`, non-`--dry` migrate-all, backfill scripts), tracker_records, qa-7.

### Actions
1. sched_overrides mapping: remove `submitted_by`,`submitted_at` from columns and the setby/setat pairs from sheetToDb; fix the comment.
2. sched_offdays mapping: remove `note`,`submitted_by`,`submitted_at` from columns and setby/setat from sheetToDb; fix the comment.
3. Update the two DECISIONS entries (ShiftOverrides, TLOffDays) to state the drop decision and lost sheet fields.
4. Verify via the targeted dry run below (read-only; never run without `--dry`).

### Done when
- `npx tsc --noEmit` exits 0.
- `npx tsx migration/migrate-all.ts --dry --tables sched_overrides,sched_offdays` exits 0, both tables' rows map, and no 'not in schema cache' / unknown-column errors appear.
- No file outside the Files list changed.

### Verify
- Run: `npx tsx migration/migrate-all.ts --dry --tables sched_overrides,sched_offdays` -> exit 0; log to `specs/migration-remaining/logs/tl8-02-dry.log`.

### Handoff
Unblocks LIVE-02 re-run of sched_overrides+sched_offdays (with the
tl8-01 tracker_records fix and the PM's qa-7 confirmation, LIVE-02
remainder can resume). Write results/tl8-02.md (<=10 lines); TL alone
updates TRACKER.md.
