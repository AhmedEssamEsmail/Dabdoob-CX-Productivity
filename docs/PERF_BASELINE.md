# CX-Hub Performance Baseline (T0)

Status: COMPLETE (DB facts S01-01; endpoint timings, build table, downgrade decisions S01-02).
Date: 2026-11-11. Paths are relative to `CX-Hub/`.
Method: `env -u SUPABASE_ACCESS_TOKEN npx supabase db query --remote --read-only`
Target: project dabdoob-cx-productivity (uugeyulccyytvgcabzzx) - production. SELECT-only; no DDL/DML.

## PostgREST max-rows

`unknown — default 1000 assumed`

Dashboard value (Project Settings > API) was not supplied by PM/user at T0; the
documented Supabase default of 1000 is assumed for all downstream analysis
(P-01 truncation risk, `readAllPaged` page size).

## Table sizes - `pg_stat_user_tables` top-40 (`n_live_tup`)

Query: `select relname, n_live_tup from pg_stat_user_tables where schemaname = 'public' order by n_live_tup desc limit 40;`

| relname | n_live_tup |
|---|---|
| fd_activities | 686753 |
| tickets | 176625 |
| maqsam_calls | 116103 |
| fc_messages | 84707 |
| qe_fd_cache | 25295 |
| prod_intervals | 23188 |
| aux_spans | 13086 |
| qa_audits | 12344 |
| refresh_log | 8312 |
| call_transcripts | 5606 |
| agg_inflow_hourly | 5239 |
| qe_queue_log | 3887 |
| tracker_records | 2376 |
| qa_queue | 2314 |
| queue_snapshots | 2184 |
| qa_ctls | 1863 |
| prod_flag_log | 1844 |
| freshchat | 1753 |
| mail_log | 1580 |
| prod_daily_layers | 1501 |
| qa_volume | 1391 |
| prod_flags | 1335 |
| sc_daily | 1153 |
| esc_seen | 887 |
| popups | 773 |
| agg_inflow_daily | 548 |
| v1_task_occurrences | 349 |
| qe_catalogue | 347 |
| agg_agent_daily | 324 |
| sched_overrides | 286 |
| sched_plan | 229 |
| prod_flag_analytics | 220 |
| config | 141 |
| prod_tph_cases | 135 |
| prod_tph_calls | 131 |
| prod_tph_touches | 131 |
| prod_window_hist | 126 |
| qe_builds | 117 |
| tlp_shifts | 117 |
| pw_reminder_log | 107 |

Note for downgrade decisions (S01-02): `roster` and `prod_tph_tasks` do not appear
in the top-40, so their `n_live_tup` is <107 (or stats stale - `pg_stat` counts are
estimates). `prod_tph_tasks` row count matters for P-16/P-17 keep/drop.

## Indexes - `pg_indexes` for the 7 listed tables

Query: `select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ('prod_tph_tasks','prod_window_hist','queue_snapshots','roster','sc_daily','qa_audits','qe_queue_log');`

