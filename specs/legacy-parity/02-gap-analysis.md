# 02 - Gap Analysis (Phase 2)

Compares `01-legacy-inventory.md` with the new repository (`C:\Users\AHMED\KPIs\CX-Hub`). Everything not marked PRESENT is a migration gap.

Status vocabulary: **MISSING** (nothing), **STUB** (placeholder / disabled nav item / pass-through with no rules), **PARTIAL** (exists, known to differ), **UNVERIFIED** (exists; parity not yet measured), **PRESENT** (parity proven by the Phase 3/4 acceptance gates; nothing currently qualifies because no gate has run).

Source tier (from `01`): **A** full legacy source in repo, **B** server fragments only, **C** registry metadata only. For B and C modules the *expected behaviour* below is taken from the legacy purpose text and fragments and must be re-confirmed against the missing source (`06`).

## 1. State of the new repository (verified)

| Area | Evidence |
|---|---|
| Pages | `src/app/`: `page.tsx` (landing "Make the work visible."), `status-validation` (587 lines), `my-status` (81), `tph-grid` (255), `admin/config` (122), `admin/roster` (242), `auth/login`, `auth/logout`. No other page route exists. |
| Rail | `src/components/layout/SideRail.tsx`: legacy-styled rail whose other-app entries (Quality, Queue & Workforce, People & Performance, Operations & Trackers, TL desk, FCR) have `href: null` (disabled) and "Productivity analytics" is disabled. Admin group (Config, Roster) is not in the legacy rail. Class names are `legacy-*`, not the legacy classes. |
| APIs | `/api/{config,roster,view-as,prod/{flags,flags/[flagId],intervals,daily-layers},tph/{days,tasks,cases},quality/audits,fcr/daily,integrations/{gmail,freshdesk,freshchat,maqsam},cron/{flag-detection,daily-layers,analytics-aggregation},admin/{migrate,list-sheets},auth/{login,logout}}`. Integrations are placeholders returning "placeholder" JSON (`integrations/gmail/route.ts`). `quality/audits` and `fcr/daily` are `select *` / `insert` pass-throughs. |
| Domain logic | `src/lib/prod-validation.ts` (298 lines; flag rules), `auth.ts` (68), `prod-access.ts` (28), `supabase.ts` (99). **No TPH engine, no productivity engine, no scorecard/KPI payout, no queue/aging, no calendar, no notifications.** |
| Tests | `prod-validation.test.ts` imports the module. `tph.test.ts`, `productivity.test.ts` import only `vitest`: they assert on inline literals and prove nothing about the app. Playwright specs: auth, my-status, status-validation, responsive. |
| Data | `supabase/migrations/001_core_tables.sql` defines 3 tables (`config`, `roster`, `view_as`). The tracker claims 47 tables created; the live project was not inspectable in this session (MCP unavailable). `migration/migrate.ts` loads: config, roster, view_as, 12 `prod_*` tables, `qa_audits`, `qa_queue`, `qa_volume`. No FCR, people, queue, TL, KPI, calendar data. |
| Jobs | Three route handlers behind `CRON_SECRET`; **no `vercel.json`, no scheduler configured**. No TPH, quarterly report, 15-minute, or hourly jobs. |
| Styling | `globals.css` (1,781 lines) + Tailwind v4 utilities + `src/design/tokens/*.ts`. IBM Plex fonts loaded via `next/font` (matches legacy families). |
| Auth | Supabase auth stubs (`login`, `logout`, `src/proxy.ts`, 39 lines). Legacy identity model (Workspace email -> roster role) is only partially reproduced. |

## 2. Page matrix (40 routes + 1 hidden)

