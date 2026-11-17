# tl-6 — FIX round for reports/perf-1.md (qa-live-sheets-freeze)

Source: `reports/perf-1.md` (perf gate round 1, FULL; verdict FAIL, 0B/1H/1M/3L).
Spec: `spec/fix-perf-1.md` (4 mini leaves, all preflight PASS — structural +
semantic vs LIMITS.md).

## Findings routed

| Finding | Sev | Leaf / owner | Status | Changed files |
|---|---|---|---|---|
| perf-1 unbounded reconcile reads + per-row UPDATEs | HIGH | user hand-back (cx-quality/**) | RESOLVED-BY-USER | `src/features/cx-quality/lib/migrate.ts` (+25/-6) — landed mid-run by the user's parallel workstream; evidence `results/fix-perf-1.md`. Bounded `qe_queue_log`/`qa_audits` reads + grouped `.in()` updates; deviation (state!=audited incl. NULL) documented, semantics preserved |
| perf-2 no maxDuration | MED | perf1-01 (dev) | done | `src/app/api/cron/job-qa-engine/route.ts` — `export const maxDuration = 300` (:14) |
| perf-3 qa_audits audit_date seq-scan | LOW | perf1-02 (supabase-expert) | done | NEW `supabase/migrations/20261117123304_idx_qa_audits_audit_date.sql` — plain `CREATE INDEX IF NOT EXISTS` (CONCURRENTLY illegal inside the runner's per-file txn; ~1-4k rows, lock trivial) |
| perf-4 fdAuxTab_ unbounded aux_spans | LOW | perf1-03 (dev) | done | `src/features/shared/jobs/dbbook.ts` + `tests/jobs/dbbook.test.ts` — `pk:'ts_ms'` + `tsBuild_(windowFor_(ctx))`; all 8 synthesizers now window-bound |
| perf-5 two heavy pg_cron jobs same minute | LOW | perf1-04 (supabase-expert) | done | `supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql` — scorecard `'30 6'`→`'45 6 * * *'` (:154 + header :18); edit-in-place valid, migration still unapplied remotely |

DELTA scope for the reviewer: the 5 files above + the new migration.
Results: `results/perf1-01..04.md` (perf1-01..03 wrote to repo-root `results/`,
perf1-04 to spec `results/` — merged in TRACKER).

## Integration gates (round 7)

- `npx tsc --noEmit` — PASS, 0 errors (gate7-tsc.log; includes user's migrate.ts)
- `npx eslint .` — PASS, 0 errors; same 5 pre-existing warnings in untouched files (gate7-eslint.log)
- `npx vitest run` — 1449/1450; sole FAIL `tests/quality/qe-fd-cache.test.ts`
  (known-external cx-quality/parallel-workstream failure, identical all rounds;
  gate7-vitest.log). +1 new perf1-03 FD_AUX-bound case green.

## Hand-offs

- **Remote apply**: the pending `db push` batch now includes the new index
  migration; perf-5's stagger ships inside the already-pending pg_cron file.
  PM/deploy step (verify `Target:` + `env -u SUPABASE_ACCESS_TOKEN`).
- **perf-1**: no action needed — user workstream implemented it; the new
  index (perf-3) also serves the bounded reconcile's audit_date filter.
- No reviewer/gate shards spawned (PM runs those). No RESHARD_NEEDED.
