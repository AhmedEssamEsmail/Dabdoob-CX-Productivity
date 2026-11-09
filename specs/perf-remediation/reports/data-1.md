# data report - perf-remediation - round 1 (FULL)

Verdict: FAIL
Open: 1 BLOCKER / 0 HIGH / 1 MED / 4 LOW

Scope: PLAN data criteria (#2 lazy job env, #3 filtered reads, #4 batched writes,
#7 dedupe/uniques/indexes, #9 cron scheduling, #10 shared cache) across tl-1..tl-4
changed files: env.ts, tph.ts/index.ts, page.ts, repo.ts, popups.ts, stores.ts,
jobs.ts, myday.ts, shared-cache.ts, server.ts (checkin), notify.ts, 6 migration
files, cron routes, vercel.json.

Reconciliation (static; no live-DB access — read-only, creds are .env-forbidden):
- Upsert conflict targets vs existing/added unique constraints — ALL MATCH:
  prod_tph_days (date,agent_email), prod_tph_cases (date,source),
  prod_tph_touches (date), prod_tph_calls (date) via 014; prod_daily_layers
  (date,email,layer) + queue_submissions (slot_date,slot) via 20261108204952;
  queue_snapshots (snapshot_key,queue), agg_inflow_daily (date,channel,country),
  agg_inflow_hourly (date,hour,channel,country,year), config.key via 003/007.
- Upsert keys hard-coded in env.ts:354 match the new uidx; tph engine key lists
  (index.ts:1348,1519,1581,1716,1762) match 014 uniques.
- job-tph-hourly: buildJobEnv({roster:false}) + prefetchTables(['agg_queue_now',
  'prod_tph_cases']) = 2 tables — meets <=3-tables criterion (was 12+roster).
- job-tph-past-days: budgetMs 55_000 (route.ts:29) <=60s, per-step chunking
  ("left for next hour") — meets criterion 9 alternative.
- Lazy prodRows loads: opts.tables/prefetchTables only; unfetched table -> []
  + tableErrors 'not prefetched' — matches dqReadObjects_ missingOk contract.
- vercel.json: job-data-tick entry removed; 4 reminder crons + tph-hourly x2/h
  kept; pg_cron migration schedules cxh-job-data-tick */15 + health 7-59/15.
- app_cache: service-role-only (RLS on, no policies); dbCachePut upserts on
  PK key; TTL + expiry check client-side — correct cross-instance replacement.
- resolvePopups: single .update() (no per-row loop) — criterion 4 met.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| data-1 | BLOCKER | src/features/shared/platform/repo.ts:236-242 | Batched updateRows upserts rows containing only key+patched cols. Live callers send HETEROGENEOUS patch key-sets in one call (actions.ts:274 carried {due_date} vs done {status,outcome_note}; one-on-ones-delete.ts:198 {status,...,source_deleted_at} vs {source_deleted_at}; roster.ts:331 per-field diffs). On tables whose keyField is unique (actions.action_id PK, one_on_one_schedule, meetings, config) PostgREST unions the keys and fills missing cols with column DEFAULTS on conflict-update -> unpatched columns silently reset (e.g. carried action's status -> default). Alternate PostgREST outcome (400 on mismatched keys) is not caught by the 42P10/constraint fallback -> whole batch fails where per-row would have worked. Mocked tests (repo.test.ts:202) assert the unsafe payload shape, can't observe it. | Build the union of all patch keys; pad each upsert row with the fetched `current` values for missing keys (still 2 calls, no default-fill), or group rows by identical patch-key signature and upsert per group. Add one integration test against real PostgREST covering heterogeneous patches. | dev |
| data-2 | MED | supabase/migrations/20261108204952_dedupe_uniques_prod_daily_layers_queue_submissions.sql:13-18 | prod_daily_layers dedupe keeps the LOWEST id (earliest write). Upsert semantics (memoUpsert last-write-wins; delete+insert fallback) make the LATEST write authoritative — a recomputed layer row has the higher id, so the dedupe deletes the freshest row and keeps the stale one. queue_submissions in the same file correctly keeps latest (coalesce(updated_at,submitted_at), id desc) — inconsistent survivor rules. | Flip to keep-latest: `a.id < b.id` (or order by computed_at desc, id desc) so the freshest row survives. | supabase-expert |
| data-3 | LOW | src/features/cx-productivity/lib/tph/page.ts:148 vs supabase/migrations/20261108205536_lookup_indexes_tickets_refresh_queue.sql:25-26 | The only refresh_log reader orders `started_at` desc (unfiltered tail 300); the shipped index is (job, finished_at) — unusable for this query, and no current caller filters by job. refresh_log grows unbounded. | Order the tail read by finished_at (same data), or change the index to match the actual query. | supabase-expert |
| data-4 | LOW | supabase/migrations/001_core_tables.sql:37 (plain idx_roster_email) + repo.ts:240-247 | roster.email has no unique constraint -> every roster-sync batch hits the upsert, gets 42P10, falls back to per-row updates. Correct but wastes a failing round-trip; batch path never applies. | Add UNIQUE on roster(email) after a dup check (or accept fallback — document). | supabase-expert |
| data-5 | LOW | src/features/shared/jobs/env.ts:292 | keyOf joins composite key values with '' — ('ab','c') vs ('a','bc') collide in memoUpsert -> wrong row replaced in the run memo -> mismatched write set. | Join with a non-printable separator (e.g. '\u0001') or JSON.stringify the key tuple (as tuplesOf already does). | data-engineer |
| data-6 | LOW | src/features/shared/platform/popups.ts:113,130 | popupsPoll caches under raw `email`; resolvePopups invalidates under normEmail(recipient). If the caller email differs in case, resolved popups linger up to POPUPS_POLL_S (300s). | Normalize the cache key at both ends (POPUPS_POLL_KEY + normEmail(email)). | dev |

Not verified / assumptions:
- PostgREST union-default upsert behavior (data-1) is documented behavior; verify
  on a live/staging PostgREST — both possible outcomes (default-fill clobber or
  batch 400) are defects. All repo tests stub db() so it is invisible to vitest.
- tph-day payload <500KB and prod_intervals ~0 full scans are post-deploy metrics
  — no live DB/pg_stat access here; query filters (.gte('date', lo), column
  lists) are in place per code review.
- /api/bootstrap <=150ms is a perf gate, not audited.
- Migration files are unapplied (NEEDS_APPROVAL); dedupe counts, cron.job rows,
  and pg_net responses unverifiable until applied. data-2 only matters if remote
  prod_daily_layers actually contains duplicates — unknown.
- dqRewrite_ delete+insert is non-atomic; a reader between ops sees an empty
  store (agg_queue_now -> empty snapshot capture is skipped via rows.length
  guard, agg_inflow_weekly/monthly could transiently serve []). Legacy parity.
- buildAgentAggregates_ still reads all of prod_daily_layers nightly (grows
  ~55k rows/yr); not in plan's hot-caller scope — scaling nit only.
- env.ts takeDirty slices config.prod_dirty_dates at 31 — PROD_DIRTY_MAX parity.