| FEATURE (route) | LEGACY EXISTS | NEW EXISTS | STATUS |
|---|---|---|---|
| Hub / `my-day` | Yes (C) | No | MISSING |
| Hub / `overview` (Home) | Yes (B) | `/` landing page, not the legacy Home | MISSING (different page) |
| Hub / `people-holidays` | Yes (B) | No (roster admin page is a different thing) | MISSING |
| Hub / `admin` | Yes (B) | `/admin/config`, `/admin/roster` only | PARTIAL |
| Hub / `ecosystem` (hidden) | Yes (C) | No | MISSING |
| Quality / `quality-scores` | Yes (C) | No | MISSING |
| Quality / `audit-queue` | Yes (C) | No | MISSING |
| Quality / `my-audits` | Yes (C) | No | MISSING |
| Quality / `ctls` | Yes (C) | No | MISSING |
| Quality / `disputes` | Yes (C) | No | MISSING |
| Quality / `calibration` | Yes (C) | No | MISSING |
| Quality / `kb-gaps` | Yes (C) | No | MISSING |
| Quality / `my-auditor-kpis` | Yes (C) | No | MISSING |
| Quality / `quality-analytics` | Yes (C) | No | MISSING |
| Quality / `qa-forms` | Yes (C) | No | MISSING |
| Productivity / `status-validation` | Yes (A) | `/status-validation` | UNVERIFIED (dispute section is dead in legacy; confidence/auto-accept, source panel, 3-lane strip need diffing) |
| Productivity / `my-status` | Yes (A) | `/my-status` (81 lines: fetches intervals and layers only) | PARTIAL (no flag list, no trend, no 45-day flags, no week/4-week sections) |
| Productivity / `productivity-analytics` | Yes (A) | Nav item disabled; no route | MISSING |
| Productivity / `tph` | Yes (A) | `/tph-grid` (single table; different route name) | PARTIAL (no tabs, tasks, cases entry, caps/touches, agent-by-hour, trend, run step/day, touch list) |
| Queue / `queue` | Yes (B) | No | MISSING |
| Queue / `aging` | Yes (B) | No | MISSING |
| Queue / `checkins` | Yes (B) | No | MISSING |
| Queue / `analytics` | Yes (C) | No | MISSING |
| Queue / `heatmap` | Yes (C) | No | MISSING |
| Queue / `scheduler` | Yes (B) | No | MISSING |
| People / `agents` | Yes (B) | No | MISSING |
| People / `one-on-ones` | Yes (B) | No | MISSING |
| People / `tl-tasks` | Yes (B) | No | MISSING |
| People / `meetings` | Yes (B) | No | MISSING |
| People / `my-actions` | Yes (B) | No | MISSING |
| People / `notes` | Yes (C) | No | MISSING |
| People / `coaching` | Yes (C) | No | MISSING |
| People / `hard-cases` | Yes (C) | No | MISSING |
| People / `kpi-close` | Yes (B) | No | MISSING |
| Operations / `trackers` | Yes (C) | No | MISSING |
| Operations / `escalation-matrix` | Yes (C) | No | MISSING |
| TL desk / `tl-performance` | Yes (B) | No | MISSING |
| TL desk / `kb-tracker` | Yes (C) | No | MISSING |
| TL desk / `kpi-logs` | Yes (B) | No | MISSING |
| TL desk / `mail-desk` | Yes (B) | No | MISSING |
| FCR / `fcr` | Yes, as registered page; unbuilt in legacy | `/api/fcr/daily` only | MISSING (decision D3) |

Totals: 40 legacy pages. UNVERIFIED 1, PARTIAL 3 (incl. Admin), MISSING 36. Sidebar items: legacy rail = 40 route entries + 7 other-app entries per app context; new rail = 4 working items, 7 disabled app entries, 2 admin items not in legacy.

## 3. Shell and cross-cutting matrix

