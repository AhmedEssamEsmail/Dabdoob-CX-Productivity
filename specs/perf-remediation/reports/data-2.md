# data report - perf-remediation - round 2 (DELTA)

Verdict: PASS
Open: 0 BLOCKER / 0 HIGH / 0 MED / 2 LOW

Scope: data-1..data-6 fixes from tl-5. Changed files: repo.ts (updateRows
grouping), popups.ts (cache-key norm), env.ts (keyOf), migrations
20261108204952 + 20261108205536 (edited), NEW 20261108234911
roster_email_unique, 4 test files.

Prior-finding verification (all 6 CLOSED):
- data-1 BLOCKER -> FIXED. repo.ts:240-246 groups patchByKey rows by sorted
  patch-key signature; each .upsert() carries a uniform column set, so both
  PostgREST failure modes (default-fill clobber / 400) are removed by
  construction. 42P10/constraint fallback to one-by-one retained. Regression
  test repo.test.ts:227-256 asserts 2 homogeneous upserts; ran it: 16/16 PASS.
- data-2 MED -> FIXED. 20261108204952:19 now `a.id < b.id` (highest id =
  latest write survives), consistent with the queue_submissions block
  (coalesce(updated_at,submitted_at) desc). Comment updated.
- data-3 LOW -> FIXED. idx_refresh_log_started_at replaces (job,finished_at).
  Serves both started_at-desc readers (page.ts:148, source-health
  route.ts:205). Grep-verified: no reader filters refresh_log by job
  (dqLastRun reads config dq_last_* keys).
- data-4 LOW -> FIXED. NEW 20261108234911 dedupes roster on email
  (keep-highest-id, IS NOT DISTINCT FROM) with information_schema branch +
  ctid fallback for the 001 email-PK shape, then roster_email_uidx
  IF NOT EXISTS. Idempotent.
- data-5 LOW -> FIXED. env.ts:292 keyOf -> JSON.stringify(keys.map(k =>
  r[k] ?? null)); mirrored in tests/jobs/helpers.ts:58; regression
  tph-jobs.test.ts:142-149 covers ('ab','c')/('a','bc').
- data-6 LOW -> FIXED. popups.ts:130 key = POPUPS_POLL_KEY + normEmail(email),
  matching resolvePopups invalidation (line 113); mixed-case regression test
  ran: 4/4 PASS.

Reconciliation (static; no live DB — .env is agent-forbidden):
- Upsert onConflict targets vs migration uniques — re-verified MATCH:
  prod_daily_layers (date,email,layer), queue_submissions (slot_date,slot),
  roster (email) via new file.
- Independent test re-run (this review): repo.test 16/16 +
  reminders-off-popups 4/4 green (logs/data2-vitest.log).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| data-7 | LOW | src/features/shared/platform/repo.ts:242 | Group signature is `Object.keys(patch).sort().join('')` — concat collision, same class as data-5: columns ('ab','c') vs ('a','bc') both -> 'abc' would merge distinct key-sets into one upsert, silently reintroducing the data-1 bug. | Use `JSON.stringify(Object.keys(patch).sort())` for the signature, matching the env.ts fix. | dev |
| data-8 | LOW | src/features/shared/platform/health.ts:487 vs 20261108205536 | refresh_log tail ordered `finished_at` desc (limit 400) has no serving index after data-3 fix. Non-regression: old (job,finished_at) didn't serve it either (job leftmost); table is small. PLAN #7 contract index dropped, actual readers covered. | Reorder the read to started_at (same heartbeat evidence, one index serves all 3 readers) or accept and document. | dev |

Not verified / assumptions:
- Migration files remain unapplied (NEEDS_APPROVAL incl. amended 20261108204952
  / 20261108205536 contents and new 20261108234911). Dedupe counts and uidx
  builds unverifiable until applied.
- roster_email_uidx is case-sensitive; pre-existing remote rows differing only
  by email case would coexist (normEmail governs future writes). Not
  introduced by the migration.
- Post-deploy metrics (prod_intervals full scans ~0, tph-day payload <500KB)
  still unverifiable without live pg_stat access.
