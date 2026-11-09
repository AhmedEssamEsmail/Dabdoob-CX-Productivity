# perf report - perf-remediation - round 1 (FULL)

Verdict: FAIL  (2 MED open)
Open: 0B / 0H / 2M / 3L

## Measurements

| Metric | Before -> After | Budget | Tool |
|---|---|---|---|
| Remote auth calls per request | `auth.getUser()` x2-3/req -> 0 (`auth.getClaims()` local JWT; proxy.ts:26-28, identity.ts:36; grep `getUser(` in non-test src = 0 hits) | remote calls eliminated | source inspection |
| `realEmail`/`viewAsState`/`currentUser` per request | uncached -> `cache()`-memoized (identity.ts:33,77; viewas.ts:66) | memoized per request | source inspection |
| job-tph-hourly table reads | 12 tables + roster + config -> 2 prefetch tables + config (`prefetchTables(['agg_queue_now','prod_tph_cases'])` tph.ts:25; `buildJobEnv({roster:false})` route.ts:28) | <=3 tables | source inspection |
| prod_intervals reads in jobs | whole-table -> `gte('date', bound)` everywhere (env.ts:276,482,498; my-page route.ts:74-80; analytics route.ts:53; flags route.ts:110-114) | full-scan calls ~0 post-deploy | source inspection (live pg_stat unmeasurable — migrations unapplied) |
| maqsam_calls read | whole-table -> `gte('ts_ms', sinceMs)` (jobs.ts:153) | filtered | source inspection |
| Poll endpoints per 60s tick | 2 (`/api/popups` + `/api/alerts/one-on-one`) -> 1 merged `/api/popups` returning {popups,alerts,now} (route.ts:9; OneOnOneAlerts fed via props, no poller) | one poll per tick | source inspection |
| updateRows PostgREST calls/batch | 1 find + 1 update per row -> 1 select + 1 upsert per uniform signature group (repo.ts:208-260) | <=2 calls/batch | source inspection |
| resolvePopups writes | per-row loop -> single UPDATE...is(resolved_at,null).select (popups.ts:104-114) | no per-row loop | source inspection |
| `__CC_BOOT__` | consumer only -> emitted server-side layout.tsx:58-62; `/api/options/[listKey]` fetched lazily by dropdowns only | inline boot + lazy options | source inspection |
| DB client key | anon -> `SUPABASE_SERVICE_ROLE_KEY` (supabase.ts:8,14); RLS lockdown migration 20261108205852 written (drops every `app_all` via dynamic SQL) | service-role + deny-all policies | file inspection (unapplied) |
| Migrations vs PLAN #7 | dedupe+uniques prod_daily_layers/queue_submissions + roster_email_uidx + all 11 planned indexes verified present | all present | grep CREATE INDEX/UNIQUE (unapplied) |
| job-data-tick schedule | never ran -> pg_cron `*/15` migration 20261108231643 (unapplied); vercel.json entry removed; reminders kept | */15 via pg_cron | file inspection |
| job-tph-past-days runtime | 270s guard -> `budgetMs: 55_000` (route.ts:28) | <=60s | source inspection |
| my-day section cache | instance-local Map -> `app_cache` dbCache* (myday.ts:581-679; shared-cache.ts) | shared across instances | source inspection |
| Client JS (prod build) | no baseline -> 54 chunks, 2.4MB uncompressed, 208KB CSS (.next/static/chunks) | growth <10%/<30KB gz | du over .next (Turbopack prints no per-route table; no baseline for delta) |
| Warm bootstrap queries | ~8-10 serial remote+DB -> ~3-4 DB round-trips (roster ilike + cached config + parallel popups/urls/qa-flags) | <=150ms warm | static count (no session -> live latency unmeasured) |
| Gates (tl-5, logs/fix5-*) | tsc 0; vitest 1126/1126; eslint 0 err; security 4/4; build 154/154 | all green | log tails |