| tablename | indexname | indexdef |
|---|---|---|
| prod_tph_tasks | prod_tph_tasks_pkey | CREATE UNIQUE INDEX prod_tph_tasks_pkey ON public.prod_tph_tasks USING btree (task_id) |
| prod_tph_tasks | idx_prod_tph_tasks_date_email | CREATE INDEX idx_prod_tph_tasks_date_email ON public.prod_tph_tasks USING btree (date, agent_email) |
| prod_tph_tasks | prod_tph_tasks_task_id_uidx | CREATE UNIQUE INDEX prod_tph_tasks_task_id_uidx ON public.prod_tph_tasks USING btree (task_id) |
| prod_window_hist | prod_window_hist_pkey | CREATE UNIQUE INDEX prod_window_hist_pkey ON public.prod_window_hist USING btree (id) |
| prod_window_hist | prod_window_hist_date_class_key | CREATE UNIQUE INDEX prod_window_hist_date_class_key ON public.prod_window_hist USING btree (date, class) |
| qa_audits | qa_audits_pkey | CREATE UNIQUE INDEX qa_audits_pkey ON public.qa_audits USING btree (audit_id) |
| qa_audits | idx_qa_audits_agent_date | CREATE INDEX idx_qa_audits_agent_date ON public.qa_audits USING btree (agent_email, audit_date) |
| qa_audits | idx_qa_audits_ticket | CREATE INDEX idx_qa_audits_ticket ON public.qa_audits USING btree (ticket_id) |
| qa_audits | qa_audits_agent_idx | CREATE INDEX qa_audits_agent_idx ON public.qa_audits USING btree (agent_email, audit_date) |
| qa_audits | qa_audits_auditor_idx | CREATE INDEX qa_audits_auditor_idx ON public.qa_audits USING btree (auditor_email, audit_date) |
| qa_audits | qa_audits_ticket_idx | CREATE INDEX qa_audits_ticket_idx ON public.qa_audits USING btree (ticket_id) |
| qa_audits | qa_audits_queue_idx | CREATE INDEX qa_audits_queue_idx ON public.qa_audits USING btree (queue_id) |
| qa_audits | qa_audits_cal_idx | CREATE INDEX qa_audits_cal_idx ON public.qa_audits USING btree (calibration_id) |
| qe_queue_log | qe_queue_log_pkey | CREATE UNIQUE INDEX qe_queue_log_pkey ON public.qe_queue_log USING btree (id) |
| qe_queue_log | qe_queue_log_key_queued_date_key | CREATE UNIQUE INDEX qe_queue_log_key_queued_date_key ON public.qe_queue_log USING btree (key, queued_date) |
| qe_queue_log | qe_queue_log_date_idx | CREATE INDEX qe_queue_log_date_idx ON public.qe_queue_log USING btree (queued_date) |
| qe_queue_log | qe_queue_log_ticket_idx | CREATE INDEX qe_queue_log_ticket_idx ON public.qe_queue_log USING btree (ticket_id) |
| queue_snapshots | queue_snapshots_pkey | CREATE UNIQUE INDEX queue_snapshots_pkey ON public.queue_snapshots USING btree (id) |
| queue_snapshots | queue_snapshots_snapshot_key_queue_key | CREATE UNIQUE INDEX queue_snapshots_snapshot_key_queue_key ON public.queue_snapshots USING btree (snapshot_key, queue) |
| queue_snapshots | idx_queue_snapshots_date | CREATE INDEX idx_queue_snapshots_date ON public.queue_snapshots USING btree (slot_date) |
| roster | roster_pkey | CREATE UNIQUE INDEX roster_pkey ON public.roster USING btree (email) |
| roster | idx_roster_email | CREATE INDEX idx_roster_email ON public.roster USING btree (email) |
| roster | idx_roster_role | CREATE INDEX idx_roster_role ON public.roster USING btree (role) |
| roster | idx_roster_tl_email | CREATE INDEX idx_roster_tl_email ON public.roster USING btree (tl_email) |
| roster | idx_roster_lower_email | CREATE INDEX idx_roster_lower_email ON public.roster USING btree (lower(email)) |
| roster | roster_email_uidx | CREATE UNIQUE INDEX roster_email_uidx ON public.roster USING btree (email) |
| sc_daily | sc_daily_pkey1 | CREATE UNIQUE INDEX sc_daily_pkey1 ON public.sc_daily USING btree (id) |
| sc_daily | sc_daily_month_date_email_key | CREATE UNIQUE INDEX sc_daily_month_date_email_key ON public.sc_daily USING btree (month, date, email) |
| sc_daily | idx_sc_daily_range | CREATE INDEX idx_sc_daily_range ON public.sc_daily USING btree (date, email) |

## Preconditions (gates for S03-01 / T1 and S05-01 / T3)

| check | query | result | wanted |
|---|---|---|---|
| T1: sc_daily non-ISO dates | `select count(*) from public.sc_daily where "date" !~ '^\d{4}-\d{2}-\d{2}$'` | **0** | 0 |
| T3: roster non-lower emails | `select count(*) from public.roster where email <> lower(trim(email))` | **0** | 0 |

Both preconditions hold. Note: queries needed `public.`-qualified relation names
on the hosted `db query` path (unqualified name resolved against a search_path
without `public` and failed 42P01 on the first attempt; no data was written).

## Endpoint timings

Method (S01-02): `curl -w '%{time_total} %{size_download}'`, 3 runs each, signed-in as
fixture user `e2e.admin@dabdoob.com` (real `POST /api/auth/login` session cookie).
Primary numbers are against a **production server** (`next build` + `next start -p 3100`,
same `.env.local`); the dev server on :3000 repeatedly OOM-crashed compile workers
(`Jest worker encountered 2 child process exceptions`) and is noted only where different.

