# 00 — Gap Review: deprecated GAS apps vs CX-Hub

> Detailed review of the 8 deprecated Google Apps Script apps (`C:\Users\AHMED\KPIs\*_deprecated`, the product spec) against `C:\Users\AHMED\KPIs\CX-Hub`. Verified 2026-11-06 by direct code inspection + running the gates. Evidence conventions follow `../legacy-parity/README.md`: `[V]` verified in repo, `[B]` read from a bundle extract under `.devin/work/extract/`, `[H]` hypothesis for a wave-1 audit to confirm.

## 1. Method

1. Enumerated every registry route, every legacy public server function (no trailing underscore = browser-callable; shard docs `../cx-hub/10..90-*.md` carry the verbatim lists), every HB_PLAN job, every store/tab, every integration, every shell/platform aspect.
2. Grepped `src/features/` + `src/app/` for each item; read the port where a name differed.
3. Ran the gates to test the tracker claims: `npx tsc --noEmit`, `npx vitest run`, `npx eslint .`.
4. Classified every gap: `GATED` (credential-deferred — legitimate), `DIAG` (diagnostic/setup — audit decides), `PORTED-AS` (name changed), `MISS` (genuine gap → new WP).

## 2. Gate status snapshot — MEASURED 2026-11-06

| Gate | Result | Detail |
|---|---|---|
| `npx tsc --noEmit` | **4 errors** | `src/features/cx-queue/lib/heatmap.ts:230` ×2 (possibly-undefined `sh.getLastColumn`); `tests/golden/ops-fakes.ts:26` (`normHeader` not exported by `cx-operations/lib/trackers`); `tests/golden/ops-fakes.ts:185` (`delete` operand). |
| `npx vitest run` | **24 failed / 504 passed** (3 files) | `tests/golden/hub-admin`, `hub-overview`, `hub-people-holidays` — all root-caused to `requireRole is not a function`: `tests/golden/hub-fakes.ts:216` `authModule()` mocks only `createAuthClient`; `requireRole` now lives in `src/features/shared/lib/auth.ts:46` and the factory mock replaces the whole module. |
| `npx eslint .` | **1 error + 295 warnings** | `prefer-const` at `src/features/cx-queue/lib/heatmap-engine.ts:262`. |
| `npx next build` | not run | WP-03. |

**Consequence:** the suite is not currently a trustworthy oracle — wave 0 restores it before any parity claim is accepted. `tests/golden/desk-fakes.ts` and `ops-fakes.ts` exist with **no test files**: desk + operations golden suites were scaffolded but never written.

## 3. Executive summary

| Area | State |
|---|---|
| Routes/pages | 36/40 registry routes have real ported pages; `ecosystem` hidden page ported (Three.js). 4 placeholders are parity-correct: `hard-cases`, `kpi-close`, `escalation-matrix`, `fcr` — all unbuilt in legacy (`route-audit.json`). |
| Server functions | ~95% of the browser-callable surface verified ported (checked per-function below). Residual: job-trigger entry names, admin diagnostics, one-shot migration utilities, Google/vendor-gated fns — register in §10. |
| Jobs | All 23 HB_PLAN jobs defined in `platform/health.ts`; implementations exist for ~19. Cron routes exist for all ported jobs, but `vercel.json` schedules **only productivity** paths; the rest await pg_cron (blocked B5). |
| Data | ~16 tables migrated+count-verified (config, roster, view_as, 12 prod_*, qa_audits, qa_queue, qa_volume). ~100 more tables have DDL applied (migrations 001–011) but **no data** — shard-80 sweep. |
| Integrations | Maqsam mirror live; Freshdesk adapter ported; Freshchat blocked (no key); all Google-Workspace surfaces gated behind shard 90 seams (`{configured:false}` honest degradation). |
| Shell/platform | Ported: rail + per-group app ctx, gates, View-as, popups, 1:1 alerts, appearance (theme/accents/lang/RTL), HashShim, state screens, boot splash, mail engine (dry-run policy), options, health/heartbeat, calendar. Awaiting verification sweep (W4). |

## 4. Route registry (40 routes + 1 hidden)