## Findings

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-1 | MED | src/features/cx-quality/lib/server.ts:621,898,1008,1109,1163,1281,1431 | `qaRows_('qa_audits')` still whole-table `select('*')` on request paths (quota page, qaTicketClash_ single-ticket check, my-audits, disputes, ctl decision, calibrations); in-memory filter after full fetch. pg_stat baseline: qa_audits 241 calls/41s ~170ms mean > 100ms budget; unbounded (table grows per audit). Single-row lookups were converted (qaRowBy_) but the list/map reads — the measured hot ones — were out of leaf scope. | Add `qaRowsWhere_(name,{eq,in,is})` (readStoreFiltered exists, stores.ts:49); push ticket_id/kind/agent_email/status predicates server-side; auditsBy-map pages fetch only needed rows. | dev |
| perf-2 | MED | src/features/cx-queue/lib/jobs.ts:94-97 | `buildQueueAggregates_` reads `tickets` with 9 columns and NO where-clause — full seq scan of 176k rows/72MB every job-data-tick, now scheduled */15 (~96 runs/day via pg_cron). | Server-side filter: `status in open_statuses` OR `created_at >= today-1d` OR `resolved_at >= today-1d` (aging needs open rows; created/resolved_today counts need today's rows only). | dev |
| perf-3 | LOW | src/app/api/prod/intervals/route.ts:13-21; src/app/api/prod/daily-layers/route.ts:14-26 | Optional-filter `select('*')` with no `.limit()`: zero params -> whole table over the wire (prod_intervals 23k/12MB). Admin/TL-gated; no in-app callers found (grep). | Default date window (e.g. last 31d) or hard `.limit(5000)` when no params supplied. | dev |
| perf-4 | LOW | src/app/api/prod/flags/route.ts:74 | Admin branch `prod_flags.neq('decision','void')` unbounded — whole flag history per page load (TL branch is roster-scoped). `decided` list is already capped at 150 in memory. | `.gte('date', decidedFrom)` for decided rows or `.limit(N)`; pending-only stays unfiltered-in-time. | dev |
| perf-5 | LOW | src/features/cx-queue/lib/jobs.ts:226 | `buildAgentAggregates_` reads all `prod_daily_layers` (`select('*')`, no bound) nightly; ~15k rows/yr growth (40 agents x 365). | Bound to perf window (e.g. `gte('date', -400d)`) matching dqAgentPerf_'s horizon, or document as accepted full-read. | dev |

## Not measured / assumptions

- `/api/bootstrap` warm latency: requires an authenticated session cookie; unauthenticated probe would 401 and measure the wrong path. Static: ~3-4 sequential PostgREST round-trips warm (roster ilike + 5-min-cached config + parallel popups/appUrls/qaBootFlags) — consistent with <=150ms but unverified.
- tph-day payload <500KB: `tphLoadStore_` now bounds all 7 queries (date gte + limits 5k-20k) but actual byte size needs a live query.
- prod_intervals full-scan calls ~0 post-deploy: pg_stat_statements not re-readable here; index + filtered reads verified statically only. Also: `ilike(col, email)` without wildcards does not use the new column indexes (only `*_date` indexes cover the date predicates) — acceptable today; revisit if agent_email becomes the selective predicate.
- Bundle JS growth vs baseline: no pre-change build artifact; Turbopack build emits no size table. Absolute measured: 2.4MB uncompressed client chunks.
- `popupsPoll` whole-table `count head` each tick (~15ms mean baseline, 2,907 calls/44s) is the deliberate change-stamp — kept by design, not a finding.
- Remaining `readStore`/`dqCachedLive` whole-table reads on small app tables (roster, kpi logs, sc_daily, agg_*) in files NOT changed by this spec — residual risk noted, out of leaf scope.
- RLS lockdown, all 7 migrations: files verified, remote apply pending NEEDS_APPROVAL (TRACKER).
