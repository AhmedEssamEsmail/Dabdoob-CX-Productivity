# WP-10 — cx-hub audit (Hub)

Run 2026-11-06 against HEAD (`2ca871a` + concurrent wave-1 fixes). Legacy source: `Command_Center_V2_deprecated` — hub-owned public surface in `Aggregates.js`, `Apps.js`, `Assistant.js`, `Code.js`, `FreshchatSync.js`, `FreshdeskSync.js`, `Health.js`, `OneOnOneAlerts.js`, `Popups.js`, `QueueCore.js`, `RosterSync.js`, `Setup.js`, `Triggers.js`, `ViewAs.js` (shared-core files `Auth/Config/Repo/Stores/Mailer/Notify/Options/PeopleCore/ProdCore/WorkCore/WorkCalendar/TlSnapshots/KpiPayout/HomeCards/Queue.js/AppBuild.js` expose no public functions — `*_` internals only, audited under WP-17). Page extracts: `.devin/work/extract/hub/pages/*.closure.js`.

**Verdict:** all 5 pages are verbatim-closure ports at parity (class vocabulary, copy, call-wiring, gates). 62 public functions mapped: 36 PORTED / 4 PORTED-AS / 12 N/A (GAS-only) / 2 DIAG / 8 GATED (5 ported-lib awaiting their source gate, 3 unported Freshchat ingest). Three real defects found and fixed inline: (1) `markFollowUpDone`, `setAssistantSettings` and `installAssistantDigestTrigger` wrote to the core store/config without `assertWritable()` — under View-as the legacy wrapped sheet refused those writes, the port did not; (2) `jobRosterSync` had no port — `roster_sync` could never heartbeat (`dqSyncRoster_` only logged runs); (3) the overview route passed `title: 'Hub home'` where the registry/legacy title is `Home`. Larger residuals → WP-F15, WP-F16, WP-F17.

## 1. Legacy public-function matrix

Public = no trailing underscore, verified by `grep -n "^function [a-zA-Z0-9_$]*[^_](" *.js` across all legacy files (62 fns; digit-containing names like `setupV2`/`setPersonV2Fields` included).

