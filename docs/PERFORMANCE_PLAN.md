# CX-Hub Performance Plan

Status: PLAN ONLY. Nothing in source, schema or config was changed.
Date: 2026-11-10. Paths are relative to `CX-Hub/`.

## How this audit was done (and its limits)

- Targeted grep + partial reads of: `src/app/api/**`, `src/features/cx-*/lib`, `src/features/shared/{platform,jobs,lib}`, `supabase/migrations`, `next.config.ts`, `package.json`, `vercel.json`, `migration/*.ts`. The repo was not read end to end.
- No database access was used. **Row counts, query timings and the PostgREST `max-rows` setting are unknown.** Every impact rating below is an estimate from code shape, not a measurement. Task T0 collects the numbers that confirm or downgrade them.
- Large client components were sized and grepped for memoization only; their render paths were not read. Item P-19 is therefore a profiling task, not a confirmed defect.

### Areas checked with no finding

- **RLS per-row subqueries:** none. All app data access uses the service-role singleton (`src/features/shared/lib/supabase.ts:12-17`), which bypasses RLS; the only policies found were `app_all ... USING (true)` (e.g. `supabase/migrations/20261105172148_queue.sql:178-199`), later dropped by `20261108205852_rls_lockdown_drop_app_all_policies.sql`.
- **ETL backfills:** `migration/backfill-fd-history.ts:185`, `backfill-fc-messages.ts:152`, `backfill-freshchat-sheet.ts:116`, `backfill-qe-cache-orphans.ts:212-219` already batch. Job writes are batched too (`src/features/shared/jobs/env.ts:580-603`).
- **Missing indexes:** fewer than expected. Most filter columns already have an index or unique constraint (`qe_queue_log (key, queued_date)`, `qe_candidates (queued_date, agent)`, `sc_daily (date, email)`, `prod_*` date indexes in `20261108205258_lookup_indexes_prod_roster_agg.sql`). **The dominant DB problem is that the code reads whole tables and filters in JS, so those indexes are never used** (P-02..P-07).
- **Supabase client:** already a module singleton; per-request identity is wrapped in React `cache()` (`src/features/shared/platform/identity.ts:33,77`).

---

## Items (highest impact first)

Impact H/M/L, effort S/M/L.