| FEATURE | LEGACY EXISTS | NEW EXISTS | STATUS |
|---|---|---|---|
| Per-group rail with active indicator, tones, icons (40 icon paths) | Yes | Rail with 12 hand-drawn icons, `legacy-*` classes, no `.nav-ind` slider evidence | PARTIAL |
| Other-app single entries linking to the app's first accessible page | Yes | Disabled placeholders | STUB |
| Rail collapse (persisted) + mobile menu | Yes | Yes (`legacy-rail--collapsed`) | UNVERIFIED |
| Skip link, aria-current | Yes | Not verified | UNVERIFIED |
| Hash routes `#/<path>`, `?page=`, `?tab=` deep links, View Transitions | Yes | Path routes only | MISSING |
| Per-page error boundary + skeletons + section fold memory | Yes | `Loading` component only | PARTIAL |
| Boot splash (bear loader) | Yes | No (`Loading.tsx` generic) | MISSING |
| State screens (not set up, no access, nothing for you, could not start) | Yes | Not verified | UNVERIFIED |
| Role/extra gates per page (`En`, `Qt`) | Yes | `prod-access.ts` for prod APIs only | MISSING |
| View as (owner picker, banner, read-only guard, audit log, reload) | Yes | `/api/view-as` + `view_as` table; no picker/banner, no write guard | PARTIAL |
| Login pop-ups (`Popups` tab, poll, dialog) | Yes | No | MISSING |
| 1:1 in-app alerts + chime | Yes | No | MISSING |
| Toasts | Yes | Not verified | UNVERIFIED |
| Appearance: theme, accent (pine/blue/plum/rust), reduce transparency, reduce motion | Yes | `ThemeToggle`, `LanguageToggle` only | PARTIAL |
| Arabic/RTL (80-string dictionary) | Yes | `LanguageToggle` | UNVERIFIED |
| Dropdown "Other" rule (`Options`) | Yes | No | MISSING |
| Settings editor with typed validation, `updated_by/at` | Yes (server) | `/admin/config` (122 lines) | PARTIAL |
| Connected apps (`setAppUrl`) | Yes | N/A under a single app (decision D1) | DECISION |
| Email log (MailLog) UI | Yes | No | MISSING |
| Scheduled jobs / Health UI + ecosystem diagram | Yes | No | MISSING |
| Mail engine (`sendMail_`, dry-run, policy, MailLog) + `notify_` templates | Yes | No | MISSING |
| Gmail thread reply (`sendGmailReply_`) | Yes | No | MISSING |
| Time zone rules (Asia/Kuwait business tz; Cairo data tz; Kuwait fixed UTC+3) | Yes | Not centralised | MISSING |
| Work calendar (`getWorkingCalendar_`: holidays, TL ShiftPlan/OFF, days off) | Yes | No | MISSING |

## 4. Server API matrix (legacy public functions)

| Legacy function | New equivalent | STATUS |
|---|---|---|
| `getBootstrap` | none (no bootstrap payload: user, popups, options, appUrls, quality flags, viewAs, isOwner) | MISSING |
| `getDropdownOptions`, `addDropdownOption` | none | MISSING |
| `getConfig`, `setConfig`, `getConfigRows`, `saveConfigSetting` | `/api/config` | PARTIAL (typed validation per `validateConfigValue_` to verify) |
| `setAppUrl`, `connectToHub` | n/a | DECISION D1 |
| `getViewAsPeople`, `startViewAs`, `stopViewAs`, `getViewAsState` | `/api/view-as` | PARTIAL |
| `popupsPoll`, `oneOnOneAlerts`, `oneOnOneAlertsSeen` | none | MISSING |
| `getProdReviewPage`, `getProdFlag`, `decideProdFlag`, `getProdMyPage`, `getProdAnalyticsPage`, `getFlagAnalytics` | `/api/prod/flags`, `/api/prod/flags/[flagId]` | PARTIAL (no page-shaped endpoints; analytics page API missing) |
| `getTphPage`, `getTphTrend`, `saveTphSlots`, `saveTphTask`, `saveTphCases`, `runTphStep`, `runTphDay`, `getTphTouchList`, `diagnoseTphTouches` | `/api/tph/{days,tasks,cases}` | PARTIAL (CRUD only; no cap/cases/touch engines) |
| `getQueueHealthPage` | none | MISSING |
| `getEcosystemHealth`, `setupHealth` | none | MISSING |
| Quality: all (`Quality.js`, `QaEngine.js`, `QaMigrate.js`) | `/api/quality/audits` pass-through | MISSING (source absent) |
| Desk, People, Operations, Queue pages' functions | none | MISSING (source absent) |

