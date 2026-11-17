# perf1-02 — idx_qa_audits_audit_date (perf-3)

- Status: DONE — migration authored, not applied.
- File: `supabase/migrations/20261117123304_idx_qa_audits_audit_date.sql` (CLI-generated name).
- DDL: `CREATE INDEX IF NOT EXISTS idx_qa_audits_audit_date ON public.qa_audits (audit_date);` + header comment citing perf-3.
- Mechanism: plain CREATE INDEX — CONCURRENTLY is illegal inside the per-file transaction the migration runner uses; table ~1-4k rows so lock is trivial.
- Idempotent (IF NOT EXISTS); verified no prior bare-audit_date index (20261105172048:98-102 all leftmost-mismatch).
- Verify: `supabase status` -> no local stack; syntax-reviewed only. No remote mutation.
- NEEDS_APPROVAL: apply `20261117123304_idx_qa_audits_audit_date.sql` via remote `db push` batch (non-destructive, n).
