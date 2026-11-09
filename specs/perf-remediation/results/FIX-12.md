# FIX-12 result — roster(email) unique constraint
Status: done (file created; NOT applied — needs approval).
Files: `supabase/migrations/20261108234911_roster_email_unique.sql` (CLI-generated name).
Content: dedupe DO-block on `email IS NOT DISTINCT FROM` keeping highest `id`
(ctid fallback if the 001 email-PK shape is ever the target — stays parseable,
no dups possible there), then `CREATE UNIQUE INDEX IF NOT EXISTS roster_email_uidx`.
Idempotent: re-apply is a no-op (no dup rows; IF NOT EXISTS).
Checks: `supabase migration list` -> 20261108234911 registered as local/pending;
visual review — valid DO/DELETE-USING/CREATE INDEX syntax.
Advisors: skipped — no MCP server configured, no local DB running.
Handoff: NEEDS_APPROVAL: apply 20261108234911_roster_email_unique.sql (dedupe +
unique index on roster.email; destructive: dedupe DELETE on dup emails — y).