## 5. Scheduled jobs matrix (23 heartbeat jobs; 4 Productivity triggers overlap them)

| Job(s) | Legacy | New | STATUS |
|---|---|---|---|
| prod_snapshot (Gmail CSV import), prod_flags (detect + auto-accept), prod_flag_analytics, productivity (layers), TPH touches / calls / rebuilt cases (`jobProductivityDaily`, ~08:30 Kuwait) | Yes | `cron/flag-detection`, `cron/daily-layers`, `cron/analytics-aggregation` (unscheduled; Gmail step is a placeholder; no TPH steps) | PARTIAL, not running |
| `jobTphHourly` (15 min), `jobTphPastDays` (hourly) | Yes | No | MISSING |
| `jobQuarterlyReport` (monthly, emails recipients) | Yes | No (table `prod_quarterly_reports` migrated) | MISSING |
| roster_sync, year_rollover | Yes (source absent) | No | MISSING |
| freshdesk_sync, daily_report, inflow, queue_aggregates, queue_snapshot, checkin_tick, fc_messages | Yes (source absent) | placeholder integration routes | MISSING |
| agent_aggregates, scorecard, missed_1on1_check, oo_reminders (every minute), task_reminders, meeting_reminders, tl_queue_metrics | Yes (source absent) | No | MISSING |
| mail_desk (every 10 min) | Yes (source absent) | No | MISSING |
| qa_queue_import, qa_history_import, qa_ctl_reminders | Yes (source absent) | No | MISSING |
| Heartbeat table + health computation | Yes | No | MISSING |

## 6. Integrations matrix

| Integration | Legacy | New | STATUS |
|---|---|---|---|
| Gmail read (Agents Activity CSV; Mail desk) | Yes | placeholder | MISSING |
| Gmail send / thread reply | Yes | No | MISSING |
| Outbound mail with policy + dry-run + log | Yes | No | MISSING |
| Freshdesk (tickets, activities, ticket links) | Yes | placeholder | MISSING |
| Freshchat / Maqsam (chats, calls) | Yes | placeholders | MISSING |
| Google Calendar / Drive (My day, task files) | Yes (source absent) | No | MISSING |
| Roster master (HCT) sync | Yes | `roster` table, manual migrate | MISSING (sync) |
| OL sheet, QA Voice/Texting forms | Yes (source absent) | No | MISSING |

## 7. Data matrix

| Domain | Legacy tables | New | STATUS |
|---|---|---|---|
| Core (`Config`, `Roster`, `ViewAs`) | 3 | 3 migrated | PRESENT in data; `Options`, `Popups`, `MailLog`, `Health` MISSING |
| Productivity + TPH | 12 | 12 migrated (counts verified in tracker) | PRESENT in data (schema vs sheet to re-verify) |
| Quality | `QA_HEADERS` (absent) | `qa_audits` 6,266, `qa_queue` 1,668, `qa_volume` 892 | PARTIAL (history only; CTL, dispute, calibration, forms, KB tables unknown) |
| FCR | `sc_daily.fcr_*` (scorecard) | `fcr_daily` table + route | PARTIAL / unknown source |
| Queue/aging/inflow/snapshots/check-ins | ~12 | none | MISSING |
| People (1:1s, actions, tasks, meetings, notes, coaching, hard cases) | ~8 | none | MISSING |
| Scorecard, behaviour, KPI logs, OL, TL snapshots | ~9 | none | MISSING |
| Work calendar, holidays | 2+ | none | MISSING |
| Operations trackers, escalation matrix | unknown | none | MISSING |

