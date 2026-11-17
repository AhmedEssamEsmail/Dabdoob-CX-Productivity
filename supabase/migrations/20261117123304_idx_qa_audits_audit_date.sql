-- perf1-02 / reports/perf-1.md finding perf-3 (LOW): index
-- public.qa_audits(audit_date) so the dbbook qualityTab_ audit_date range
-- filter (src/features/shared/jobs/dbbook.ts:163-185) stops seq-scanning +
-- sorting by audit_id per page. All existing qa_audits indexes
-- (20261105172048_quality.sql:98-102) leftmost-mismatch a bare audit_date
-- predicate.
--
-- Plain CREATE INDEX (not CONCURRENTLY): the migration runner wraps each
-- file in a transaction where CONCURRENTLY is illegal; qa_audits is ~1-4k
-- rows so the brief lock is trivial. IF NOT EXISTS keeps it idempotent.

CREATE INDEX IF NOT EXISTS idx_qa_audits_audit_date
  ON public.qa_audits (audit_date);