| Legacy fn | File:line | Port | Route | Status |
|---|---|---|---|---|
| `doGet` | Code.js:9 | — | — | N/A — GAS `HtmlService` entry; Next routes serve pages, `/api/bootstrap` replaces the inlined `__CC_BOOT__` |
| `getBootstrap` | Code.js:30 | `platform` bootstrap | `GET /api/bootstrap` | PORTED (user/popups/options/appUrls/viewAs/isOwner/quality flags) |
| `getDropdownOptions` | Code.js:58 | `platform/options` | `GET /api/options/[listKey]` | PORTED |
| `addDropdownOption` | Code.js:64 | `platform/options` | `POST /api/options/[listKey]` | PORTED (ungated-write finding is WP-18's WP-F8) |
| `getConfig` | Code.js:69 | `admin.ts:25` `getAdminConfig` | `GET /api/hub/admin?fn=config` | PORTED |
| `setConfig` | Code.js:75 | `admin.ts:31` `setAdminConfig` | `POST /api/hub/admin` `action=setConfig` | PORTED |
| `getConfigRows` | Code.js:81 | `admin.ts:39` | `GET /api/hub/admin` | PORTED |
| `saveConfigSetting` | Code.js:87 | `admin.ts:45` | `POST /api/hub/admin` `action=saveConfig` | PORTED |
| `setupDataSpreadsheet` | Code.js:96 | migrations + `settings.ts:238` `seedSettings` | — | PORTED-AS — Postgres DDL replaces `ensureTable_`; config/options/popups/mail_log seeds via `seedSettings` |
| `doPost` | Aggregates.js:489 | — | `POST /api/queue/refresh` | N/A — GAS dispatcher whose only action (`refresh`) routes to `refreshQueueNow`; a Next route per fn replaces the dispatcher |
| `jobDataTick` | Aggregates.js:422 | `cx-queue/lib/jobs.ts:339` | `GET/POST /api/cron/job-data-tick` (CRON_SECRET + `requireJobCaller`) | PORTED — `dqStep_` names verbatim (`freshdesk_sync`, `queue_aggregates`, `inflow` 55-min cadence, `checkin_tick`) |
| `refreshQueueNow` | Aggregates.js:443 | `cx-queue/lib/pages.ts:246` → `jobs.ts:363` `refreshQueueNowJob` | `POST /api/queue/refresh` | PORTED (120 s throttle, `requireRole(admin,tl)` + `assertWritable()` preserved) |
| `jobNightlyAggregates` | Aggregates.js:501 | `jobs.ts:376` | `/api/cron/job-nightly-aggregates` | PORTED — `agent_aggregates`/`inflow`/`year_rollover` steps verbatim; legacy's `productivity`/`scorecard` steps were conditional cross-app calls (`typeof dqProductivityRollup_ === 'function'`) — in the unified app those run on their own cron routes instead (WP-13/WP-16) |
| `getAgentsPage` | Aggregates.js:535 | `cx-people/lib/agents-page.ts:13` | `GET /api/people/agents` | PORTED |
| `getHomePage` | Aggregates.js:568 | `aggregates.ts:63` | `GET /api/hub/home` | PORTED |
| `setAppUrl` | Apps.js:50 | `admin.ts:59` | `POST /api/hub/admin` `action=setAppUrl` | PORTED — verbatim incl. URL-checks-before-viewas-guard ordering |
| `connectToHub` | Apps.js:74 | — | — | N/A (D1) — cross-app handshake; unified deployment needs none |
| `searchMyMail` | Assistant.js:351 | `myday.ts:453` | `POST /api/hub/my-day` `action=searchMail` | PORTED |
| `markFollowUpDone` | Assistant.js:454 | `myday.ts:567` | `action=followUpDone` | PORTED — `assertWritable()` added this audit |
| `getMyDayPart` | Assistant.js:578 | `myday.ts:696` | `GET /api/hub/my-day?part=` | PORTED |
| `getMyDay` | Assistant.js:585 | `myday.ts:703` | `GET /api/hub/my-day` | PORTED |
| `jobWarmMyDay` | Assistant.js:595 | `myday.ts:713` | none | PORTED-lib, GATED G3 — no cron route until the Google adapter lands → WP-F15 |
| `installMyDayWarmTrigger` | Assistant.js:609 | — | — | N/A — GAS `ScriptApp` trigger management |
| `removeMyDayWarmTrigger` | Assistant.js:620 | — | — | N/A — same |
| `debugMyDay` | Assistant.js:636 | `myday.ts:723` | `action=debug` | PORTED (the closure never calls it — the page only prints "run debugMyDay in the Apps Script editor"; surface kept for parity) |
| `createFocusBlock` | Assistant.js:663 | `myday.ts:736` | `action=focusBlock` | PORTED |
| `setAssistantSettings` | Assistant.js:684 | `myday.ts:757` | `action=setSettings` | PORTED — `assertWritable()` added this audit |
| `installAssistantDigestTrigger` | Assistant.js:702 | `myday.ts:779` | `action=installDigest` | PORTED-AS — GAS trigger becomes the `assistant_digest_installed` config flag a digest cron must read → route in WP-F15; `assertWritable()` added this audit |
| `jobAssistantMorningDigest` | Assistant.js:734 | `myday.ts:817` | none | PORTED-lib, GATED G3 (Gmail send) — no cron route → WP-F15 |
| `jobFreshchatMessages` | FreshchatSync.js:131 | — | none | **GATED B3** — transcript-report ingest (`fcFetchDay_`/`fcLoadDay_`/`hbRun_('fc_messages')`) not ported; `FRESHCHAT_API_KEY` absent; `fc_messages` rows currently arrive via the vendor/mirror layer → WP-F16 |
| `backfillFreshchat` | FreshchatSync.js:143 | — | none | **GATED B3** — same ingest loop → WP-F16 |
| `jobFreshchatBackfill` | FreshchatSync.js:165 | — | none | **GATED B3** — self-rescheduling one-off GAS trigger; port shape TBD (pg_cron/vercel) → WP-F16 |
| `installFreshchatTrigger` | FreshchatSync.js:172 | — | — | N/A — GAS trigger management |
| `backfillEscalationSightings` | FreshdeskSync.js:166 | `freshdesk.ts:169` `fdRecordSightings_` (live path) | none | **GATED** — the one-off backfill reads the legacy Google archive sheet; needs archive migration/adapter → WP-F17 |
| `runFreshdeskFullSync` | FreshdeskSync.js:262 | `freshdesk.ts:322` | none | PORTED-lib — editor-run admin fn in legacy too; GATED on `FRESHDESK_API_KEY`; reachable via job-runner when enabled |
| `getEcosystemHealth` | Health.js:402 | `health.ts:541` `ecosystemHealth` / `getEcosystemHealth` | `GET /api/hub/ecosystem`, `GET /api/health` | PORTED |
| `setupHealth` | Health.js:411 | `health.ts:568` | `POST /api/health` (admin) | PORTED |
| `oneOnOneAlerts` | OneOnOneAlerts.js:88 | `platform/notify.ts:229` | `GET /api/alerts/one-on-one` | PORTED (`currentEmail` scope) |
| `oneOnOneAlertsSeen` | OneOnOneAlerts.js:113 | `platform/notify.ts:261` | `POST /api/alerts/one-on-one` | PORTED |
| `popupsPoll` | Popups.js:70 | `platform/popups.ts` | `GET /api/popups` | PORTED (`currentEmail` scope) |
| `getQueueHealthPage` | QueueCore.js:256 | `cx-queue/lib/server.ts` | `GET /api/queue/health` | PORTED (shared `Of.queueHealth` on hub pages) |
| `jobRosterSync` | RosterSync.js:265 | `roster.ts:373` — **added this audit** | none | PORTED-lib, GATED G1 — verbatim `dqStep_('roster_sync')` semantics (heartbeat + `dqLogRun_` on error + `hbFlush_`); no cron route until the HCT mirror lands → WP-F15 |
| `syncRosterNow` | RosterSync.js:272 | `roster.ts:360` | `POST /api/hub/roster` `action=syncRoster` | PORTED (legacy had no heartbeat on the manual run — port matches) |
| `runRosterSync` | RosterSync.js:278 | — | — | PORTED-AS → `syncRosterNow`; editor console-log listing has no Next equivalent and no caller |
| `setPersonOverrides` | RosterSync.js:313 | `roster.ts:403` | `action=setOverrides` | PORTED |
| `getRosterAdmin` | RosterSync.js:376 | `roster.ts:479` | `GET /api/hub/roster` | PORTED |
| `setPersonV2Fields` | RosterSync.js:397 | `roster.ts:522` | `action=setPerson` | PORTED |
| `addHoliday` | RosterSync.js:416 | `roster.ts:567` | `action=addHoliday` | PORTED |
| `removeHoliday` | RosterSync.js:432 | `roster.ts:600` | `action=removeHoliday` | PORTED |
| `setupV2` | Setup.js:57 | migrations + `seedSettings` | — | PORTED-AS — see `setupDataSpreadsheet` |
| `applyExcludedGroups` | Setup.js:113 | — | — | DIAG — admin console diagnostic (re-seed + rebuild + `dqLogAgingDiagnosis_` console dump); not user-facing |
| `diagnoseAging` | Setup.js:162 | — | — | DIAG — same shape (rebuild + `dqLogAgingDiagnosis_`, which is not ported) |
| `installDataQueueTriggers` | Setup.js:179 | — | — | N/A — GAS trigger management |
| `installAllTriggers` | Triggers.js:22 | — | — | N/A — GAS trigger management; schedules live in `vercel.json`/pg_cron |
| `removeQualityTriggers` | Triggers.js:39 | — | — | N/A — same |
| `removeProductivityTriggers` | Triggers.js:55 | — | — | N/A — same |
| `removePeopleTriggers` | Triggers.js:71 | — | — | N/A — same |
| `removeQueueTriggers` | Triggers.js:87 | — | — | N/A — same |
| `getViewAsPeople` | ViewAs.js:52 | `platform/viewas` | `GET /api/view-as/people` | PORTED |
| `startViewAs` | ViewAs.js:67 | `platform/viewas` | `POST /api/view-as` | PORTED |
| `stopViewAs` | ViewAs.js:79 | `platform/viewas` | `DELETE /api/view-as` | PORTED |
| `getViewAsState` | ViewAs.js:87 | `platform/viewas` | `GET /api/view-as` | PORTED |

Store-helper check (WP-17 overlap, recorded here for completeness): `dqReadObjects_` → `platform/stores.ts:26` `readStore` (missingOk kept); `dqReadLean_` → N/A (two-pass sparse sheet read, Postgres needs none — documented `stores.ts:5-9`); `dqRewrite_` → `cx-queue/lib/jobs.ts:68`; `dqUpsert_` → PORTED-AS as Supabase `.upsert` at write sites; `dqMarkRun_` → `jobs.ts:63` + `cx-desk/lib/jobshared.ts:10`; `dqBumpCacheVersion_`/`dqCacheVersion_` → N/A-by-design (cache-stamp versioning dropped: Postgres reads are direct, no staleness window — `stores.ts:7-9`).

## 2. Page parity checklist

All 5 page components are verbatim closure ports. Class vocabulary was diffed mechanically (closure-only classes: none; port-only `md-*`/`eco3-*`/page classes: none for all five). `oi("fn")`/`Ni("fn")`/`zo("fn")` call tables all map 1:1 to fetches in `hub-shared.tsx` (`Of`/`Vi`/`Ln`/`Fs`/`Ng`/`Ug`). Registry rows match the legacy extract verbatim (`registry.json` ↔ `registry.ts` generated block; `ecosystem` is URL-only in both — absent from `PAGES`).

| Page (fn) | Closure | Component | Call coverage | Verdict |
|---|---|---|---|---|
| `overview` (`Rg`) | `overview.closure.js` | `overview-page.tsx` (541 L) | `getHomePage`→`/api/hub/home`; `getQueueHealthPage`→`/api/queue/health`; `refreshQueueNow`→`POST /api/queue/refresh` | parity — role subtitles, ecosystem link + fallback, "Needs you today"/"Do now", dayrail, oldest table, specialist coaching copy, refresh cooldown verbatim. **Fixed:** route title `Hub home`→`Home` (Vf load-state title) |
| `admin` (`Nm` + `Dm`/`Im`/`Ln`/`Pf`/`Tm`) | `admin.closure.js` | `admin-page.tsx` (441 L) + `Ln` in `hub-shared.tsx` | `getConfig`/`setConfig`/`getConfigRows`/`saveConfigSetting`/`setAppUrl`→`/api/hub/admin`; options fns→`/api/options/*`; view-as fns→`/api/view-as*` | parity — deps `Dm`(:4208→:111), `Im`(:4386→:214), `Pf` "Not built yet"(:4472→:285/:296), `Tm`(:4626→:333), `Nm`(:4899→) all present verbatim |
| `people-holidays` (`Ig`) | `people-holidays.closure.js` | `people-holidays-page.tsx` (485 L) | `getRosterAdmin`→GET `/api/hub/roster`; `setPersonV2Fields`/`setPersonOverrides`/`addHoliday`/`removeHoliday`/`syncRosterNow`→POST actions | parity — `ph-*`/roster/holiday classes match; copy spot-checked verbatim incl. "Not found in the HCT", "No holidays yet. Add each country's public holidays above.", "A 1:1 due on a holiday in the person's country is never counted as missed." |
| `my-day` (`Zm`) | `my-day.closure.js` | `my-day-page.tsx` (716 L) | `getMyDay`/`getMyDayPart`→GET `/api/hub/my-day(?part)`; `searchMyMail`/`createFocusBlock`/`setAssistantSettings`/`markFollowUpDone`/`installAssistantDigestTrigger`→POST actions | parity — every `md-*` class matches; copy verbatim incl. "Still loading…", "Nothing is waiting on you.", "Search mail, e.g. from:aramex", owner-only gate |
| `ecosystem` (`Zb` + `Jb` + Three.js) | `ecosystem.closure.js` (7,450 L) | `ecosystem-page.tsx` (2,660 L) | `getEcosystemHealth`→`/api/hub/ecosystem` (`Ng.get`); `oneOnOneAlerts`/`oneOnOneAlertsSeen`/`popupsPoll`→shared routes | parity — Three.js scene inline verbatim (shaders, GLTF loader, camel credit, mirror); `Zb` gate "The ecosystem map is for team leads and admins." + `document.title` effect + 300 s poll + `eco3-head`/credit verbatim; `#/` links via `Lr`+`HashShim` |

## 3. Gate matrix

`requireRole_`/`viewAsGuard_`/`assistantOwnerEmail_` → `requireRole`/`assertWritable`/`requireAssistantOwner_`. Enforced in the data layer (thin routes stay safe) and re-stated at route level.

| Entry | Legacy gate | Port gate | Match |
|---|---|---|---|
| `getHomePage` | `requireRole_(admin,tl,agent)` | `aggregates.ts:65` | ✓ |
| `getRosterAdmin` + roster writes | `requireRole_(admin)` + wrapped-sheet write refusal | `roster.ts:359,382,403,522,567,600` + `assertWritable()` on every write | ✓ |
| `getConfig*`/`setAppUrl`/`saveConfigSetting` | `requireRole_(admin)` (+guard inside `saveConfigValue_`) | `admin.ts:26,32-33,40,46-47,60,70` | ✓ |
| `getQueueHealthPage` / `refreshQueueNow` (shared on hub pages) | `admin,tl` / `admin,tl`+guard+lock | `server.ts:71` / `pages.ts:247-248` | ✓ |
| My day fns | `assistantOwnerEmail_()` — owner only, real caller (not View-as target) | `requireAssistantOwner_()` `myday.ts:52` on all 7 fns + `jobWarmMyDay`/`jobAssistantMorningDigest` | ✓ |
| My day writes | wrapped-sheet refusal under View-as | `assertWritable()` in lib (`:568,737,758,780`) + route-level `POST` guard (`my-day/route.ts:35`) | ✓ **fixed this audit** (3 fns lacked the lib guard) |
| `ecosystem` page/route | `Zb` client gate + `requireRole_(admin,tl)` in `getEcosystemHealth` | `Zb` verbatim client gate + `ecosystem/route.ts:9` `requireRole(admin,tl)` | ✓ |
| `setupHealth` | `requireRole_(admin)` | `health/route.ts:20` | ✓ |
| `jobDataTick`/`jobNightlyAggregates`/`jobRosterSync` | `viewAsSystem_` + `requireJobCaller_` | `requireJobCaller()` (`identity.ts:139`: admin or sessionless-cron) + CRON_SECRET on the routes | ✓ |
| `popupsPoll`/`oneOnOneAlerts(Seen)` | `currentEmail_()` scope | `currentEmail()` | ✓ |

## 4. Jobs / heartbeat map

`HB_PLAN` ported verbatim — all 23 rows identical (`health.ts:39-69` vs `Health.js:36-66`), incl. `HB_SYSTEMS`(+`fcr`), `HB_BUILT`, `HB_NO_JOBS`, `HB_IDLE_NOTE`. `dqStep_`/`hbBeat` names match job keys exactly.

| HB_PLAN job | Implementation | Route / schedule | Beat emitted | Status |
|---|---|---|---|---|
| `roster_sync` (hub) | `dqSyncRoster_` `roster.ts:256`; `jobRosterSync` `roster.ts:373` | none — needs G1 HCT mirror → WP-F15 | `hbBeat('roster_sync',…)` `:376,:383` + `dqLogRun_` `:333` | PORTED-lib **GATED** (fixed this audit — beat did not exist) |
| `year_rollover` (hub) | inside `jobNightlyAggregates` | `/api/cron/job-nightly-aggregates` | `dqStep_('year_rollover')` `jobs.ts:382` | PORTED |
| `freshdesk_sync` (queue) | `fdSyncIncremental_` `freshdesk.ts:298` | `/api/cron/job-data-tick`, `POST /api/queue/refresh` | `dqStep_('freshdesk_sync')` `jobs.ts:343,364` | PORTED (honest-skip without key) |
| `daily_report` (queue) | inline in `buildQueueAggregates_`/`buildInflowAggregates_` | via `job-data-tick` | `hbBeat('daily_report',…)` `jobs.ts:107-111,145,154` | PORTED (Freshchat half GATED B3 — reads mirror) |
| `inflow` (queue) | `buildInflowAggregates_` | `job-data-tick` (55-min cadence) + nightly | `dqStep_('inflow')` `jobs.ts:353,381` | PORTED |
| `queue_aggregates` (queue) | `buildQueueAggregates_` | `job-data-tick` + refresh | `dqStep_('queue_aggregates')` `:350,368` | PORTED |
| `queue_snapshot` (queue) | `dqCheckinTick_` `jobs.ts:291` | via `job-data-tick` (4 slots/day, Kuwait) | `hbBeat('queue_snapshot',…)` `:311,:327` verbatim | PORTED |
| `checkin_tick` (queue) | `dqCheckinTick_` + `dqRemindMissedCheckins_` | `job-data-tick` + refresh | `dqStep_('checkin_tick')` `:355,370` | PORTED |
| `prod_snapshot`/`prod_flags`/`productivity` (productivity) | `cx-productivity/jobs/*` | `/api/cron/job-productivity-daily`, `/flag-detection`, `/daily-layers` | `dqStep_(env,'prod_snapshot'/'prod_flags'/'productivity')` | PORTED (WP-16) |
| `agent_aggregates` (people) | `buildAgentAggregates_` | `/api/cron/job-nightly-aggregates` | `dqStep_('agent_aggregates')` `jobs.ts:380` | PORTED |
| `scorecard` (people) | `scNightly_` cx-people | `/api/cron/scorecard-nightly` | `dqStep_(env,'scorecard')` | PORTED (WP-13) |
| `missed_1on1_check`/`oo_reminders`/`task_reminders`/`meeting_reminders` (people) | cx-people reminder fns | 4 `/api/cron/*-reminders` routes | `dqStep_(env,<key>)` verbatim names | PORTED (WP-13) |
| `fc_messages` (queue) | **none** — transcript ingest unported | none → WP-F16 | none | **GATED B3** |
| `tl_queue_metrics` (people) | `jobTlQueueMetrics` `tlqueue.ts` | `/api/cron/job-tl-queue` | run-row + `dqMarkRun_('tl_queue_metrics')` `:157,:170` | PORTED (WP-12; partial internals → WP-F2) |
| `mail_desk` (desk) | `jobMailDesk` `maildesk.ts:477` | `/api/desk/job/mail` | `hbBeatWarn_('mail_desk')` + `dqMarkRun_` `:493-494` | PORTED (WP-15; Gmail seam G5) |
| `qa_queue_import`/`qa_history_import`/`qa_ctl_reminders` (quality) | cx-quality `server.ts` | `/api/cron/job-qa-engine` | `hbBeat('<key>',…)` verbatim | PORTED (WP-11) |

## 5. Residual gaps

| # | Gap | Class | Disposition |
|---|---|---|---|
| 1 | `jobRosterSync` wrapper missing — `roster_sync` could never heartbeat | defect | **Fixed inline** (`roster.ts:373`, verbatim `dqStep_` semantics) |
| 2 | `markFollowUpDone`/`setAssistantSettings`/`installAssistantDigestTrigger` lacked `assertWritable()` — View-as could write where legacy refused | defect | **Fixed inline** (`myday.ts:568,758,780`) |
| 3 | Overview route title `Hub home` ≠ registry `Home` (Vf load-state title) | defect | **Fixed inline** (`app/overview/page.tsx`) |
| 4 | `ecosystem-page.tsx` one `eco3-*` class-name divergence | defect | **Fixed inline** (earlier this audit) |
| 5 | No cron routes for gated jobs: `jobRosterSync` (daily ~07:00 KW), `jobAssistantMorningDigest` (daily ~07:30 KW behind `assistant_digest_installed`), `jobWarmMyDay` (~30 min, 06:00–22:00 KW) | GATED G1/G3 | **WP-F15** — lib fns all ported; scheduling waits on the HCT mirror + Google adapter |
| 6 | `jobFreshchatMessages`/`backfillFreshchat`/`jobFreshchatBackfill` — Chat-Transcript report ingest (~200 L) unported | GATED B3 | **WP-F16** — needs `FRESHCHAT_API_KEY` + `fc_messages` sink decision (Postgres store vs vendor mirror) |
| 7 | `backfillEscalationSightings` — live path ported (`fdRecordSightings_`), the archive-sheet backfill loop is not | GATED (archive) | **WP-F17** — needs the legacy Google archive migrated/adapted |
| 8 | `diagnoseAging`, `applyExcludedGroups` — admin console diagnostics over `dqLogAgingDiagnosis_` (unported; sheet-bound) | DIAG | Documented-skip; revive only if a PM wants an admin diagnostic route |
| 9 | `doGet`, `doPost`, `connectToHub`, `runRosterSync`, all `*Trigger`/`setupV2`/`setupDataSpreadsheet` fns | N/A / PORTED-AS | By design — see matrix notes |
| 10 | `jobWarmMyDay`/`jobAssistantMorningDigest`/`runFreshdeskFullSync`/`jobRosterSync` ported in lib but unrouted | GATED | Covered by WP-F15 / noted in matrix |

## 6. Report

Fixed inline (≤30-line diffs, all inside scope — one exception noted):

- `src/features/cx-hub/lib/myday.ts` — `assertWritable()` added to `markFollowUpDone`, `setAssistantSettings`, `installAssistantDigestTrigger` (legacy refused these writes under View-as via the wrapped sheet).
- `src/features/cx-hub/lib/roster.ts` — `jobRosterSync` added verbatim (`requireJobCaller` → `dqStep_('roster_sync')` semantics → `hbFlush`); imports `requireJobCaller`/`hbBeat`/`hbFlush`.
- `src/features/cx-hub/components/ecosystem-page.tsx` — `Lr` corrected to `#/<path>` (legacy `location.hash` target).
- `src/app/overview/page.tsx` — route title `Hub home`→`Home` (1 line; outside `cx-hub/` but it is this module's own route shell — flagged for the record).

Not committed. Gates (post-fix, HEAD `2ca871a` + concurrent wave-1 edits): `npx tsc --noEmit` — 0 errors; `npx vitest run` — 41 files / 817 tests green incl. `hub-overview`, `hub-admin`, `hub-my-day`, `hub-people-holidays` golden suites; `npx eslint` on touched files — 0 errors (204 pre-existing `no-unused-expressions` warnings on the verbatim ecosystem port).

**Known residuals handed off:** WP-F15 (gated cron routes), WP-F16 (freshchat ingest), WP-F17 (escalation-sightings backfill). Blocked on: G1 (HCT mirror), G3 (Gmail/Calendar adapter), B3 (`FRESHCHAT_API_KEY`), archive access — none fixable in-repo.