## 8. Per-module gap detail

Scope key: S small, M medium, L large, XL very large. Destination paths follow the existing flat convention (`src/app/<route>/page.tsx`, `src/app/api/<module>/...`, `src/lib/<module>/...`, `supabase/migrations/NNN_<module>.sql`); to be re-evaluated against D1/D2 in `06`.

### Module 1 - Hub (shell, Home, Admin, People & holidays, My day, Ecosystem)
- **Legacy sources**: `index.html` (shell, registry, rail, pop-ups, alerts, View as, appearance), `Code.js`, `Apps.js`, `Auth.js`, `ViewAs.js`, `Config.js`, `Options.js`, `Popups.js`, `Mailer.js`, `Notify.js`, `Health.js`, `WorkCalendar.js`, `PeopleCore.js`. **Absent**: Home page UI and its data (`QueueBoard`, open actions, tasks, meetings cards), Admin page UI (roster editor, settings, dropdown choices, email log, jobs, connected apps, appearance), People & holidays UI, `Assistant.js` (My day), ecosystem 3D page.
- **Destination**: `src/components/shell/*` (Rail, ViewAs, Popups, OneOnOneAlerts, Toasts, ErrorBoundary, BootSplash), `src/app/{overview,admin,people-holidays,my-day,ecosystem}/page.tsx`, `src/lib/{auth,bootstrap,config,options,mail,notify,health,calendar}`, `src/app/api/{bootstrap,options,popups,alerts,mail-log,health,calendar}`; migrations for `options`, `popups`, `mail_log`, `health`, `holidays`.
- **Dependencies**: roster + config (done), Supabase auth with Google Workspace domain restriction, queue snapshots (Home cards), people actions (Home cards), Calendar/Drive/Gmail OAuth (My day).
- **UI components**: Rail (+indicator), Brand, ViewAsBanner/Picker (dialog), PopupDialog, AlertStack, Toasts, StateScreen, Page shell `dq-head`, Section (collapsible, persisted), Chip, Note, Skeleton, Segmented control, form controls; Admin tabs (Roster, Settings, Dropdown choices, Email log, Scheduled jobs, Connected apps?, Appearance).
- **Scope**: shell M; Admin L; Home L (blocked on source); People & holidays M; My day L (blocked, needs Google APIs); Ecosystem M-L (3D, blocked on source).

### Module 2 - Quality (10 pages)
- **Legacy sources**: none in repo (`Quality.js`, `QaEngine.js`, `QaMigrate.js` absent). Facts known: weekly/daily audit quota "Four audits per agent per day"; live scoring form; result emailed to agent; CTL within 2 working days (3 over a day off), outcome acknowledged or dispute; TL on shift may close any open CTL (uses `tlsOnShift_`, `TlSnapshots.js`); disputes decided at weekly meeting or escalated to Mohamed; calibration vs TL reference on same tickets; KB gaps flagged on audit day, KB update list; auditor KPIs per month; forms: questions per channel, weights, critical questions zeroing the audit; `qa_*` pop-ups and the only non-admin mail allowed by policy; `qa_engine_live` setting; imports from Voice and Texting QA forms; `boot.quality = { auditor, kbEditor }` flags.
- **Destination**: `src/app/{quality-scores,audit-queue,my-audits,ctls,disputes,calibration,kb-gaps,my-auditor-kpis,quality-analytics,qa-forms}/page.tsx`, `src/lib/quality/*`, `src/app/api/quality/*`, migrations for audits, audit answers, forms, questions, CTLs, disputes, calibration sets, KB gaps, auditors, queue, jobs `qa_queue_import|qa_history_import|qa_ctl_reminders`.
- **Dependencies**: roster + TL shift snapshots (CTL on-shift rule), mail engine with `qa_*` policy, popups, work calendar (working-day deadlines), existing `qa_*` data, KPI payout (quality 35%).
- **Scope**: XL. **Blocked** on source for exact forms, scoring math, CTL/dispute state machines.

