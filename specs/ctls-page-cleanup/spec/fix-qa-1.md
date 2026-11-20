# fix-qa-1 — QA round 1 blocking findings (ctls-page-cleanup)

Source report: `specs/ctls-page-cleanup/reports/qa-1.md`
Leaf map: qa-1 (MED, migration date handling) -> qa1-01. qa-2 (LOW) -> deferred.

## qa1-01: Guard sheet-date parsing in historical-CTL closeout migration
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: supabase-expert
Depends: none
Criteria: reports/qa-1.md finding qa-1 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=30; minutes=10

### Goal
Make `submitted_at`/`sla_met` in the historical-CTL closeout UPDATE safe for
non-ISO sheet-date text so the migration cannot fail at apply time on merge
and `sla_met` is computed from parsed dates, not lexicographic text compare.

### Files
- Edit: `supabase/migrations/20261120121758_close_historical_ctls.sql` | only the `submitted_at` (lines ~13-16) and `sla_met` (lines ~17-21) expressions; status/outcome/closed_by/coaching_notes and the WHERE clause stay untouched

### Context
- `supabase/migrations/20261120121758_close_historical_ctls.sql:8-37` | the whole UPDATE; `submitted_at` casts coalesced verbatim sheet text to timestamptz
- `reports/qa-1.md` finding qa-1 | evidence + exact fix direction
- `scripts/ops/ops-tabs.ts:84` | source `ctl date` column is unnormalized text (e.g. 'M/D/YYYY')

### Contract
The coalesce expression `coalesce(nullif(reminded_date,''), nullif(opened_date,''), due_date)`
is the candidate date `d`. `submitted_at` must be NULL (never raise) when `d`
does not match `^\d{4}-\d{2}-\d{2}`; `sla_met` must compare parsed `d` to
parsed `due_date` under the same ISO guard and resolve to 'true'/'false' text
(NULL-safe fallback per expert judgment, e.g. 'false' when either side is
unparseable). Update remains idempotent via the existing status guard.
Out of scope: any other migration, new migrations, remote DB changes, tests,
src/ files, TRACKER.md.

### Actions
1. Extract the coalesce into one guarded expression (CTE/`cross join lateral` or repeated `case`): `case when d ~ '^\d{4}-\d{2}-\d{2}' then d::timestamptz end`.
2. Rewrite `sla_met` to compare the two guarded parsed dates instead of raw text.
3. Static self-check: confirm no unguarded `::timestamptz`/date cast remains on sheet text and the file is syntactically valid SQL.

### Done when
- No unguarded cast of coalesced sheet text to timestamptz in the file.
- `sla_met` compares parsed dates only (lexicographic text compare removed).
- `where status in ('open','on_hold')` idempotency guard unchanged.

### Verify
- Run: `git diff supabase/migrations/20261120121758_close_historical_ctls.sql` -> only submitted_at/sla_met lines change; optionally `npx supabase migration lint` locally if available (no remote writes).

### Handoff
File keeps its name (already referenced by PLAN/results). Report guarded-SQL
excerpt in results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