From `../cx-hub/route-audit.json` [V] — unchanged since generation; wave-1 re-verifies.

- **Real pages (36):** hub: `overview, admin, people-holidays, my-day` (+ hidden `ecosystem`); quality: `quality-scores, audit-queue, my-audits, ctls, disputes, calibration, kb-gaps, my-auditor-kpis, quality-analytics, qa-forms`; productivity: `status-validation, my-status, productivity-analytics, tph`; queue: `queue, aging, checkins, analytics, heatmap, scheduler`; people: `agents, one-on-ones, tl-tasks, meetings, my-actions, notes, coaching`; operations: `trackers`; desk: `tl-performance, kb-tracker, kpi-logs, mail-desk`.
- **Parity placeholders (4):** `hard-cases`, `kpi-close`, `escalation-matrix`, `fcr` — served by `src/app/[...slug]/page.tsx` → `UnbuiltPage` ("Not built yet."), matching legacy `hs()`. `fcr` additionally has `/api/fcr/daily` (scorecard input) per D-FCR.
- Extra non-registry routes kept for parity: `admin/roster`, `admin/config`, `tph-grid`, `auth/*`, root fallback `src/app/page.tsx`.

## 5. Per-module review

### 5.1 Hub (`Command_Center_V2_deprecated`, `CC_APP=hub` → `features/cx-hub`)

**Pages:** 5/5 ported `[V]` (`overview-page`, `admin-page`, `people-holidays-page`, `my-day-page`, `ecosystem-page` + `three` dep). Awaiting W1 DOM/class/copy checklist vs `.devin/work/extract/hub/pages/*.closure.js`.

**Server surface:**

| Status | Functions |
|---|---|
| OK (verified in `cx-hub/lib`, `cx-queue/lib/jobs`, `cx-people/lib/agents-page`, `platform/health`) | `getHomePage`, `getAgentsPage`, `jobDataTick`, `refreshQueueNow`, `jobNightlyAggregates`, `getMyDay`, `getMyDayPart`, `searchMyMail`, `markFollowUpDone`, `createFocusBlock`, `setAssistantSettings`, `jobWarmMyDay`, `jobAssistantMorningDigest`, `getRosterAdmin`, `setPersonOverrides`, `setPersonV2Fields`, `addHoliday`, `removeHoliday`, `syncRosterNow`, `getEcosystemHealth`, `setupHealth`, `runFreshdeskFullSync`, `setupV2` |
| GATED (Google HCT sheet) | `runRosterSync`, `jobRosterSync` → WP-51/WP-52-G1 |
| GATED (Freshchat key) | `jobFreshchatMessages`, `backfillFreshchat`, `backfillEscalationSightings` → WP-53 |
| DIAG | `diagnoseAging` (Setup.js admin diagnostic) → WP-10 decides port vs skip |
| N/A per D1 | `connectToHub` (single-deployment decision) — documented, no port needed |
| `[H]` | `debugMyDay`, `doPost` — confirm handled (debug route / disabled post path) → WP-10 |

**Google seams:** `cx-hub/lib/myday-google.ts` returns `{configured:false}` — correct honest degradation per D-GOOGLE.

**Jobs:** `year_rollover` ported inside `jobNightlyAggregates` (`cx-queue/lib/jobs.ts:361`) `[V]`; `roster_sync` gated. `jobDataTick` covers freshdesk_sync + queue_aggregates + checkin_tick (+ inflow) `[V: jobs.ts:327-351]`. **Unscheduled** — cron routes exist but no `vercel.json` entry; pg_cron pending B5.

**Tables:** `005_hub.sql` applied (follow_up_done, cache_stamps, roster cols, 002/003 gap fills); **data: only config/roster/view_as migrated**; queue/live/agg stores schema-only → WP-30.

### 5.2 Quality (`Quality_deprecated`, `CC_APP=quality` → `features/cx-quality`)

**Pages:** 10/10 ported `[V]`. `boot.quality={auditor,kbEditor}` wired via `/api/bootstrap` `[H — verify WP-11]`.

