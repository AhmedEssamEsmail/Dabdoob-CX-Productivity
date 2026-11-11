# fix-pm-1: PM findings — user-approved fixes (reports/pm-1.md, 2026-11-11)
Source: `specs/perf-pushdown/reports/pm-1.md`. Two user-approved items from
NEEDS_USER escalations during BUILD. Disjoint files/owners — pm1-01 and pm1-02
are independent (no Depends).

## pm1-01: stale table name queue_status_submissions -> queue_submissions
Kind: mini
ID: pm1-01
Parent: S02
Owner: dev
Depends: none
Criteria: pm-1.md F1 (blocking)
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=5

### Goal
The one-on-ones "Check-ins" part reads the real table: `readStore('queue_status_submissions')` at `one-on-ones-page.ts:578` becomes `readStore('queue_submissions')`. Sheet `queue_status_submissions` maps to table `queue_submissions` — the stale string means `subs.exists` is always false and slots render empty.

### Files
- Edit: `src/features/cx-people/lib/one-on-ones-page.ts` | the `readStore` call at :578 only

### Context
- `src/features/cx-people/lib/one-on-ones-page.ts:575-582` | the Check-ins `part(...)` call site
- `src/features/shared/migration/mappings/queue-quality.ts:179` | sheet `queue_status_submissions` -> table `queue_submissions`
- `src/features/cx-queue/lib/server.ts:22` | existing correct `queue_submissions` usage precedent
- `docs/perf/pk-drift-evidence.md` | remote `queue_status_submissions` confirmed absent

### Contract
One-line identifier change; no logic, type or test edits. Comments/docstrings
elsewhere mentioning the sheet name are correct and stay untouched. Out of
scope: any other file, `dqSlotsToday_`, mapping files.

### Actions
1. Replace `'queue_status_submissions'` with `'queue_submissions'` at one-on-ones-page.ts:578.
2. Grep `src/` for other `readStore(`/`from(`/`table(` args using the stale name (comments excluded) — confirm none remain; record the grep result.
3. `npx tsc --noEmit` clean; run the vitest file(s) covering one-on-ones if present.

### Done when
- only `queue_submissions` remains as an app-code store/table arg; tsc 0 errors
- targeted one-on-ones tests green (or recorded: none exist)

### Verify
- Run: `npx tsc --noEmit` -> 0 errors; `grep -rn "queue_status_submissions" src --include="*.ts" | grep -v "^.*//" ` -> only comments/mapping docs

### Handoff
Check-ins slots populate from the real `queue_submissions` rows.
Write results/pm1-01.md (<=10 lines); TL alone updates TRACKER.md.

## pm1-02: migration — index on prod_window_hist(date)
Kind: mini
ID: pm1-02
Parent: S06
Owner: supabase-expert
Depends: none
Criteria: pm-1.md F2 (blocking; user approved the migration file)
Skills: none
Budget: files=1; actions=3; changed_lines=20; minutes=6

### Goal
One new timestamped migration file adds `CREATE INDEX IF NOT EXISTS` on `prod_window_hist (date)` — closing the index gap S06-01 flagged (P-16). File only; it ships on merge to main per repo convention.

### Files
- Generated: `supabase/migrations/` | one output of `npx supabase migration new <name>` (tool names the file; record actual name in results)

### Context
- `specs/perf-pushdown/results/S06-01.md` + TRACKER S06-01 evidence | index missing on `prod_window_hist.date`
- `specs/perf-pushdown/results/S07-03.md` | P-16 skip note: a date-leading index was believed present; pm-1 confirms it is missing for the query pattern
- `supabase/migrations/` | existing migration naming/layout precedent
- AGENTS.md (repo root) | migrations ship via new timestamped files only; remote writes need approval (NOT granted — file only)

### Contract
SELECT-only remote verification is approved (confirm `prod_window_hist.date`
exists, its type, and that no equivalent index already exists); DDL goes into
the new migration file ONLY — never applied remotely. Exactly one index
statement, `IF NOT EXISTS`, no other DDL, no other files. Out of scope: remote
apply, merging, any other table/column.

### Actions
1. SELECT-only check of remote `prod_window_hist` (`date` column type) and existing indexes on that table.
2. `npx supabase migration new add_prod_window_hist_date_index`; write the `CREATE INDEX IF NOT EXISTS ... ON prod_window_hist (date)` statement (concurrently only if repo precedent uses it; plain is fine).
3. Verify file exists, SQL is idempotent, and nothing else changed (`git status -- supabase/`).

### Done when
- exactly one new file under `supabase/migrations/` containing only the idempotent index DDL
- results record remote column/type evidence and the generated filename

### Verify
- Run: `git status --porcelain -- supabase/` -> exactly one new migration file; file content is a single `CREATE INDEX IF NOT EXISTS` statement

### Handoff
Index ships on merge to main (Supabase GitHub integration); perf gate can re-check `prod_window_hist` scans after deploy.
Write results/pm1-02.md (<=10 lines); TL alone updates TRACKER.md.
