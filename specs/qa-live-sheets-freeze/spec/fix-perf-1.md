# fix-perf-1 — FIX leaves for reports/perf-1.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/perf-1.md` (FULL perf
gate, round 1). Dispatched per report Owner column:
perf-2 (MED) -> dev, perf-3 (LOW) -> supabase-expert, perf-4 (LOW) -> dev,
perf-5 (LOW) -> supabase-expert.

NOT dispatched: **perf-1 (HIGH)** — `src/features/cx-quality/lib/migrate.ts`
is in the USER-OWNED `src/features/cx-quality/**` workstream (same hand-back
precedent as sec1-01's server.ts repoint and tl-1). Recorded as a user
hand-back in TRACKER; no leaf, no edit by any worker.

## perf1-01: job-qa-engine route declares maxDuration=300 (perf-2)
Kind: mini
ID: perf1-01
Parent: fix-perf-1
Owner: dev
Depends: none
Criteria: reports/perf-1.md finding perf-2 (MED); PLAN #5 cron chain
Skills: none
Budget: files=1; actions=1; changed_lines=5; minutes=5

### Goal
`export const maxDuration = 300` on the qa-engine cron route so the serial
build/import -> reconcile -> CTL-reminders chain is not killed mid-chain by
the platform default (partial queue import, reconcile/reminders lost daily).

### Files
- Edit: `src/app/api/cron/job-qa-engine/route.ts` | add the export next to the imports, before `cronOk`

### Context
- `src/app/api/cron/job-qa-engine/route.ts:9-12` | import block — no maxDuration today
- `src/app/api/cron/job-productivity-daily/route.ts:6`, `daily-layers/route.ts:9`, `job-tph-past-days/route.ts:6`, `scorecard-nightly/route.ts:8` | the four heavy siblings all declare `export const maxDuration = 300` — match them exactly
- `supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql:80-98` | pg_cron fires this route at 07:30 UTC; `net.http_get` timeout (60s) does not bound the function — only maxDuration does

### Contract
Add `export const maxDuration = 300` (top-level const, no comment needed or a
one-liner matching sibling style). Nothing else in the file changes — GET/POST
exports, cronOk, requireJobCaller ordering all untouched.
Out of scope: migrate.ts (perf-1, user hand-back), server.ts/qaCtlReminders,
any other route, vercel.json.

### Actions
1. Add the export; run tsc.

### Done when
- `grep -n "maxDuration" src/app/api/cron/job-qa-engine/route.ts` -> `export const maxDuration = 300`.
- `npx tsc --noEmit` -> 0 errors.

### Verify
- Run: `npx tsc --noEmit` -> 0 errors; grep line present

### Handoff
Route now matches the 300s convention of all heavy cron siblings.
Write results/perf1-01.md (<=10 lines); TL alone updates TRACKER.md.

## perf1-02: index qa_audits(audit_date) for the Quality tab + future bounded reconcile (perf-3)
Kind: mini
ID: perf1-02
Parent: fix-perf-1
Owner: supabase-expert
Depends: none
Criteria: reports/perf-1.md finding perf-3 (LOW); PLAN #1 perf budget
Skills: none
Budget: files=1; actions=3; changed_lines=30; minutes=8

### Goal
A btree index exists on `public.qa_audits (audit_date)` so the dbbook
`qualityTab_` audit_date range filter (and the bounded reconcile once the
user-owned perf-1 lands) stops seq-scanning + sort-by-audit_id per page.

### Files
- Generated: `supabase/migrations/` | one output of `supabase migration new idx_qa_audits_audit_date`

### Context
- `src/features/shared/jobs/dbbook.ts:163-185` | `qualityTab_` filters `audit_date` alone — existing indexes (agent_email,audit_date), (auditor_email,audit_date), ticket_id, queue_id, calibration_id (20261105172048:98-102) all leftmost-mismatch
- `supabase/migrations/20261116204115_recreate_aux_spans.sql` | project migration conventions: header comment, IF NOT EXISTS, idempotent
- `reports/perf-1.md:55` | reviewer prescribes `CREATE INDEX CONCURRENTLY idx_qa_audits_audit_date ON public.qa_audits (audit_date)` — NOTE: CONCURRENTLY cannot run inside a transaction; if the migration runner wraps files in one, use plain `CREATE INDEX IF NOT EXISTS` instead (table ~1-4k rows, lock is trivial). Pick whichever mechanism actually applies cleanly; document the choice in results
- TRACKER.md "Remote apply pending" | remote apply stays a PM/deploy step — do NOT `db push --remote`

### Contract
One new timestamped migration file (real CLI-generated name) that creates
`idx_qa_audits_audit_date` on `public.qa_audits(audit_date)`, idempotent,
with a short header comment citing perf-3. Record the actual filename in
results. No remote apply, no other DDL, no qa_audits data changes.
Out of scope: remote `db push`, any other table/index, migrate.ts bounding
(perf-1 hand-back), editing existing migrations.

### Actions
1. `npx supabase migration new idx_qa_audits_audit_date`; record the filename.
2. Write the index DDL (CONCURRENTLY or plain per Contract note) + header comment.
3. Verify locally if a scratch DB is available (e.g. `supabase db reset`/lint), else syntax-review; do NOT push remote.

### Done when
- New migration file exists with a single `CREATE INDEX` on qa_audits(audit_date), idempotent.
- Index name `idx_qa_audits_audit_date`; results file names the actual migration filename and the mechanism used.
- No remote mutation performed.

### Verify
- Run: `ls supabase/migrations/*idx_qa_audits_audit_date*` -> one file; `npx tsc --noEmit` unaffected

### Handoff
Index ships with the pending remote `db push` batch (PM/deploy). perf-1's
bounded reconcile benefits once the user applies their fix.
Write results/perf1-02.md (<=10 lines); TL alone updates TRACKER.md.

## perf1-03: fdAuxTab_ bounds aux_spans reads to the ctx window (perf-4)
Kind: mini
ID: perf1-03
Parent: fix-perf-1
Owner: dev
Depends: none
Criteria: reports/perf-1.md finding perf-4 (LOW); PLAN #1 perf budget
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=8

### Goal
`fdAuxTab_` stops being the only tab synthesizer ignoring the ctx window:
its `readAllPaged('aux_spans')` gets the same `ts_ms` window bound every
sibling tab already applies — bounded before the FD_AUX upstream lands rows.

### Files
- Edit: `src/features/shared/jobs/dbbook.ts` | `fdAuxTab_` signature + readAllPaged call (:246-254) + its dispatch case (:272-273)
- Edit: `tests/jobs/dbbook.test.ts` | extend the 'FD_AUX' case (:206-214) to assert the ts_ms bound

### Context
- `src/features/shared/jobs/dbbook.ts:33-58` | `windowFor_(ctx)` + `tsBuild_(w)` — the exact sibling pattern (`maqsamTab_` :114-133 uses `pk:'ts_ms', build: tsBuild_(windowFor_(ctx))`)
- `src/features/shared/jobs/dbbook.ts:246-254,272-273` | today `fdAuxTab_()` takes no ctx and reads unbounded; case 'FD_AUX' calls it bare
- `supabase/migrations/20261116204115_recreate_aux_spans.sql` | recreated table: `id` identity PK, `dedupe_key` UNIQUE, `ts_ms`, `cols`, `synced_at` + `idx_aux_spans_ts` — ts_ms exists and is indexed
- `tests/jobs/dbbook.test.ts:130-135` | sibling assertion pattern: `h.calls[0].filters` records `[method, col, val]` tuples — assert `['gte','ts_ms',<since>]` the same way
- `tests/jobs/helpers.ts` | the repo-mock records filters per call (used by all bound assertions)

### Contract
`fdAuxTab_(ctx: DbBookCtx)`; readAllPaged options gain `pk: 'ts_ms'` and
`build: tsBuild_(windowFor_(ctx))` — verbatim sibling shape. Dispatch case
becomes `return fdAuxTab_(ctx)`. Everything else (cols-verbatim row mapping,
missingOk_ header-only fallback) unchanged. Test: set `h.tables.aux_spans`,
call with `{ cfg: CFG, sinceMs: <ms> }`, assert `h.calls[0].filters` contains
`['gte','ts_ms',<ms>]`; keep the existing header-only case green.
Out of scope: other tabs, env.ts prefetch, engine-live, aux_spans writers.

### Actions
1. Change `fdAuxTab_` signature to take `ctx`; add `pk` + `build` to its readAllPaged; update the 'FD_AUX' dispatch case.
2. Extend the FD_AUX test to assert the gte ts_ms filter for a sinceMs ctx.
3. Run the targeted vitest file + tsc.

### Done when
- `fdAuxTab_` applies `ts_ms >= sinceMs` (or the month window) like every sibling; missing-table path still yields the header-only grid.
- `npx vitest run tests/jobs/dbbook.test.ts` -> all pass; `npx tsc --noEmit` -> 0 errors.

### Verify
- Run: `npx vitest run tests/jobs/dbbook.test.ts` -> all pass

### Handoff
All 8 tab synthesizers now window-bound their mirror reads.
Write results/perf1-03.md (<=10 lines); TL alone updates TRACKER.md.

## perf1-04: stagger cxh-scorecard-nightly off the shared 06:30 UTC slot (perf-5)
Kind: mini
ID: perf1-04
Parent: fix-perf-1
Owner: supabase-expert
Depends: none
Criteria: reports/perf-1.md finding perf-5 (LOW); PLAN #5
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=5

### Goal
`cxh-job-nightly-aggregates` and `cxh-scorecard-nightly` no longer fire the
same minute: scorecard moves to `'45 6 * * *'` (still before qa-engine's
07:30 UTC), per the report's exact fix.

### Files
- Edit: `supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql` | the scorecard `cron.schedule` literal (:153-154) + its header comment line (:18)

### Context
- `supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql:15-19` | job header table lists both jobs at `'30 6 * * *'`
- `supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql:104-122` | nightly-aggregates block STAYS `'30 6 * * *'` — untouched
- `supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql:152-170` | scorecard block — change `'30 6 * * *'` -> `'45 6 * * *'`
- TRACKER.md "Remote apply pending" | this migration has NOT been pushed remote yet (apply is a PM/deploy step), so editing it in place is correct AND the file's unschedule-by-name guard makes re-apply idempotent anyway. Verify no remote apply happened before treating an edit as sufficient — if it WAS already applied, stop and report NEEDS_USER (a corrective migration would be needed)
- `src/app/api/cron/scorecard-nightly/route.ts:8` | maxDuration=300 — the heavy job being staggered

### Contract
Change the ONE cron literal in the `cxh-scorecard-nightly` `cron.schedule`
call and its header comment to `'45 6 * * *'`. All four other jobs, the
settings-guard bodies, the unschedule list and the file's verification
comment block stay byte-identical (header job table reflects the new time).
No remote apply.
Out of scope: remote `db push`, other jobs' schedules, any other migration.

### Actions
1. Edit the scorecard schedule literal + header comment line.
2. Grep-verify the file has exactly one `'30 6 * * *'` left (nightly-aggregates) and one `'45 6 * * *'` (scorecard).

### Done when
- `cron.schedule('cxh-scorecard-nightly', '45 6 * * *', ...)` in the file; `cxh-job-nightly-aggregates` still `'30 6 * * *'`; header comment matches.
- If the migration proves already-applied remotely, results file says so explicitly and the edit is left in place for the record (PM decides on a corrective migration).

### Verify
- Run: `grep -n "schedule(" supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql` + `grep -c "'30 6 \* \* \*'"` == 1

### Handoff
Two heavy nightly jobs now fire 15 min apart on next remote apply.
Write results/perf1-04.md (<=10 lines); TL alone updates TRACKER.md.