**Server surface:** all 33 page/admin entry functions verified ported (`getQaAccess` … `saveQaSampling`, incl. disputes/calibration/kb-gaps/forms/sampling + `importQaQueueNow`, `backfillQaSampleBasis`, `backfillQaInteractionDates`, `checkQaEngineSettings`, `migrateQualityQueueHistory`, `importQualityAuditHistory`, `restartQualityAuditHistory`) `[V]`.

| Status | Functions |
|---|---|
| PORTED-AS? `[H]` | `jobQualityDaily`, `jobQualityBuildRetry`, `jobQualityHistory` — cron route `api/cron/job-qa-engine` calls `qaQueueStep_`, `qaReconcileQueueLog`, `qaCtlReminders`; WP-11 must confirm the legacy job step-chains map 1:1 (else port the missing steps) |
| MISS | `exportQaAuditsFlat` (admin flat export) → WP-11 |
| DIAG | `setupQuality`, `installQualityTriggers`, `qaFreshdeskSetupHelp`, `verifyQaFreshdesk`, `diagnoseQaQueue`, `diagnoseQaQueueRows` → WP-11 |
| DIAG (one-shot migration utils) | `restartQualityQueueMigration`, `addCallControlToTextForms`, `seedQaNonTicketAudits`, `useVoiceFormForInboundCalls` → WP-11 decides port vs documented-skip |

**Jobs:** `qa_queue_import`/`qa_history_import`/`qa_ctl_reminders` consolidated in `api/cron/job-qa-engine` `[V]`; history import's Google Forms source is GATED G5; unscheduled (B5).

**Tables:** `006_quality.sql` applied (qa_forms/ctls/disputes/calibrations/kb_gaps + qe_*×5); **data: qa_audits 6,266 / qa_queue 1,668 / qa_volume 892 migrated+verified**; engine tabs schema-only → WP-30.

**Golden tests:** 64 tests `tests/golden/quality.test.ts` `[V]` — passing.

### 5.3 Productivity (`Productivity_Depricated`, `CC_APP=productivity` → `features/cx-productivity`)

**Pages:** 4/4 ported verbatim earlier (status-validation, my-status, tph 6-tab, productivity-analytics) + `tph-grid`; px-diff 0–0.26% per old harness `[B]` — re-verify WP-16.

**Server surface:**

| Status | Functions |
|---|---|
| OK | `getProdReviewPage`, `getProdFlag`, `decideProdFlag`, `getProdMyPage`, `getProdAnalyticsPage`, `getTphPage`, `getTphTrend`, `getTphTouchList`, `saveTphSlots`, `saveTphTask`, `saveTphCases`, `runTphStep`, `runTphDay`, `diagnoseTphTouches`, `runProductivityRange`, `jobProductivityDaily`, `jobTphHourly`, `jobTphPastDays`, `jobQuarterlyReport` |
| PORTED-AS | `getFlagAnalytics` → `prodFlagAnalyticsStep_` (job step; confirm no page-facing endpoint needed) → WP-16 |
| PORTED-AS | `backfillProductivityIntervals` → `jobs/backfill.ts` runner → WP-16 confirm |
| GATED (Gmail) | `importProductivityEmail` → WP-52-G4 |
| MISS | `redetectProductivityFlags` (admin maintenance) → WP-16 |

**Jobs:** `jobProductivityDaily` 7-step chain (snapshot→flags→flag_analytics→layers→tph_touches→tph_calls→tph_cases_rebuilt) ported; **scheduled in vercel.json** (06:30 daily). `jobTphHourly` scheduled :05/:55 hourly ≈ every 30 min — **legacy cadence is 15 min** `[V]` → WP-24 reconcile vs D-SCHED. `jobTphPastDays`, `jobQuarterlyReport`, `flag-detection`, `daily-layers`, `analytics-aggregation` scheduled.

**Tables:** all 12 prod_* migrated + counts verified `[V]`; prod_disputes intentionally deprecated.

### 5.4 Queue & Workforce (`Queue_deprecated`, `CC_APP=queue` → `features/cx-queue`)

**Pages:** 6/6 ported `[V]`.