| endpoint | run1 | run2 | run3 | status | size_download B | median (warm target) |
|---|---|---|---|---|---|---|
| GET /api/prod/analytics | 1.394 | 0.487 | 0.444 | **500** (empty body) | 0 | 0.487 s |
| GET /api/tph/page | 0.430 | 0.410 | 0.306 | 200 | 126914 | 0.410 s |
| POST /api/tph/slots `{}` | 0.627 | 0.368 | 0.316 | 500 `Pick a date (yyyy-MM-dd).` | 37 | 0.368 s |
| GET /api/hub/home | 2.484 | 1.459 | 1.455 | 200 | ~7066 | 1.459 s |
| GET /api/queue/aging | 0.432 | 0.438 | 0.420 | 200 | 704 | 0.432 s |
| GET /api/queue/analytics | 0.377 | 0.354 | 0.365 | 200 | 20496 | 0.365 s |
| GET /api/qa/getQaScoresPage `[from,to,basis]` | 0.286 | 0.271 | 0.261 | **500** `column qa_audits.id does not exist` | 46 | 0.271 s |

Notes:
- `/api/prod/analytics` 500s in both dev and prod for this user (unhandled throw past
  `requireRole`/`prodAnalyticsFor_`; prod returns an empty body). Recorded as-is; the
  P-02 leaf must re-verify with a working caller or fix the error first.
- `/api/tph/slots` is POST-only (a save route). Timed with `{}` body: `tphLoadStore_`
  ran, then validation rejected before any write — the timing still measures the store
  load that P-03 targets. The page's real read traffic is `/api/tph/page`.
- `/api/qa/getQaScoresPage` 500s on real data: `column qa_audits.id does not exist`
  (schema/code mismatch inside `qaRows_`/`qaScoresRange_`; the P-05 leaf sees it too).
- Dev-server (:3000) medians were similar where routes compiled (tph/page 0.60 s,
  hub/home 8.50 s, queue/aging 0.56 s, queue/analytics 0.41 s); hub/home's dev number
  is inflated by on-demand compilation.
- **Perf-gate comparison targets** = the median column above (warm, prod server).

## Build route table

`npm run build` on Next.js 16.4.3 (Turbopack) — compiled 2.4 s, TypeScript 12.1 s,
156 static generations ok. **This Next version emits no per-route First-Load-JS /
size columns**; the table is render-mode only. Every route is `ƒ` (Dynamic,
server-rendered on demand) except `◐ /[...slug]` (partial prerender). For the P-18
verify step, First-Load-JS comparison needs `.next` build-manifest/client-asset
diffs instead of this table.

Routes (verbatim list; all `ƒ` unless noted):
`/`, `/_not-found`, `/[...slug]` (◐), `/admin`, `/admin/config`, `/admin/roster`,
`/agents`, `/aging`, `/analytics`, `/api/admin/backfill`, `/api/admin/list-sheets`,
`/api/admin/migrate`, `/api/admin/mirrors`, `/api/admin/source-health`,
`/api/alerts/one-on-one`, `/api/auth/google`, `/api/auth/login`, `/api/auth/logout`,
`/api/bootstrap`, `/api/calendar`, `/api/config`, `/api/cron/*` (15 cron routes incl.
`job-tph-hourly`), `/api/desk/job/mail`, `/api/desk/setup`, `/api/fcr/daily`,
`/api/health`, `/api/holidays`, `/api/hub/admin`, `/api/hub/ecosystem`,
`/api/hub/home`, `/api/hub/my-day`, `/api/hub/roster`, `/api/integrations/*`
(freshchat, freshdesk, gmail, maqsam), `/api/kpi/*` (behaviour, leave, logs,
ol-cases, payout), `/api/mail-desk`, `/api/mail-log`, `/api/options`,
`/api/options/[listKey]`, `/api/people/*` (actions, agents, coaching, meetings,
notes, one-on-ones + 6 subroutes, scorecard, tasks + 6 subroutes), `/api/popups`,
`/api/prod/analytics`, `/api/prod/daily-layers`, `/api/prod/flags`,
`/api/prod/flags/[flagId]`(+`/decide`), `/api/prod/intervals`, `/api/prod/my-page`,
`/api/qa/[action]`, `/api/quality/audits`, `/api/queue/*` (aging, aging-flags,
analytics, checkins, checkins-page, health, heatmap, refresh, scheduler),
`/api/roster`, `/api/tl/*` (kb, otd, page, performance, rate), `/api/tph/*` (cases,
days, page, run-day, run-step, slots, tasks, touches, trend), `/api/trackers`
(+fields, records, setup), `/api/view-as` (+people), `/audit-queue`,
`/auth/callback`, `/auth/login`, `/auth/logout`, `/calibration`, `/checkins`,
`/coaching`, `/ctls`, `/disputes`, `/ecosystem`, `/heatmap`, `/kb-gaps`,
`/kb-tracker`, `/kpi-logs`, `/mail-desk`, `/meetings`, `/my-actions`,
`/my-auditor-kpis`, `/my-audits`, `/my-day`, `/my-status`, `/notes`,
`/one-on-ones`, `/overview`, `/people-holidays`, `/productivity-analytics`,
`/qa-forms`, `/quality-analytics`, `/quality-scores`, `/queue`, `/scheduler`,
`/status-validation`, `/tl-performance`, `/tl-tasks`, `/tph`, `/tph-grid`,
`/trackers`; `ƒ Proxy (Middleware)`.