### Module 3 - FCR
- **Legacy sources**: `WorkCore.js` (`scAggregate_`, `scDerive_`: FCR % = passed / (passed + failed), excluded ignored, from the V1 workbook FCR tab; whole-month when no date column), `KpiPayout.js` (weight 15, bands 90/85/80, probation edges, flags), `TlSnapshots.js` (`tlp_team.fcr`). The page itself (scoring, raw data, analytics, insights) is **unbuilt** in legacy.
- **Destination**: `src/app/fcr/page.tsx`, `src/lib/fcr/*`, `src/app/api/fcr/*`, `fcr_daily` (+ passed/failed/excluded).
- **Scope**: M if parity means the registered placeholder plus scorecard FCR input; L-XL if the described module must be built (D3).

### Module 4 - Queue & Workforce (6 pages)
- **Legacy sources present**: `QueueCore.js` (queue view, aging bands, snapshots, check-in slots/states, `getQueueHealthPage`, group-name matching, `FD_TICKET_HEADERS`), `Stores.js` (`DQ_SETTINGS`: slots 09:30/13:00/18:30/22:00 Kuwait, read delay 20 min, open/due windows 15/30 min, 12 aging band edges, excluded groups, `queue_map`, our-queue text, open/actionable statuses), `TlSnapshots.js`, `WorkCalendar.js`, `Health.js` plan rows. **Absent**: `QueuePages.js`, `AgingHelp.js`, `Heatmap.js`, `Scheduler.js`, `TlQueue.js`, Freshdesk sync, `Aggregates.js`, `Queue.js`.
- **Destination**: `src/app/{queue,aging,checkins,analytics,heatmap,scheduler}/page.tsx`, `src/lib/queue/*`, `src/app/api/queue/*`, jobs for Freshdesk sync (15 min), queue aggregates, snapshots (4/day), check-in tick, inflow (hourly), daily report intake, `fc_messages`, `tl_queue_metrics`.
- **Dependencies**: Freshdesk API credentials, Freshchat/Maqsam report ingestion, roster/TLs, work calendar, aging scale tokens `--cx-age-0..6`.
- **Scope**: XL. `queue`, `aging`, `checkins`: L with present source; `analytics`, `heatmap`, `scheduler`: L each, source absent.

### Module 5 - People & Performance (9 pages)
- **Legacy sources present**: `PeopleCore.js` (directory, Kuwait date helpers, working-day arithmetic, manager check), `WorkCore.js` (tasks out with hours/fit/risk, next meetings, actions, scorecard aggregation and derivation), `OneOnOneAlerts.js`, `KpiPayout.js`, `Popups.js`, `Notify.js`. **Absent**: `Actions.js`, `OneOnOnes.js`, `Tasks.js`, `Meetings.js`, `Notes.js`, `Coaching.js`, `Reminders.js`, `PeopleTriggers.js`, `OneOnOneReminders.js`, `OneOnOneDelete.js`, `MigrateV1Tasks.js`, `Scorecard.js`, `agents` page code.
- **Destination**: `src/app/{agents,one-on-ones,tl-tasks,meetings,my-actions,notes,coaching,hard-cases,kpi-close}/page.tsx`, `src/lib/people/*`, `src/lib/kpi/*` (port of `KpiPayout.js` verbatim, with unit tests against its documented bands), `src/app/api/people/*`; tables `one_on_one_schedule`, `one_on_one_logs` (soft delete), `actions`, `action_task_details`, `action_updates`, `action_planned_milestones`, notes, coaching signals, hard cases, `sc_daily`, `sc_behaviour`, `sc_months`.
- **Dependencies**: mail engine, popups, alerts, calendar, productivity engine, quality and FCR inputs, KPI logs (Desk).
- **Scope**: XL. `kpi-close` L (lock workflow, exceptions with reason).