**Server surface:** **100% of shard-listed functions verified ported** — `QueuePages`/`QueueCore`/`AgingHelp`/`Heatmap`/`Scheduler`/`TlQueue` full list incl. `schedulerImport`, `importOctober2026Shifts`, `setupSchedulerTables`, `rebuildTlQueueMetrics`, `installTlQueueTrigger` `[V]`.

**Jobs:** `jobDataTick` = freshdesk_sync→queue_aggregates→checkin_tick(+inflow) `[V]`; `jobNightlyAggregates` = agent_aggregates→inflow(hourly)→year_rollover `[V]`; `jobTlQueueMetrics`/`rebuildTlQueueMetricsEntry` behind `api/cron/job-tl-queue` `[V]`. **Gaps vs HB_PLAN:** `queue_snapshot` (4×/day) and `daily_report` (Freshchat/Maqsam intake) and `fc_messages` — check whether folded into dqCheckinTick_/vendor mirrors or missing → WP-12/WP-24. All unscheduled (B5).

**Tables:** `007_queue.sql` applied (22 tables + `014` tickets-schema fix); **all schema-only, zero data migrated** → WP-30.

**Golden tests:** `tests/golden/queue.test.ts` exists; coverage of heatmap/scheduler internals unverified → WP-22.

### 5.5 People & Performance (`People_deprecated`, `CC_APP=people` → `features/cx-people`)

**Pages:** 7/7 built pages ported verbatim `[V]`; `hard-cases`/`kpi-close` placeholders = parity (unbuilt in legacy).

**Server surface:** all page functions verified ported — full 1:1 lifecycle incl. soft-delete/restore, tasks, meetings, actions, notes, coaching, scorecard `[V]`.

| Status | Functions |
|---|---|
| PORTED-AS | `jobOneOnOneReminders`→`runOneOnOneReminders_`, `jobMissedOneOnOneCheck`→`runMissedOneOnOneCheck_`, `jobTaskReminders`→`runTaskReminders_`, `jobMeetingActionReminders`→`runMeetingActionReminders_` (cron routes exist; **name deviation from verbatim rule — document or alias**) → WP-13 |
| OK | `jobScorecardNightly` → `api/cron/scorecard-nightly` `scNightly_` `[V]` |
| MISS | `setupPeopleTables` (installer) → WP-13 DIAG |
| GATED (Google) | `importV1LeadTasks` (V1 workbook) → WP-52-G8 |

**Jobs:** 4 reminder cron routes exist (oo-reminders 15-min per D-SCHED, missed-1on1-check, task-reminders, meeting-reminders) + scorecard-nightly; all unscheduled (B5).

**Tables:** `008_people.sql` applied (19 tables; `008a` renamed colliding `sc_*`); **all schema-only** → WP-31.

**Golden tests:** `people.test.ts`, `scorecard.test.ts`, `kpi.test.ts` `[V]` — passing.

### 5.6 Operations (`Operations_deprecated`, `CC_APP=operations` → `features/cx-operations`)

**Pages:** `trackers` ported `[V]`; `escalation-matrix` placeholder = parity.

**Server surface:** 100% ported — `getTrackersPage`, `getTrackerRecords`, `addTrackerRecord`, `addTrackerField`, `updateTrackerField`, `createTracker`, `setupTrackers` `[V]`.

**Open questions for WP-14:** sheet-backed `storage_mode` trackers — port read path vs migrate-to-internal (shard spec: migrate then internal, D-DATA); escalation-matrix has no server fns — confirm page-parity correct; dropdown key integration with options service.

**Tables:** `009_operations.sql` applied (+5 built-in seeds); records schema-only → WP-32.

**Golden tests:** **none** — `ops-fakes.ts` scaffolded but has tsc errors and no test file → WP-00 fix + WP-20.

### 5.7 TL Desk (`Desk_deprecated`, `CC_APP=desk` → `features/cx-desk`)

**Pages:** 4/4 ported verbatim `[V]` (tl-performance 733-line ref implementation).

**Server surface:** 100% ported — `tlPerformancePage`, `tlpRateArea`, `tlpRateProject`, `kbTrackerPage`, `kbTrackerSave`, `otdSave`, `setupDesk`, `installDeskTriggers`, `kpiLogsPage`, `kpiLogSave`, `kpiLogRemove`, `mailDeskPage`, `mailDeskRefresh`, `mailApprovalDecide`, `mailApprovalReset`, `jobMailDesk` `[V]`.