## Downgrade decisions (T0 step 5: table <~5000 rows -> impact -1 level)

Row counts are the `n_live_tup` estimates above. For multi-table items the dominant
(largest) matching table decides.

| item | matching tables (rows) | decision |
|---|---|---|
| P-01 | prod_intervals 23188, refresh_log 8312, qa_audits 12344, tickets 176625, fd_activities 686753, qe_fd_cache 25295, agg_inflow_hourly 5239 | **keep H** — reads exceed assumed max-rows 1000, truncation real today |
| P-02 | prod_intervals 23188, prod_flags 1335, prod_daily_layers 1501, prod_window_hist 126 | **keep H** — dominant table >5k |
| P-03 | prod_tph_cases 135, prod_tph_calls 131, prod_tph_touches 131, prod_tph_tasks <107, refresh_log 8312 (dropped per fix) | **H -> M** |
| P-04 | sc_daily 1153, prod_daily_layers 1501, queue_snapshots 2184, roster <107, agg_inflow_hourly 5239 | **H -> M** |
| P-05 | qa_audits 12344 | **keep H** |
| P-06 | qe_queue_log 3887 | **H(:425)/M -> M** |
| P-07 | sc_daily 1153 | **H -> M** |
| P-08 | roster <107 | **M -> L** |
| P-09 | qa_audits 12344 + qa_* (<=2314) | **keep M** (sequential awaits still real) |
| P-10 | roster <107, agg_inflow_daily 548, queue_snapshots 2184 | **M -> L** |
| P-11 | agg_* <=5239, aging_open_tickets <107 | **M -> L** |
| P-12 | prod_intervals 23188, tickets 176625 | **keep M-H** |
| P-13 | qa_audits 12344, qa_queue 2314 (batch size driven) | **keep M** |
| P-14 | n/a (fallback logging) | keep M |
| P-15 | roster <107, holidays small | **L-M -> L** |
| P-16 | prod_tph_tasks <107 | **DROP** — table tiny AND `idx_prod_tph_tasks_date_email (date, agent_email)` already leads on `date`; premise outdated |
| P-17 | queue_snapshots 2184 | **DROP** — <5k rows; `Sort` over ~2k rows is trivial |
| P-18 | n/a (bundle) | keep M |
| P-19 | n/a (profiling task) | keep |
| P-20 | n/a (import) | keep L-M |
| P-21 | config 141, roster <107 | keep L (already lowest) |
| P-22 | config 141, roster <107 | keep L |

## After (perf gate — measured 2026-11-11)

Same method as "Endpoint timings" (3 runs each, signed-in fixture user, prod
server `next start -p 3100`, reused `.next` build `XmwNC6nOQaYMaeSTp-xcn`).
`before` = the median column above. Raw runs:
`specs/perf-pushdown/logs/after-timings.log`.
Final-build re-time (perf1-01, 2026-11-11): fresh `npm run build` + `next start
-p 3100`, `.next` BUILD_ID `RQxQ00OoPfT22Fj8nO3wI`; the analytics and hub/home
rows below are updated to this build. Raw:
`specs/perf-pushdown/logs/perf1-timings.log`.
`getQaScoresPage` args: `["2026-11-04","2026-11-11","interaction"]` via
`GET ?args=` (T0 did not record exact args; interaction basis = the unbounded
`qa_audits` read that was 500ing).

