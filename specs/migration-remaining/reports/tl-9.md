# tl-9 — FIX mode: tl-8 code-only finding resolved

Mode FIX, task migration-remaining. Source report: reports/tl-8.md.
One code-only row routed: tracker_records.submitted_by NOT NULL violation
(mapRow re-nulls the '' that ops-tabs transforms emit; table absent from
NULL_AS_EMPTY). The other tl-8 NEEDS_USER rows are PM/owner decisions, not
code leaves — see Deferred below.

## Dispatched
- tl8-01 (dev, spec/fix-tl-8.md#tl8-01) — DONE. Added
  `tracker_records: ['submitted_by']` to NULL_AS_EMPTY in
  src/features/shared/migration/mappings/desk-operations.ts (+2 lines,
  additive only). Scoped diff verified: no other files touched.

## Evidence
- `npx tsc --noEmit` exit 0.
- `npx tsx migration/migrate-all.ts --dry --tables tracker_records` exit 0:
  AUXes Exceptions 58 rows + WA 223 rows mapped — the exact two sources that
  failed live in LIVE-02 — no NOT NULL errors (logs/tl8-01-dry.log).
- results/tl8-01.md. No live writes performed (dry only, per task).

## Changed files for reviewer DELTA scope
- src/features/shared/migration/mappings/desk-operations.ts (+2 lines)
- specs/migration-remaining/spec/fix-tl-8.md (new fix leaf)
- specs/migration-remaining/results/tl8-01.md, logs/tl8-01-dry.log (artifacts)

## Deferred (PM/owner decisions, unchanged from tl-8 NEEDS_USER)
- sched_overrides/sched_offdays audit columns: ALTER migration + apply
  approval vs dropping the columns from v1-ops-sched.ts mappings.
- qa-7 collapse count above estimate — confirm acceptable.
- LIVE-02 resume path after decision: `--tables sched_overrides,
  sched_offdays,tracker_records`, `--dry aux_spans`, `--tables
  aux_spans,qa_ctls`; then LIVE-03/04/05 serial. tracker_records itself is
  now unblocked.

## Status
Leaves: tl8-01 done. LIVE-02 remains blocked(partial) pending the PM
decision above; S06-11 still needs the Aug-2026 workbook share.
No shard requested a forbidden reviewer role this round.