**Jobs:** `mail_desk` ported; route `api/desk/job/mail` exists; **Gmail read GATED G2** — degrades honestly; unscheduled (B5).

**Tables:** `010_desk.sql` applied (7 tables); schema-only → WP-32.

**Golden tests:** **none** — `desk-fakes.ts` scaffolded, no test file → WP-21.

### 5.8 FCR (`FCR_deprecated`, `CC_APP=fcr`)

Unbuilt in legacy (shell-only bundle). Placeholder page = parity per D-FCR; `/api/fcr/daily` provides scorecard fcr input `[V]`. A dedicated plan is required **before** any build-out — explicitly out of scope here.

### 5.9 Shared platform (`features/shared`) — all-core libraries port

| Library (legacy) | Port | Status |
|---|---|---|
| Auth.js / ViewAs.js | `platform/identity.ts`, `lib/auth.ts`, `platform/viewas.ts` | OK `[V]` — but see auth-mock test regression |
| Config.js | `platform/settings.ts` (`configAll`, `dqSetting`, seeding) | OK `[V]` |
| Options.js | `platform/options.ts` | OK `[V]` |
| Popups.js / Notify.js / OneOnOneAlerts | `platform/popups.ts`, `platform/notify.ts`, `components/shell/OneOnOneAlerts` | OK `[V]` |
| Mailer.js | `platform/mail.ts` — dry-run + qa_* policy + mail_log | OK `[V]`; `sendGmailReply_` GATED G2 |
| Repo.js / Stores.js | `platform/repo.ts`, `platform/stores.ts` | OK `[V]`; `dqReadObjects_`/`dqRewrite_`/`dqUpsert_`/`dqReadLean_`/`dqMarkRun_`/`dqBumpCacheVersion_` added per hub brief `[H — verify WP-17]` |
| Health.js | `platform/health.ts` — HB_PLAN 23 rows verbatim, `hbBeat`/`hbRun`, ecosystem roll-up | OK `[V]` |
| WorkCalendar.js / PeopleCore / QueueCore / ProdCore / TlSnapshots / KpiPayout | `platform/calendar.ts`, `cx-people/lib/work-core.ts`, `cx-queue/lib`, `cx-people/lib/scorecard`, `cx-people/lib/kpi` | OK `[V]` |
| Code.js bootstrap | `/api/bootstrap` | OK `[V]` |
| Apps.js | `setAppUrl` ported; `connectToHub` N/A (D1) | OK `[V]` |

**Shell components:** `AppShell`, `BootSplash`, `ErrorBoundary`, `HashShim`, `NavIcon`, `OneOnOneAlerts`, `Popups`, `StateScreen`, `Toasts`, `ViewAs`, `registry.ts`, `ui.tsx` — all exist `[V]`; per-page parity matrices unverified → WP-17 + W4 sweeps.

## 6. Jobs vs HB_PLAN (23 jobs)

