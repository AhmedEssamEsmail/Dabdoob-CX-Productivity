# tl-5 report - perf-remediation FIX round 5 (source: reports/data-1.md, every row blocking)

Status: all 6 findings fixed; all integration gates green.

## Leaves (all `Kind: mini`, preflight PASS — logs in results/)

| Leaf | Owner | Finding | Files changed | Evidence |
|---|---|---|---|---|
| FIX-09 | dev | data-1 BLOCKER | src/features/shared/platform/repo.ts; tests/platform/repo.test.ts | updateRows groups patchByKey rows by sorted patch-key signature -> one upsert per group (uniform key-sets; no default-fill, no 400, keeps FIX-06 key+patch-only contract). Regression test asserts per-call uniform key-sets. repo.test 16/16. |
| FIX-10 | supabase-expert | data-2 MED | supabase/migrations/20261108204952_dedupe_uniques_prod_daily_layers_queue_submissions.sql | section-1 DELETE `a.id > b.id` -> `a.id < b.id` (keep-latest survivor, matches memoUpsert LWW + queue_submissions block); comment updated. File unapplied. |
| FIX-11 | supabase-expert | data-3 LOW | supabase/migrations/20261108205536_lookup_indexes_tickets_refresh_queue.sql | idx_refresh_log_job_finished_at (job,finished_at) -> idx_refresh_log_started_at (started_at), matching the only reader (page.ts:148 unfiltered started_at DESC LIMIT 300). File unapplied. |
| FIX-12 | supabase-expert | data-4 LOW | NEW supabase/migrations/20261108234911_roster_email_unique.sql | dedupe guard on email IS NOT DISTINCT FROM keep-highest-id (+ctid fallback for the 001 email-PK shape) + CREATE UNIQUE INDEX IF NOT EXISTS roster_email_uidx. Registered, unapplied. |
| FIX-13 | data-engineer | data-5 LOW | src/features/shared/jobs/env.ts; tests/jobs/helpers.ts; tests/jobs/tph-jobs.test.ts | keyOf -> JSON.stringify(keys.map(k => r[k] ?? null)) in prod + mirrored stub; regression: ('ab','c')/('a','bc') both survive upsert. tph-jobs 7/7. |
| FIX-14 | dev | data-6 LOW | src/features/shared/platform/popups.ts; tests/golden/reminders-off-popups.test.ts | cache key POPUPS_POLL_KEY + normEmail(email), matching resolvePopups invalidation; mixed-case regression test. 4/4. |

Dispatch: wave 1 = FIX-09/10/13/14 (4 workers, disjoint files); wave 2 = FIX-11 + FIX-12. No RESHARD_NEEDED, no retried attempts, no scope violations.

## Integration gates (round 5, logs/fix5-*)
- tsc --noEmit: PASS (0 errors)
- vitest run: PASS (54 files, 1126/1126)
- eslint .: PASS (0 errors; 366 warnings pre-existing)
- test:security: PASS (4/4)
- next build: PASS (154/154 pages)

## DELTA scope for reviewer
Changed this round: repo.ts (updateRows grouping only), popups.ts (one line),
env.ts (one line), tests/platform/repo.test.ts, tests/jobs/helpers.ts,
tests/jobs/tph-jobs.test.ts, tests/golden/reminders-off-popups.test.ts,
migrations 20261108204952 + 20261108205536 (edited in place, both unapplied),
NEW migration 20261108234911_roster_email_unique.sql.

## Caveats / handoffs
- data-1: PostgREST union-default behaviour is unverifiable without live DB —
  fix makes every upsert request key-uniform, which removes BOTH failure modes
  by construction; mocked-test coverage only (as report anticipated).
- NEEDS_APPROVAL (new): apply 20261108234911_roster_email_unique.sql remotely.
- NEEDS_APPROVAL (amended): previously listed migrations 20261108204952 and
  20261108205536 now carry edited contents — earlier approval rows apply to the
  new contents.
- No reviewer/debugger/architect shards were requested or spawned.
