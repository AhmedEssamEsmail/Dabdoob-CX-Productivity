# PM findings — user-directed fixes (2026-11-11)

Two user-approved items from NEEDS_USER escalations during BUILD. Each is a mini-fix leaf.

## F1 — stale table name `queue_status_submissions` (pre-existing bug)
- Owner: dev
- File: `src/features/cx-people/lib/one-on-ones-page.ts:578`
- Change: `readStore('queue_status_submissions')` -> `readStore('queue_submissions')`
  (sheet `queue_status_submissions` maps to table `queue_submissions` — see
  `src/features/shared/migration/mappings/queue-quality.ts:179`; evidence `docs/perf/pk-drift-evidence.md`)
- Verify: `npx tsc --noEmit` clean; any test touching one-on-ones check-ins still green.
- Check for other app-code references to the stale name under `src/` (comments are fine).

## F2 — missing index `prod_window_hist.date` (user approved migration file)
- Owner: supabase-expert
- Create a new timestamped migration ONLY via `npx supabase migration new <name>` (tool names the file).
  Index: `prod_window_hist (date)` — confirm column/type vs remote schema first (SELECT-only is approved).
  Use `CREATE INDEX IF NOT EXISTS`; no other DDL.
- DO NOT apply remotely, do not merge — file ships on merge to main per repo convention.
- Verify: file exists under `supabase/migrations/`, SQL is idempotent, no other changes.