| Job | Implementation | Route | Scheduled? | Gap |
|---|---|---|---|---|
| roster_sync | — (HCT read gated) | — | no | G3/WP-51 |
| year_rollover | `jobs.ts:361` | `job-nightly-aggregates` | no | B5 |
| freshdesk_sync | `shared/jobs/freshdesk.ts` | `job-data-tick` | no | B5 |
| daily_report | `[H]` folded into vendor mirrors? | — | no | WP-24 |
| inflow | `buildInflowAggregates_` | `job-data-tick`, `job-nightly-aggregates` | no | B5 |
| queue_aggregates | `buildQueueAggregates_` | `job-data-tick` | no | B5 |
| queue_snapshot | `[H]` — check fold into checkin tick | — | no | WP-24 |
| checkin_tick | `dqCheckinTick_` | `job-data-tick` | no | B5 |
| prod_snapshot → prod_tph_cases_rebuilt | `jobs/productivity.ts` chain | `job-productivity-daily` | **yes** 06:30 | — |
| prod flag detect/analytics | same chain + `flag-detection`, `analytics-aggregation` | yes | — |
| productivity (layers) | `daily-layers` route | yes | — |
| jobTphHourly | `job-tph-hourly` | yes :05/:55 | **cadence 30 vs 15 min** → WP-24 |
| jobTphPastDays | `job-tph-past-days` | yes | — |
| jobQuarterlyReport | `job-quarterly-report` | yes | — |
| agent_aggregates | `buildAgentAggregates_` | `job-nightly-aggregates` | no | B5 |
| scorecard | `scNightly_` | `scorecard-nightly` | no | B5 |
| missed_1on1_check | `runMissedOneOnOneCheck_` | `missed-1on1-check` | no | B5 |
| oo_reminders | `runOneOnOneReminders_` | `oo-reminders` | no | B5 (15-min per D-SCHED) |
| task_reminders | `runTaskReminders_` | `task-reminders` | no | B5 |
| meeting_reminders | `runMeetingActionReminders_` | `meeting-reminders` | no | B5 |
| fc_messages | — (Freshchat gated) | — | no | WP-53 |
| tl_queue_metrics | `jobTlQueueMetrics` | `job-tl-queue` | no | B5 |
| mail_desk | `jobMailDesk` | `api/desk/job/mail` | no | B5 + G2 |
| qa_queue_import | `qaQueueStep_` | `job-qa-engine` | no | B5 |
| qa_history_import | `qaReconcileQueueLog`+import | `job-qa-engine` | no | B5 + G5 |
| qa_ctl_reminders | `qaCtlReminders` | `job-qa-engine` | no | B5 |

## 7. Data migration vs shard-80 inventory

**Migrated + count-verified (16):** config 130 · roster 44 · view_as 12 · prod_intervals 20,780 · prod_flags 1,217 · prod_flag_log 1,725 · prod_daily_layers 1,104 · prod_window_hist 106 · prod_flag_analytics 209 · prod_tph_days 27 · prod_tph_cases/touches/calls 7 each · qa_audits 6,266 · qa_queue 1,668 · qa_volume 892. (prod_tph_tasks/prod_quarterly_reports empty/absent in source.)

**Schema-only — zero data (needs migration code + run):**

| Group | Tables | WP |
|---|---|---|
| Core | Options, Popups, MailLog, Health, holidays, follow_up_done | WP-31 |
| Queue/live/year | tickets, esc_seen, aging_open_tickets, aging_flags, queue_status_submissions, queue_snapshots, agg_queue_now, agg_inflow_{daily,weekly,monthly,hourly}, agg_agent_perf, agg_agent_daily, agg_snapshots_today, refresh_log, agg_productivity_daily | WP-30 |
| People | actions, action_reviews, action_updates, action_task_details, action_planned_milestones, one_on_one_schedule, one_on_one_logs, one_on_one_topics, one_on_one_private_notes, meeting_series, meeting_series_members, meetings, meeting_attendees, pw_reminder_log, people_signals, notes, sc_daily, sc_behaviour, sc_months | WP-31 |
| Quality engine | qa_forms, qe_* (5), qa_access_log, ctl/dispute/calibration/kb tabs | WP-30 |
| Desk | tlp_resp_ratings, tlp_kb, tlp_otd, tlp_ticket_exclusions, tlp_shifts, tlp_queue_daily, tlp_team, tlp_area_metrics, kpi_behaviour_log, kpi_leave_log, kpi_ol_cases, mail_sla, mail_approvals, mail_approval_log | WP-32 |
| Operations | Trackers, TrackerFields + sheet-backed record tabs | WP-32 |
| Scheduler | sched_* (7 tables) | WP-30 |
| V1 workbook | `MigrateV1Tasks.js` V1 sheet + `scRefreshMonth_` workbook tabs | WP-31/G8 |

Migration code surface: `migration/migrate.ts` (4 tables) + `api/admin/migrate` MAPPINGS (16) — must be extended per module (`specs/cx-hub/80-data-migration.md` method) → WP-30/31/32; validator extension → WP-33.

## 8. Integrations & credentials

