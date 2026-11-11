# TL report — FIX round on reports/pm-1.md (2026-11-11)

Source report: `specs/perf-pushdown/reports/pm-1.md` — 2 user-approved blocking findings.
Fix spec authored: `spec/fix-pm-1.md` (leaves pm1-01, pm1-02; both preflight PASS structural + semantic).

## Completed leaves
| Leaf | Owner | Files changed | Evidence |
|---|---|---|---|
| pm1-01 (F1) | dev | `src/features/cx-people/lib/one-on-ones-page.ts` (:578, 1 line) | results/pm1-01.md; `readStore('queue_status_submissions')` -> `readStore('queue_submissions')`; diff TL-verified as exactly that line; worker `tsc --noEmit` 0 errors; vitest people + people-jobs 38/38; remaining `queue_status_submissions` hits in src/ are comments/mapping docs only |
| pm1-02 (F2) | supabase-expert | `supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql` (new, 1 statement) | results/pm1-02.md; single `CREATE INDEX IF NOT EXISTS idx_prod_window_hist_date ON public.prod_window_hist (date)`; `git status` = exactly one new file; column `date text` + no prior index evidenced from repo DDL (remote SELECT unavailable to background agent — no MCP, remote CLI denied) |

## Blocked / needs-split
None. Both findings closed in scope (1 file each, far under budgets).

## Integration / gates
- Checkpoint: worker-ran `tsc --noEmit` 0 errors post-change + targeted vitest 38/38 (TL re-run auto-denied — npx/node exec not permitted for background TL; diff verified directly). Full gate suite last ran green at round 3/4 (build, e2e 170/180, integration 11/11, security 4/4, performance 14/14, vitest 1291/1291); this round's churn is one string literal + one SQL file.
- Reviewer DELTA scope: `one-on-ones-page.ts` (1 line) + the new migration file.

## NEEDS_APPROVAL (user)
- Apply `supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql` — one non-unique btree index, non-destructive. Per repo convention it ships on merge to `main` via the Supabase GitHub integration; remote apply/merge is not done.
- pm1-02 deviation note: leaf asked to confirm column vs remote schema via SELECT; remote access unavailable in background, so repo migration DDL (`20261031193219_domain_tables.sql:51-54`, `date text`) + absence of a prior index in `supabase/migrations/` was used instead. Recommend a quick remote confirm before merge, or let the advisor check at deploy.
