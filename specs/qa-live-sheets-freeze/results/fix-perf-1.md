# fix-perf-1 — qaReconcileQueueLog_ bounded reads + batched updates

Status: DONE
Files: src/features/cx-quality/lib/migrate.ts (only)

Changes:
- qe_queue_log read: `readAllPaged` + `build` filter `state IS NULL OR state != 'audited'` (was unbounded `readRows` full scan). Semantics preserved: loop still skips only `state==='audited'`.
- qa_audits read: `readAllPaged` + `build` filter `kind='audit'`, `submitted_at >= oldest queued_date (date part) among non-audited log rows`, `status IS NULL OR status != 'voided'`; skipped entirely when no pending rows; in-memory `kind/status/source` filter kept verbatim.
- Per-row UPDATE loop replaced by grouped updates: rows grouped by (queued_date, audited_at, audited_by), one `.update().eq('queued_date').in('key', keys)` per group.
- Import: `readRows` -> `readAllPaged` (readRows no longer used in file).

Checks: `npx tsc --noEmit` exit 0; `npx eslint src/features/cx-quality/lib/migrate.ts` exit 0.

Handoff: none. Note for TL/reviewer — perf-1 prescribed `.in('state',['pending','expired'])`; chose not-audited (`state != 'audited'` incl. NULL) to preserve 'passed'-row semantics exactly.