| Surface | State | Owner action |
|---|---|---|
| Maqsam | vendor mirror live (`shared/jobs/mirrors.ts`) | — |
| Freshdesk | adapter ported (`shared/jobs/freshdesk.ts`); key in `.env.production` only | copy → `.env.local` (WP-34) |
| Freshchat | **key absent everywhere** | WP-53 |
| Gmail read/send, Calendar, Drive, Forms, HCT sheet | all behind adapter seams returning `{configured:false}` / honest refusals | shard 90 (WP-52) |
| Google SA creds | in `.env.production`, absent from `.env.local` | WP-34 |
| `CRON_SECRET`, `MIGRATION_SECRET_KEY` | absent everywhere; blocks pg_cron scheduling | WP-50 |
| Mail policy | `mail_dry_run`+qa_*-only preserved `platform/mail.ts` `[V]` | — |

## 9. Cross-cutting aspects verified

Ported `[V]`: per-group rail/app context + hidden-route handling, page gates (role/reqs), View-as picker/banner/data-layer write refusal, popups + 1:1 alerts, appearance (theme/accents pine-blue-plum-rust/motion/transparency), en/ar i18n dictionary, HashShim `#/` `?page=` `?tab=`, catch-all + UnbuiltPage + state screens, boot splash, mail engine + dry-run + MailLog, options/dropdown service, heartbeat/ecosystem health, working calendar.

Unverified → W4 sweeps: per-page DOM/class/copy vs closures; view-as refusal on **every** write route; appearance matrix on every page; admin coverage (mail log UI, options editor, jobs/health UI); route-audit regen.

## 10. Missing/deferred function register

| Legacy fn | File | Class | WP |
|---|---|---|---|
| `runRosterSync`, `jobRosterSync` | RosterSync.js | GATED G1 | WP-51/52 |
| `jobFreshchatMessages`, `backfillFreshchat`, `backfillEscalationSightings` | FreshchatSync.js | GATED B3 | WP-53 |
| `diagnoseAging` | Setup.js | DIAG | WP-10 |
| `debugMyDay`, `doPost` | Assistant/Aggregates.js | `[H]` confirm | WP-10 |
| `jobQualityDaily`, `jobQualityBuildRetry`, `jobQualityHistory` | Quality.js | PORTED-AS? verify step-chain | WP-11 |
| `exportQaAuditsFlat` | Quality.js | MISS | WP-11 |
| `setupQuality`, `installQualityTriggers` | Quality.js | DIAG | WP-11 |
| `qaFreshdeskSetupHelp`, `verifyQaFreshdesk`, `diagnoseQaQueue`, `diagnoseQaQueueRows` | QaEngine.js | DIAG/vendor | WP-11 |
| `restartQualityQueueMigration`, `addCallControlToTextForms`, `seedQaNonTicketAudits`, `useVoiceFormForInboundCalls` | QaMigrate.js | DIAG | WP-11 |
| `setupPeopleTables` | Actions.js | DIAG | WP-13 |
| `importV1LeadTasks` | MigrateV1Tasks.js | GATED G8 | WP-52 |
| people `job*Reminders` names | PeopleTriggers/OneOnOneReminders | PORTED-AS `run*_` — document deviation | WP-13 |
| `getFlagAnalytics` | ProductivityApp.js | PORTED-AS `prodFlagAnalyticsStep_` — verify | WP-16 |
| `backfillProductivityIntervals` | ProductivityApp.js | PORTED-AS `jobs/backfill.ts` — verify | WP-16 |
| `importProductivityEmail` | ProductivityApp.js | GATED G4 | WP-52 |
| `redetectProductivityFlags` | ProductivityApp.js | MISS | WP-16 |
| `connectToHub` | Apps.js | N/A per D1 | — |
| `queue_snapshot`, `daily_report` cadence steps | Queue.js/Stores.js | `[H]` fold or port | WP-24 |
| store fns `dqReadObjects_` etc. | Stores.js | `[H]` verify present | WP-17 |

## 11. Programmatic remainder (beyond parity)

Cutover phases from `IMPLEMENTATION_TRACKER.md` (parallel run → write mode → disable GAS triggers → decommission) are out of WP scope until parity gates pass; WP-54 produces the readiness docs.