| endpoint | before median s | after median s | before size B | after size B |
|---|---|---|---|---|
| GET /api/prod/analytics | 0.487 (500) | 0.121 (**200**) | 0 | 3448 |
| GET /api/tph/page | 0.410 | 0.374 | 126914 | 95961 |
| POST /api/tph/slots `{}` | 0.368 (500 expected) | 0.329 (500 expected) | 37 | 37 |
| GET /api/hub/home | 1.459 | 0.859 | ~7066 | ~7303 |
| GET /api/queue/aging | 0.432 | 0.193 | 704 | 704 |
| GET /api/queue/analytics | 0.365 | 0.187 | 20496 | 20496 |
| GET /api/qa/getQaScoresPage | 0.271 (500 schema) | 0.125 (**200**) | 46 | 7989 |

Delta verdicts:
- `/api/prod/analytics` — **500 -> 200** on the final build
  `RQxQ00OoPfT22Fj8nO3wI` (perf1-01 re-time; runs 3.771 cold / 0.105 / 0.121):
  pm2-01's `eval('from')` fix is verified served — P-02 pushdown is now
  verifiable for the first time. Median 0.121 s vs T0 0.487 s = **PASS**
  (-75%); body 3,448 B (first measurable payload on a 200).
- `/api/tph/page` — 200, -9% median; response 96 KB vs 127 KB (recorded as-is).
- `/api/tph/slots` — expected 500 preserved (`Pick a date`), -11%.
- `/api/hub/home` — 200, median **0.859 s vs T0 1.459 s = PASS** (-41%) on the
  pm3-03 build `OQ3PvVtUCyDf_oX63UwoY` (runs 2.753 cold / 0.859 / 0.848;
  provider span collapsed from ~1.4-2.2 s to ~0.22-0.25 s via concurrent
  providers + shared TL-schedule fetch + in-flight `pwRows_` dedupe +
  single `one_on_one_schedule` read). Raw: `specs/perf-pushdown/logs/pm3-retime.log`.
- `/api/queue/aging` — 200, -55%.
- `/api/queue/analytics` — 200, -49%.
- `/api/qa/getQaScoresPage` — **500 -> 200** (pk-override fix confirmed); warm
  median 0.125 s; run1 4.82 s = cold uncached compute (included in median like
  T0 cold runs).
- **Payload target (perf-4):** the `>=50%` drop is **not met** on any
  measurable endpoint — `/api/tph/page` -24.4% (126,914 -> 95,961 B),
  `/api/hub/home` +3.4% (~7,066 -> 7,309 B), `/api/prod/analytics` first
  measurable on a 200 at 3,448 B (no pre-fix baseline — T0/prior builds all
  500ed). Verdict: BREACH of the >=50% figure, restated — the pushed-down
  tables (`prod_window_hist` 126 rows, `prod_*` <=1.5k) are a minor share of
  total response payload, so a 50% body reduction was never achievable from
  these reads alone; the hard `size <= baseline` budget holds except hub/home
  (+3.4% vs an approximate baseline).

### prod_window_hist index decision (perf-3)

Decision: `idx_prod_window_hist_date` is redundant — **migration file removed**;
pm1-02's approval is superseded by perf-3 (the file was never applied remotely).

Evidence (recorded `pg_indexes` snapshot above, no remote access needed):
`prod_window_hist | prod_window_hist_date_class_key | CREATE UNIQUE INDEX
prod_window_hist_date_class_key ON public.prod_window_hist USING btree
(date, class)` — `date` is the leftmost column, so a standard btree
leftmost-prefix scan serves every `date` predicate the app issues:
`api/prod/analytics/route.ts` bounds it with `gte('date', weeksFrom).lte('date',
to)` (the only predicated read), the job prefetch in `shared/jobs/env.ts`
(`TABLE_BOUNDS`) reads the table deliberately unbounded ("readers take whole
sets"), and `io.upsert('prod_window_hist', ['date','class'], …)` resolves on the
same unique index. A second single-column `(date)` btree is a narrower duplicate
a planner would not prefer — and at 126 rows (`n_live_tup` above) a seq scan is
trivial regardless.