### P-01 - DB / correctness precondition - `src/features/shared/jobs/env.ts:275`, `:481`, `:498`; `src/features/shared/platform/stores.ts:29`; `src/features/shared/platform/repo.ts:129`
- **Status:** shipped (spec/S02.md#S02-01, results/S02-01.md; spec/S12.md#S12-01, results/S12-01.md)
- **Problem:** Unbounded `select('*')` and `.limit(200000)` depend on PostgREST `max-rows`. At the Supabase default (1000) these reads are silently truncated; if it was raised, each call can ship up to 200k full rows. Either way the current shape is wrong. Impact **H**, effort **S** (to measure).
- **Fix:** Measure first (T0). Then page explicitly with `.range(from, from + 999)` in a loop inside one shared helper (`readAllPaged(table, build)` in `repo.ts`), ordered by the primary key, and make `readStore`/`readRows`/`buildJobEnv` use it only where a full table is really needed.
- **Verify:** Dashboard > Project Settings > API > "Max rows". For each table in T0, compare `select count(*)` with the `.length` returned by `readStore(name)`; they must match.

### P-02 - DB / API - `src/app/api/prod/analytics/route.ts:52-57`
- **Status:** shipped (spec/S06.md#S06-01, results/S06-01.md)
- **Problem:** Every page view pulls 4 weeks of `prod_intervals`, `prod_flags`, `prod_daily_layers` with `select('*')` (limits 50k/20k/50k) plus **all** of `prod_window_hist` (no date filter, `:56`), then aggregates in JS (`:68-71`). No caching. Impact **H**, effort **M**.
- **Fix:** (a) Replace `'*'` with the exact columns `prodAnalyticsFor_`/`prodAnalytics_` read (grep `r\.\w+` / `r\['` in `src/features/cx-productivity/lib/prod/analytics.ts` and `engine.ts`). (b) Bound `prod_window_hist` by its date/week column once confirmed in the migration. (c) Cache the computed `out` object for 120 s keyed `prod_an|${week}|${scope-key}|${full}` using `cacheGet`/`cachePut` from `src/features/shared/platform/repo.ts:38-55`. (d) Later: move the weekly roll-up to a SQL view or RPC.
- **Verify:** `curl -w '%{time_total} %{size_download}\n'` on `/api/prod/analytics?week=...` before/after, cold and warm. `EXPLAIN (ANALYZE, BUFFERS) select <cols> from prod_intervals where date >= '<from>' and date <= '<to>'` must show `idx_prod_intervals_date`.

### P-03 - DB / API - `src/features/cx-productivity/lib/tph/page.ts:129-149`; callers `src/app/api/tph/{page,slots,touches,trend,cases,tasks,run-day,run-step}/route.ts`
- **Status:** shipped (spec/S07.md#S07-01, spec/S07.md#S07-02; results/S07-01.md, results/S07-02.md)
- **Problem:** `tphLoadStore_` loads 5 tables with `select('*')` for at least 28 days (limits 20k/5k/5k/5k/10k) plus 300 `refresh_log` rows, and **eight routes each call it**, including single-day endpoints. `config` is awaited alone before the batch (`:130`), bypassing the 5-minute config cache. Impact **H**, effort **M**.
- **Fix:** Add an options argument `tphLoadStore_(date, { window: 'day' | 'trend' })`; for `slots`, `touches`, `cases`, `tasks`, `run-step` use `.eq('date', dp)` (or `.gte(dp).lte(dp)`) instead of `.gte('date', lo)`. Use `configAll()` (`src/features/shared/platform/settings.ts:152`) instead of the raw config query. Project columns instead of `'*'`. Drop `refresh_log` from routes that do not return it.
- **Verify:** Count Supabase requests per page load in the Network tab of `/tph-grid`; response time of `/api/tph/slots` before/after.

### P-04 - DB - `src/features/cx-hub/lib/aggregates.ts:164-170`, `:373-374`
- **Status:** shipped (spec/S10.md#S10-01, spec/S10.md#S10-02, spec/S10.md#S10-03; results/S10-01.md, results/S10-02.md, results/S10-03.md)
- **Problem:** Hub home aggregates read seven whole tables through `readStore` (`aging_open_tickets`, `roster`, submissions, flags, `sc_daily`, `prod_daily_layers`, `fcr_daily`) and `queue_snapshots` + `agg_queue_now`, then slice by date in JS. `sc_daily`, `prod_daily_layers`, `fcr_daily`, `queue_snapshots` grow daily. Impact **H**, effort **M**.
- **Fix:** Replace with `readStoreFiltered`-style date-bounded queries. `readStoreFiltered` (`src/features/shared/platform/stores.ts:49`) supports only `eq/in/is`; add `gte`/`lte` to `StoreFilter` and pass the window the function already computes. For `queue_snapshots` filter `slot_date = today` (index `idx_queue_snapshots_date`).
- **Verify:** `EXPLAIN ANALYZE select * from sc_daily where date >= '<from>'` uses `idx_sc_daily_range`; payload size of `/api/hub/home` before/after.

### P-05 - DB - `src/features/cx-quality/lib/server.ts:84-92` (`qaRows_`), hot call sites `:1600`, `:1684-1685`, `:1759`, `:1802-1804`, `:1829`, `:2212`, `:2241`, `:2264`
- **Status:** shipped (spec/S08.md#S08-01..S08-12; results/S08-01.md..S08-12.md, results/qa-blank-01.md)
- **Problem:** `qaRows_` reads an entire table; `qa_audits` is read whole on nearly every quality endpoint and filtered by date range / agent in JS, although `qa_audits_agent_idx (agent_email, audit_date)` and `qa_audits_auditor_idx` exist. Impact **H**, effort **M**.
- **Fix:** Use the existing `qaRowsWhere_` (`:95-112`, already supports `eq/in/is/gte`); add `lte`. Per call site push down the predicate the JS already applies: `:1759` `gte/lte audit_date` from `from`/`to`; `:1023` `eq agent_email`; `:833` `eq audit_id`; `:922` `eq ticket_id`; `:2165`,`:2200` `eq status 'open'`. Do one call site per commit; keep the JS filter in place as a second guard.
- **Verify:** Golden/integration tests (`npm run test:integration`) unchanged; `EXPLAIN ANALYZE select * from qa_audits where audit_date between ...`; endpoint timings for `/api/qa/scores`-type actions.

### P-06 - DB - `src/features/cx-quality/lib/server.ts:425`, `:378`, `:403`
- **Status:** shipped (spec/S04.md#S04-01, spec/S04.md#S04-02; results/S04-01.md, results/S04-02.md)
- **Problem:** `qePassAndReplace_` loads the whole `qe_queue_log` to find one pending row (`:425`); `qeQueueValues_` pulls up to 60 000 rows (`:378`); `qeReadOutcomes_` reads all outcomes then filters `queued_date >= fromKey` in JS (`:403`). Impact **H** for `:425` (runs on a user click), **M** for the others; effort **S**.
- **Fix:** `:425` -> `db().from(QE_TBL_LOG).select('*').eq('state','pending').gte('queued_date', queuedDate).lt('queued_date', <queuedDate + 1 day>)` (index `qe_queue_log_date_idx`), then keep the existing loop. `:403` -> `.gte('queued_date', fromKey)`. `:378` -> pass a date lower bound from each caller instead of a 60k row cap.
- **Verify:** `EXPLAIN ANALYZE` for the three queries; time the "pass and replace" action in the audit queue UI.

### P-07 - DB - `src/features/cx-people/lib/scorecard-server.ts:206-212`
- **Status:** shipped (spec/S03.md#S03-01, results/S03-01.md)
- **Problem:** `scReadRange_` reads all of `sc_daily` / `sc_behaviour` and filters by date in JS; `idx_sc_daily_range (date, email)` is unused. Called from scorecard pages and the 1:1 context (`src/features/cx-people/lib/one-on-ones-page.ts:368`). Impact **H**, effort **S**.
- **Fix:** For `sc_daily`: `db().from('sc_daily').select('*').gte('date', from).lte('date', to)`. For `sc_behaviour` keep undated rows: `.or(`date.is.null,date.eq.,and(date.gte.${from},date.lte.${to})`)`. Keep the JS filter after it. Precondition: `select count(*) from sc_daily where date !~ '^\d{4}-\d{2}-\d{2}$'` returns 0 (the JS normalises with `dqKeyPart_`; text comparison in SQL needs ISO keys).
- **Verify:** That precondition query; `EXPLAIN ANALYZE`; scorecard golden tests.

### P-08 - API / auth - `src/features/shared/platform/identity.ts:95-98`, `:185-190`
- **Status:** shipped (spec/S05.md#S05-01, results/S05-01.md)
- **Problem:** Every authenticated request runs `roster ... select('*').ilike('email', email)` (not cached across requests; `ilike` cannot use `roster_email_uidx` or `idx_roster_lower_email`, and `_` in an address acts as a wildcard), then most handlers call `pwDirectory()`, which reads the whole roster again and is **not** wrapped in `cache()` (45 call sites in `cx-quality/lib/server.ts` alone, e.g. `:506`, `:534`, `:1622`). Impact **M**, effort **S**.
- **Fix:** (1) `export const pwDirectory = cache(async () => { ... })` using the same `cache` import as `:77`. (2) In `roleForEmail` use `.select('email,name,role,tl_email,active').eq('email', email)`; precondition `select count(*) from roster where email <> lower(trim(email))` = 0, otherwise keep a fallback to the current path. (3) Optional: TTL-cache roster rows 60 s via `cacheGet`/`cachePut`, busting in the roster write paths (`src/features/cx-hub/lib/roster.ts`).
- **Verify:** Log/count Supabase calls per request for `/api/qa/<action>` before/after (expect roster reads to drop to 1). `EXPLAIN select ... from roster where email = '<x>'` shows an index scan.

### P-09 - API - `src/features/cx-quality/lib/server.ts:1802-1804`, `:1684-1685`
- **Status:** shipped (spec/S08.md#S08-03, spec/S08.md#S08-04; results/S08-03.md, results/S08-04.md)
- **Problem:** Seven whole-table reads awaited one after another inside an argument list (`:1802-1804`), four in `:1684-1685`. Impact **M**, effort **S**.
- **Fix:** `const [audits, formRows, disputes, ctls, cals, gaps, volume, handledOf] = await Promise.all([...])` before the call; pass the results. Combine with P-05 predicates.
- **Verify:** Endpoint wall time before/after (expect roughly max instead of sum of the query times).

### P-10 - API - `src/features/cx-queue/lib/pages.ts:43`, `:50`, `:65`, `:75`, `:97-103`
- **Status:** shipped (spec/S11.md#S11-03, results/S11-03.md)
- **Problem:** `getAgingPage` and `getAnalyticsPage` await 5-6 independent reads sequentially (`dqCachedLive`, `rosterRows_`, `readStore`, two `dqLastRun`). `rosterRows_` (`:31-35`) is another uncached `select('*')` on roster. Impact **M**, effort **S**.
- **Fix:** Group independent reads in one `Promise.all` per function; reuse `pwDirectory()`/cached roster from P-08 instead of `rosterRows_`. In `getAnalyticsPage` push the lower bounds into SQL (`agg_inflow_daily.date >= today-119`; unique `(date, channel, country)` covers it).
- **Verify:** `/api/queue/aging` and `/api/queue/analytics` timings; `EXPLAIN` on the daily inflow query.

### P-11 - Caching - `src/features/shared/platform/stores.ts:72-75`; `src/features/shared/platform/repo.ts:35`
- **Status:** shipped (spec/S11.md#S11-01, spec/S11.md#S11-02; results/S11-01.md, results/S11-02.md)
- **Problem:** `dqCachedLive` no longer caches (the comment at `stores.ts:7-9` says the layer was dropped), so each page view re-reads full `agg_*` / `aging_open_tickets` tables that change only when a cron job runs. The only cache is a per-instance `Map` (`repo.ts:35`); `app_cache` (migration `20261108205645_app_cache_table.sql`) and Next cache APIs are unused (`grep "use cache|cacheTag|unstable_cache|revalidate" src` finds no usage although `cacheComponents: true` is set in `next.config.ts:5`). Impact **M**, effort **M**.
- **Fix:** In `dqCachedLive(name)` add a 30-60 s `cacheGet`/`cachePut` entry keyed `live|${name}`; call `cacheRemove` for the written tables at the end of `flushWrites` (`src/features/shared/jobs/env.ts:388`). Do not introduce `'use cache'` on user-scoped data without reading `node_modules/next/dist/docs/` first (see `AGENTS.md`).
- **Verify:** Supabase API request count for `/queue` across 5 reloads within 30 s (expect 1 read per table).

### P-12 - Jobs - `src/features/shared/jobs/env.ts:272-285`, `:476-492`; `vercel.json` (48 daily `job-tph-hourly` entries)
- **Status:** shipped (spec/S12.md#S12-01, results/S12-01.md)
- **Problem:** Each job run preloads whole tables with `select('*').limit(200000)`; only `prod_intervals` is date-bounded (`:276`, `:482`). The hourly TPH job runs 48 times a day. Impact **M-H** (grows with history), effort **M**.
- **Fix:** Add a per-table bound map next to `intervalBound`, e.g. `{ prod_flags: 'date', prod_daily_layers: 'date', prod_tph_days: 'date', tickets: 'created_at' }`, and apply `.gte(col, bound)` in both loaders. Derive each bound from what the job functions read (start with the tables passed in `opts.tables` by `src/app/api/cron/job-tph-hourly/route.ts`).
- **Verify:** Function duration and memory for the cron in Vercel logs before/after; row counts loaded (temporary `console.log(name, rows.length)`).

### P-13 - DB writes - `src/features/cx-quality/lib/server.ts:128-150`
- **Status:** shipped (spec/S09.md#S09-01, results/S09-01.md)
- **Problem:** `qaUpsertIn_` does a SELECT then UPDATE or INSERT **per row** (2 round trips each). Impact **M** (depends on batch size at call sites), effort **S**.
- **Fix:** For tables whose `keys` match a unique constraint, replace with one `db().from(name).upsert(clean, { onConflict: keys.join(',') })`; fall back to the current loop only on `42P10`. List call sites with `grep -n "qaUpsertIn_(" src/features/cx-quality/lib/server.ts` and check each key set against `supabase/migrations/20261105172048_quality.sql`.
- **Verify:** Count of HTTP calls for a save of N rows (expect 1); quality tests green.

### P-14 - DB writes - `src/features/shared/jobs/env.ts:603-621`; `src/features/shared/platform/repo.ts:255-257`, `:264-297`
- **Status:** shipped — detection half only (spec/S12.md#S12-02, results/S12-02.md); unique-index remediation deferred (conditional on observed fallback logs per spec/S12.md Completion)
- **Problem:** When an upsert hits a table with no matching unique constraint, the code silently falls back to one DELETE per key tuple (`env.ts:612-621`) or one SELECT + UPDATE per row (`repo.ts:274-295`). Impact **M** where it triggers, effort **S** to detect / **M** to fix.
- **Fix:** Log once per `(table, keys)` when the fallback path runs. For each table reported, add a unique index in a new migration (`npx supabase migration new <name>`), e.g. `CREATE UNIQUE INDEX IF NOT EXISTS <table>_<cols>_uidx ON public.<table> (<cols>);` after a duplicate check `select <cols>, count(*) from <table> group by <cols> having count(*) > 1`.
- **Verify:** Fallback log line no longer appears in cron logs.

### P-15 - DB - `src/features/cx-desk/lib/kpilogs.ts:164`; `src/features/cx-hub/lib/roster.ts:543`, `:278`, `:416`, `:484`, `:502`, `:560`, `:605`
- **Status:** shipped (spec/S10.md#S10-03, results/S10-03.md; roster `:278`/`:416`/`:484`/`:502` remain documented non-goals)
- **Problem:** Whole-table `readStore` to find a single row by id/email, or to test existence. Impact **L-M**, effort **S**.
- **Fix:** `readStoreFiltered(table, { eq: { [idCol]: id } })` (`stores.ts:49`) for the lookups; for `:560` add the `date`/`country` equality filters (index `idx_holidays_date`).
- **Verify:** `EXPLAIN` shows index scans; responses unchanged.

### P-16 - Index - `src/features/cx-productivity/lib/tph/page.ts:147`
- **Status:** skipped (T0 downgrade — table <5k rows and `idx_prod_tph_tasks_date_email` already leads on `date`; spec/S07.md#S07-03, results/S07-03.md)
- **Problem:** `prod_tph_tasks` is filtered by `date >= lo`, but the only index found is `prod_tph_tasks_task_id_uidx` (`supabase/migrations/20261106202513_migration_hardening.sql:47`). Impact **L-M** (table size unknown), effort **S**.
- **Fix:** Confirm first: `select indexname, indexdef from pg_indexes where tablename = 'prod_tph_tasks';`. If no index leads with `date`, new migration: `CREATE INDEX IF NOT EXISTS idx_prod_tph_tasks_date ON public.prod_tph_tasks (date);`
- **Verify:** `EXPLAIN ANALYZE select * from prod_tph_tasks where date >= '<lo>'` before/after.

### P-17 - Index - `src/features/cx-queue/lib/jobs.ts:343`
- **Status:** skipped (T0 downgrade — 2184 rows, `Sort` over ~2k rows trivial; spec/S14.md#S14-01, results/S14-01.md)
- **Problem:** `queue_snapshots` query filters `year` + `slot_date`, orders by `snapshot_key desc`, limit 400; only `idx_queue_snapshots_date (slot_date)` exists, so it sorts. Impact **L**, effort **S**.
- **Fix:** Only if T0 shows a sort on many rows: `CREATE INDEX IF NOT EXISTS idx_queue_snapshots_date_key ON public.queue_snapshots (slot_date, snapshot_key DESC);`
- **Verify:** `EXPLAIN ANALYZE` of that query shows no `Sort` node.

### P-18 - Bundle - `src/features/cx-hub/components/ecosystem-page.tsx:13-20`; `src/app/ecosystem/page.tsx:3`
- **Status:** shipped (spec/S13.md#S13-01, results/S13-01.md)
- **Problem:** A 2 663-line client component statically imports `three` (`import * as THREE`, which blocks tree-shaking) plus seven example modules; the route imports it statically, so it is also evaluated during SSR. Impact **M** for `/ecosystem` only, effort **S**.
- **Fix:** Create a small `'use client'` wrapper that loads it with `next/dynamic(() => import('...ecosystem-page').then(m => m.EcosystemPage), { ssr: false, loading: ... })` and render the wrapper from `src/app/ecosystem/page.tsx`. Check `node_modules/next/dist/docs/` for the current `dynamic` rules before coding. Leave the `THREE` namespace bindings as they are (verbatim port).
- **Verify:** `next build` route table: First Load JS for `/ecosystem` and for one other route before/after; confirm no other file imports `ecosystem-page` (`grep -rn "ecosystem-page" src`).

### P-19 - Render (needs profiling) - `src/features/cx-quality/components/audit-queue-page.tsx` (2 115 lines), `quality-analytics-page.tsx` (1 822), `src/features/cx-productivity/components/tph-grid-page.tsx` (2 029, single `useMemo` at `:1946`), `src/features/cx-people/components/one-on-ones-page.tsx` (2 675, single `useMemo` at `:2459`)
- **Status:** partial — profiling + /tph-grid fixes shipped (spec/S15.md#S15-01, spec/fix-p19-1.md#p19-01..p19-05; results/S15-01.md, results/p19-01.md..p19-05.md); /audit-queue re-profile blocked by qa_* pk drift (results/p19-04.md, results/pk-drift-01.md); p19-06 pending
- **Problem:** Very large single client components with zero or one memoized value; no virtualization library is in `package.json`. Render cost was **not** measured. Impact **unknown (M suspected)**, effort **M**.
- **Fix:** Profile first with React DevTools Profiler on `/tph-grid` and `/audit-queue` with production-like data. Only where a commit exceeds ~50 ms: wrap derived row/aggregate computations in `useMemo`, extract row components with `React.memo`, and page lists through the existing `src/features/shared/components/ui/PagedList.tsx` rather than adding a dependency.
- **Verify:** Profiler commit durations before/after for the same interaction.

### P-20 - Cold start - `src/app/api/admin/list-sheets/route.ts:1`; `src/features/shared/migration/engine.ts:12`
- **Status:** shipped (spec/S13.md#S13-02, results/S13-02.md)
- **Problem:** Top-level import of the full `googleapis` package in server code. Impact **L-M** (cold start of routes that share the chunk), effort **S**.
- **Fix:** Import inside the handler/function: `const { google } = await import('googleapis')`. Do not add a new dependency.
- **Verify:** Cold-start duration of `/api/admin/list-sheets` in Vercel logs; server chunk size in the build output.

### P-21 - API - `src/app/api/prod/analytics/route.ts:28-31`; `src/features/cx-queue/lib/jobs.ts:79`; `src/features/shared/platform/calendar.ts:76`
- **Status:** shipped (spec/S05.md#S05-02, spec/S06.md#S06-01; results/S05-02.md, results/S06-01.md)
- **Problem:** Routes re-query `config` and `roster` directly instead of the cached `configAll()` and the directory from P-08. Impact **L**, effort **S**.
- **Fix:** Replace the raw `config` query with `configAll()`; replace raw roster reads with `pwDirectory()` after P-08.
- **Verify:** Request count per call drops by 2.

### P-22 - ETL - `migration/migrate.ts:23-27`, `:55-59`
- **Status:** shipped (spec/S14.md#S14-02, results/S14-02.md)
- **Problem:** Row-by-row `upsert` for config and roster; errors unchecked (also `:95`, `:151`). Impact **L** (small one-off tables), effort **S**.
- **Fix:** `await supabase.from('config').upsert(configData, { onConflict: 'key' })` and the same for roster with `onConflict: 'email'`; check `error` on each call.
- **Verify:** `npm run migrate:dry-run`, then run time of `npm run migrate:local` against a local DB.

---

## Prioritized order (impact / effort)

1. T0 (measure, includes P-01 check) - everything else depends on it.
2. P-07, P-06, P-08 - high or medium impact, small effort.
3. P-02, P-03 - highest user-facing cost.
4. P-05 + P-09, P-04.
5. P-10, P-11, P-12.
6. P-13, P-14, P-15, P-21.
7. P-18, P-20, P-16, P-17, P-22.
8. P-19 (only after profiling).

## Independent tasks

Each task is self-contained. Common rules for every task: read `AGENTS.md` first; schema changes only as new files from `npx supabase migration new <name>`; no remote DB writes, commits or deploys without user approval; run `npx tsc --noEmit`, `npm run lint`, `npm run test:integration` before finishing; keep existing JS filters as a guard when pushing a predicate into SQL.

| Task | Items | Files touched | Depends on |
|---|---|---|---|
| **T0 Baseline** (read-only) | P-01 check | none (writes `docs/PERF_BASELINE.md`) | - |
| **T1 Scorecard range pushdown** | P-07 | `src/features/cx-people/lib/scorecard-server.ts` | T0 precondition query |
| **T2 QE log lookups** | P-06 | `src/features/cx-quality/lib/server.ts` (`:370-432`) | - |
| **T3 Identity/roster caching** | P-08, P-21 | `src/features/shared/platform/identity.ts`, `src/app/api/prod/analytics/route.ts`, `src/features/cx-queue/lib/jobs.ts`, `src/features/shared/platform/calendar.ts` | T0 precondition query |
| **T4 Prod analytics route** | P-02 | `src/app/api/prod/analytics/route.ts` | - |
| **T5 TPH store scoping** | P-03, P-16 | `src/features/cx-productivity/lib/tph/page.ts`, `src/app/api/tph/*/route.ts`, one new migration (only if P-16 confirmed) | T0 |
| **T6 Quality read pushdown** | P-05, P-09 | `src/features/cx-quality/lib/server.ts` | after T2 (same file) |
| **T7 Hub aggregates pushdown** | P-04, P-15 | `src/features/shared/platform/stores.ts`, `src/features/cx-hub/lib/aggregates.ts`, `src/features/cx-hub/lib/roster.ts`, `src/features/cx-desk/lib/kpilogs.ts` | - |
| **T8 Queue pages + live cache** | P-10, P-11 | `src/features/cx-queue/lib/pages.ts`, `src/features/shared/platform/stores.ts`, `src/features/shared/jobs/env.ts` (`flushWrites` only) | after T7 (shares `stores.ts`) |
| **T9 Job preload bounds + paging** | P-12, P-01 fix, P-14 logging | `src/features/shared/jobs/env.ts`, `src/features/shared/platform/repo.ts` | T0; after T8 (shares `env.ts`) |
| **T10 Quality bulk upsert** | P-13 | `src/features/cx-quality/lib/server.ts` (`:128-150`) | after T6 (same file) |
| **T11 Bundle / cold start** | P-18, P-20 | `src/app/ecosystem/page.tsx`, one new wrapper file, `src/app/api/admin/list-sheets/route.ts`, `src/features/shared/migration/engine.ts` | - |
| **T12 Small indexes + ETL** | P-17, P-22 | one new migration (only if T0 confirms), `migration/migrate.ts` | T0 |
| **T13 Render profiling** | P-19 | decided after profiling | - |

Tasks with no shared file can run in parallel: T1, T2, T3, T4, T5, T7, T11. Serial chains: T2 -> T6 -> T10 (`cx-quality/lib/server.ts`); T7 -> T8 -> T9 (`stores.ts`, `env.ts`).

## Task status (close-out)

| Task | Status |
|---|---|
| T0 Baseline | shipped (spec/S01.md#S01-01, spec/S01.md#S01-02; docs/PERF_BASELINE.md) |
| T1 Scorecard range pushdown | shipped (spec/S03.md#S03-01, results/S03-01.md) |
| T2 QE log lookups | shipped (spec/S04.md#S04-01, spec/S04.md#S04-02; results/S04-01.md, results/S04-02.md) |
| T3 Identity/roster caching | shipped (spec/S05.md#S05-01, spec/S05.md#S05-02; results/S05-01.md, results/S05-02.md) |
| T4 Prod analytics route | shipped (spec/S06.md#S06-01, results/S06-01.md) |
| T5 TPH store scoping | shipped (spec/S07.md#S07-01, spec/S07.md#S07-02; P-16 index skipped — spec/S07.md#S07-03) |
| T6 Quality read pushdown | shipped (spec/S08.md#S08-01..S08-12; results/S08-01.md..S08-12.md, results/qa-blank-01.md) |
| T7 Hub aggregates pushdown | shipped (spec/S10.md#S10-01..S10-03; results/S10-01.md..S10-03.md) |
| T8 Queue pages + live cache | shipped (spec/S11.md#S11-01..S11-03; results/S11-01.md..S11-03.md) |
| T9 Job preload bounds + paging | shipped (spec/S12.md#S12-01, spec/S12.md#S12-02; results/S12-01.md, results/S12-02.md) |
| T10 Quality bulk upsert | shipped (spec/S09.md#S09-01, results/S09-01.md) |
| T11 Bundle / cold start | shipped (spec/S13.md#S13-01, spec/S13.md#S13-02; results/S13-01.md, results/S13-02.md) |
| T12 Small indexes + ETL | partial — P-22 shipped (spec/S14.md#S14-02, results/S14-02.md); P-17 index skipped (spec/S14.md#S14-01, results/S14-01.md) |
| T13 Render profiling | partial — profiling + /tph-grid fixes shipped (spec/S15.md#S15-01, spec/fix-p19-1.md; results/S15-01.md, results/p19-01.md..p19-05.md); /audit-queue re-profile blocked (results/p19-04.md) |

### T0 Baseline - exact steps (read-only)

1. Record the PostgREST "Max rows" value (Supabase dashboard > Project Settings > API).
2. Run and record (SELECT only):
   ```sql
   select relname, n_live_tup from pg_stat_user_tables
   where schemaname = 'public' order by n_live_tup desc limit 40;

   select tablename, indexname, indexdef from pg_indexes
   where schemaname = 'public'
     and tablename in ('prod_tph_tasks','prod_window_hist','queue_snapshots','roster','sc_daily','qa_audits','qe_queue_log');

   select count(*) from sc_daily where date !~ '^\d{4}-\d{2}-\d{2}$';   -- T1 precondition, want 0
   select count(*) from roster where email <> lower(trim(email));        -- T3 precondition, want 0
   ```
3. With a signed-in session cookie, record `time_total` and `size_download` (3 runs each) for: `/api/prod/analytics`, `/api/tph/page`, `/api/tph/slots`, `/api/hub/home`, `/api/queue/aging`, `/api/queue/analytics`, and one `/api/qa/<action>` scores call.
4. Run `npm run build` and save the route size table.
5. Write all of the above to `docs/PERF_BASELINE.md`. Any table under ~5 000 rows downgrades the matching item's impact by one level; drop P-16/P-17 if their tables are small.