### Module 6 - Operations & Trackers (2 pages)
- **Legacy sources**: none (`Trackers.js` absent). Known: trackers for blocked customers, promocodes, operational loss, customer strikes "and more" read live (no scheduled jobs); dropdown keys like `tracker.promocodes.reason`; optional `CC_TRACKERS_SPREADSHEET_ID` property (defaults to CC2 Core); escalation matrix "who, which issue, after how long".
- **Destination**: `src/app/{trackers,escalation-matrix}/page.tsx`, `src/lib/trackers/*`, `src/app/api/trackers/*`, tables per tracker.
- **Scope**: L-XL. **Blocked** on source.

### Module 7 - TL desk (4 pages)
- **Legacy sources present**: `TlSnapshots.js` (`tlp_shifts`, `tlp_queue_daily`, `tlp_team`, `tlp_area_metrics`), `KpiPayout.js` (`kpi_behaviour_log`, `kpi_leave_log`, `kpi_ol_cases`, leave types Sick/Emergency/Absent without notice/Other, one entry = one leave counted on first day), `Mailer.js` `sendGmailReply_`. **Absent**: `TlPerformance.js`, `KpiLogs.js`, `MailDesk.js`, KB tracker code, `MD_HEADERS`, `TLP_HEADERS`.
- **Destination**: `src/app/{tl-performance,kb-tracker,kpi-logs,mail-desk}/page.tsx`, `src/lib/desk/*`, `src/app/api/desk/*`, Gmail OAuth with `gmail.send`.
- **Scope**: XL (mail desk and TL performance L each; kpi-logs M; kb-tracker M).

### Module 8 - Productivity completion (pages A-tier)
- **Legacy sources**: complete (see `01` E1-E4).
- **Gaps**: `productivity-analytics` page and `prodAnalytics_` / `getProdAnalyticsPage`; full TPH engine (pure rules `tph*_`, slot grid resolution, cases resolution, cap formula, touches from activity rows, call minutes, trend, diagnose); `my-status` full page; Gmail import; `jobTphHourly`, `jobTphPastDays`, `jobQuarterlyReport`; confidence scoring (`prodConfidenceScore_`, tracker box unchecked); productivity engine (`computeProductivityForDate_`, 26 columns x raw/effective); settings seeding (`PROD_SETTINGS` + superseded-defaults rule).
- **Scope**: L (TPH engine alone ~1,500 legacy lines).

### Module 9 - Cross-cutting infrastructure (all modules)
- Identity: Workspace-email -> roster role resolver (`currentUser_`), owner concept, View as write guard at the data layer (RLS or service-layer guard equivalent to `viewAsGuard_`).
- Settings service with defaults seeding and typed validation (`CONFIG_DEFAULTS`, `DQ_SETTINGS`, `PROD_SETTINGS` and absent modules' settings).
- Job runner: schedule (`vercel.json` or Supabase cron), heartbeat writer, run log (`refresh_log`), idempotent upserts (`dqUpsertIn_`), locks (`withLock_` equivalent: advisory locks or `INSERT ... ON CONFLICT`).
- Time utilities: Kuwait fixed offset, Cairo data tz, `dqWallToUtc_`, 15-minute slot arithmetic, working-day math.
- Mail engine and notification templates.
- Visual regression harness and role-based fixtures (`03`).
- **Scope**: L.

## 9. Gap totals

- Pages: 36 MISSING, 3 PARTIAL, 1 UNVERIFIED (+ hidden `ecosystem` MISSING).
- Of the 36 missing pages, legacy source exists in some form for 16 (1 tier A: `productivity-analytics`; 15 tier B, fragments only); for 20 (tier C) only the registry text exists.
- Server functions: ~3 PARTIAL families, all others MISSING.
- Jobs: 0 of the 23 heartbeat jobs (4 Productivity triggers overlap them) run in production form in the new repo.
