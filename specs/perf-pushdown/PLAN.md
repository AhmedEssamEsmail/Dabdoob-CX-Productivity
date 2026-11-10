# PLAN: perf-pushdown
Type: feature (perf/data remediation)   Status: spec
Date: 2026-11-10   Project root: C:\Users\AHMED\KPIs\CX-Hub
Source audit: `docs/PERFORMANCE_PLAN.md` (items P-01..P-22, tasks T0..T13). That file is the
authoritative item list; this plan adds criteria, flags and gates. Planning only: user asked
for a spec, NOT implementation. Do not dispatch BUILD until the user approves.
Prior related work: `specs/perf-remediation/` (Nov-8 audit; already shipped getClaims, lazy
job env, poller merge, some uniques). Do not redo or regress it; check its TRACKER before
re-touching the same functions.

## Goal
Stop reading whole tables and filtering in JS on the hot API, page and cron paths; push the
predicates the code already applies into SQL, parallelise independent reads, add short TTL
caches, fix silent truncation from PostgREST max-rows, and trim bundle/cold-start cost. All
responses must stay byte-equivalent (same rows, same KPI values) except where truncation was a bug.

## Success criteria
1. T0 baseline `docs/PERF_BASELINE.md` exists: PostgREST max-rows, top-40 `n_live_tup`, indexes
   for the 7 listed tables, the 2 precondition counts (sc_daily non-ISO dates, roster non-lower
   emails), 3-run `time_total`/`size_download` for the 7 endpoints, `next build` route table.
   Items whose tables are <~5000 rows are downgraded; P-16/P-17 dropped if small (recorded).
2. P-01/P-12/P-14: shared `readAllPaged` helper in `repo.ts` (PK-ordered `.range` pages);
   `readStore`/`readRows`/`buildJobEnv` full-table reads return `count(*)` rows (no truncation);
   job preloads apply per-table date bounds; upsert fallback paths log once per `(table, keys)`.
3. Read pushdown with JS filter kept as a guard, results unchanged:
   P-02 prod analytics (projected cols, bounded `prod_window_hist`, 120 s cache),
   P-03 TPH store (`window: 'day'|'trend'`, `configAll()`, projected cols, no unused refresh_log),
   P-04/P-15 hub aggregates + roster/kpilogs lookups (`StoreFilter` gains `gte`/`lte`),
   P-05 quality call sites via `qaRowsWhere_` (+`lte`), P-06 QE log lookups, P-07 scorecard range,
   P-10 queue pages. Each changed query uses an index per `EXPLAIN` (recorded in the leaf report).
4. P-08/P-21: `pwDirectory` wrapped in React `cache()`; `roleForEmail` uses `.eq('email')` with
   projected columns (only if T0 precondition = 0, else fallback kept, and `_` wildcard bug gone);
   raw config/roster re-queries replaced by `configAll()`/`pwDirectory()`. Roster reads per
   authenticated request = 1. Role/view-as behaviour unchanged.
5. P-09/P-10: independent awaits grouped in `Promise.all`; P-11 `dqCachedLive` 30-60 s TTL cache
   invalidated in `flushWrites`; no `'use cache'` on user-scoped data.
6. P-13: `qaUpsertIn_` uses one bulk `upsert(onConflict)` where keys match a unique constraint,
   loop fallback only on `42P10`. P-22: `migration/migrate.ts` bulk upserts with error checks.
7. Indexes (P-14/P-16/P-17) only where T0 confirms need: new migration files created via
   `npx supabase migration new`, each preceded by a duplicate-check / pg_indexes query result.
   Migrations are NOT applied or merged without user approval.
8. P-18 `/ecosystem` loads `ecosystem-page` via `next/dynamic` `ssr:false` client wrapper (First
   Load JS for `/ecosystem` drops, other routes unchanged); P-20 `googleapis` imported lazily.
9. P-19: profiling report only (React Profiler on `/tph-grid`, `/audit-queue`); code changes
   only for commits >50 ms, using existing `PagedList.tsx`, no new deps.
10. Regression tests per pushdown leaf prove identical output vs the old whole-table path on
    fixtures (incl. undated `sc_behaviour` rows, non-ISO date keys, emails with `_`); all gates green.

## Scope / Non-goals
In: P-01..P-22 / T0..T13 of `docs/PERFORMANCE_PLAN.md`, regression tests, baseline doc.
Out: SQL views/RPC roll-ups (P-02(d) "later"), new npm deps, RLS changes, UI redesign, THREE
namespace rewrite in ecosystem-page, any production deploy or remote DB write, commits.

## Risk flags (y/n)
arch n · db y · data y · auth y · external-api n · ui y · perf y · deps n · tests y · docs y · deploy n
Review gates: QA (always) · Security: run (identity/roleForEmail, cache keys must include scope/role
so no cross-user leakage) · Data: run (KPI output parity after pushdown, truncation fix changes
counts) · Performance: run (before/after vs T0 baseline) · UX/UI: run (ecosystem loading state,
any P-19 render change; skip-able if P-19 yields no code)
Budgets (perf flag): each pushed-down endpoint warm `time_total` and `size_download` <= T0 baseline,
target >=50% payload drop for P-02/P-03/P-04; Supabase requests per `/tph-grid` load reduced;
`/ecosystem` First Load JS reduced, no other route grows >2%.

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`
integration: `npm run test:integration`  e2e: `npm run test:e2e` (routes touched)
security: `npm run test:security`  build: `npm run build`  perf: `npm run test:performance`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Next.js 16: read `node_modules/next/dist/docs/` before Next code (dynamic, cache); cite path in shard.
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`. No new deps.
- Migrations only via `npx supabase migration new <name>` (tool names the file); never dashboard SQL.
- T0 remote SELECTs and dashboard max-rows read need explicit user approval (NEEDS_APPROVAL);
  direct PG: `aws-1-eu-central-1.pooler.supabase.com:5432` user `postgres.<ref>`; remote CLI needs
  `--remote` + `env -u SUPABASE_ACCESS_TOKEN`, check `Target:` line.
- Serial file chains: T2->T6->T10 (`cx-quality/lib/server.ts`); T7->T8->T9 (`stores.ts`, `env.ts`).
- One call site per leaf for P-05; keep JS filter after every SQL predicate.
- No module-top-level env-dependent clients (lazy-init). `server-only` stubbed for vitest/tsx.
- Heavy output (build, vitest, diffs) to log files + bounded tail; logs under ignored dirs.
- Run `npm ci` first if `node_modules` is empty/stale.

## Research notes
- Supabase PostgREST default max-rows = 1000; `.limit(n)` above it is silently capped.
- React `cache()` dedupes per request only; cross-request caching uses `repo.ts` `cacheGet`/`cachePut`.

## Key pointers
- `docs/PERFORMANCE_PLAN.md` - every item's files, lines, fix and verify step (authoritative).
- `src/features/shared/platform/repo.ts:35-55` - in-process cache; `:129` readRows; `:255-297` fallbacks.
- `src/features/shared/platform/stores.ts:29,49,72` - readStore, readStoreFiltered, dqCachedLive.
- `src/features/shared/jobs/env.ts:272-285,388,476-621` - job preload, flushWrites, upsert fallback.
- `src/features/shared/platform/identity.ts:77,95,185` - cache import, roleForEmail, pwDirectory.
- `src/features/cx-quality/lib/server.ts:84-150,370-432` - qaRows_, qaRowsWhere_, qaUpsertIn_, QE.
- `specs/perf-remediation/TRACKER.md` - what the prior perf pass already changed.
