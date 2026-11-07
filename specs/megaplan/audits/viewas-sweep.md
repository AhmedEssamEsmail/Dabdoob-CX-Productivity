# WP-42 — View-as write-refusal sweep

Date: 2026-10-12. Scope: every mutating handler (`POST`/`PUT`/`DELETE`/`PATCH`, plus GET handlers that run jobs) under `src/app/api/**` — 111 route files enumerated. For each mutating path the guard column gives the exact `assertWritable` / `viewAsGuard` / `requireJobCaller` (transitive `assertWritable` for sessioned callers) location in `src/features/...`, or `GAP` → fixed inline.

The primitives (`src/features/shared/platform/viewas.ts`):

- `assertWritable()` :87-89 — throws `VIEW_AS_READONLY` ('View as is read-only — exit to make changes.') while the owner views as someone; `apiError` maps it to **403** (`api-error.ts:27`).
- `viewAsGuard` :91 — alias used at route level.
- `requireJobCaller()` (`platform/identity.ts:139-147`) — sessionless cron passes; a sessioned caller must be admin AND `assertWritable`.
- View-as ownership = `realEmail() === assistantOwnerEmail()`. A non-owner can never hold a target (viewas.ts:63-75) — **an agent cannot "view as admin"**: `startViewAs` refuses non-owners (:94-99) and a forged `view_as` row owned by a non-owner is inert.
- `viewAsLog` (:102-107) is the documented single exemption — the view-as mechanism itself must keep writing start/stop rows while on.
- Sessionless calls (real cron) can never attach a target — `viewAsState` returns early for `real === ''`.

## Result

- **82 routes expose ≥1 mutating or job handler** (66 non-cron POST/PUT/DELETE/PATCH routes + 16 GET/POST cron routes; the `/api/qa/[action]` dispatcher alone fans out to 26 write actions).
- **4 real GAPs found and fixed inline** (see §Fixes).
- Everything else already carried a guard (WP-10/WP-18 work verified, not just trusted — each is listed with its file:line).
- 8 POST routes are non-mutating by design (session-only / read-only / no-op placeholders) — listed in §N/A.

## Fixes (previously ungated write paths)

| # | Route | Hole | Fix |
|---|-------|------|-----|
| 1 | `GET+POST /api/cron/job-qa-engine` | Only `qaCtlReminders` (:2122) was gated; `qaQueueStep_` (:2106) + `qaHistoryStep_` (:2266) carried **no** `requireJobCaller`/`assertWritable` — a sessioned viewing-as admin (or any signed-in non-admin in no-secret dev mode) ran the import/history writes | `src/app/api/cron/job-qa-engine/route.ts` — `await requireJobCaller()` after `cronOk`, same as the sibling cron routes |
| 2 | `GET+POST /api/cron/job-tl-queue?dates=…` | `jobTlQueueMetrics` has `requireJobCaller` (tlqueue.ts:254) but the `?dates=` rebuild (`rebuildTlQueueMetricsEntry`) bypassed it entirely | `src/app/api/cron/job-tl-queue/route.ts` — `await requireJobCaller()` after `cronOk`, covering both branches |
| 3 | `POST /api/integrations/freshchat` + `/api/integrations/maqsam` | Bearer-secret only — no sessioned-caller gate at all. An admin presenting the secret from a viewing-as browser session wrote mirrors | `await requireJobCaller()` added after the bearer check in both routes (sessionless stays free, sessioned must be admin + writable) |
| 4 | `POST /api/admin/migrate` | `x-migration-key` auth only — the keyed-but-sessioned view-as case wrote | `await assertWritable()` added after `checkAdminAuth` (same convention `/admin/backfill` + `/admin/mirrors` keep) |

## Route × guard matrix

Legend: **route** = guard in `src/app/api/.../route.ts`; **lib** = guard in the called data-layer fn (the project's convention — roles/guards live in the feature libs, routes stay thin); **job** = `requireJobCaller` (bearer/no-secret at the route + admin-or-sessionless + assertWritable inside); **key** = key-auth path (`requireAdminCaller` = x-migration-key OR admin session).

### Platform & hub

| Route | Mutating handler / action | Guard |
|---|---|---|
| `/api/config` | POST, PUT | **route** `viewAsGuard` (route.ts:23, :46) after `requireRole(['admin'])` |
| `/api/roster` | POST, PUT | **route** `viewAsGuard` (:26, :53) |
| `/api/options/[listKey]` | POST | **lib** `addOption` → `assertWritable` platform/options.ts:80 |
| `/api/view-as` | POST start/switch, DELETE stop | **mechanism** — `viewAsLog` is the documented exemption (viewas.ts:102-107); `viewAsRequireOwner` :94 |
| `/api/holidays` | POST `holidayUpsert`, DELETE `holidayDelete` | **lib** platform/holidays.ts:43, :80 |
| `/api/health` | POST `setupHealth` | **route** requireRole(['admin']) + `assertWritable` (route.ts:20-21) |
| `/api/alerts/one-on-one` | POST `oneOnOneAlertsSeen` | **n/a — cache-only write** (notify.ts:261-272; `CacheService` seam — legacy left seen-stamps unguarded, parity kept) |
| `/api/hub/my-day` | POST `focusBlock`/`setSettings`/`followUpDone`/`installDigest` | **route** `assertWritable` (route.ts:35) **+ lib** myday.ts:737, :757, :568, :779. `searchMail`/`debug` branches are reads — exempt by design |
| `/api/hub/admin` | POST `setConfig`/`saveConfig`/`setAppUrl` | **lib** admin.ts:33, :47, :70 |
| `/api/hub/roster` | POST `syncNow`/`setOverrides`/`setV2`/`addHoliday`/`removeHoliday` | **lib** roster.ts:362, :408, :527, :573, :602 |
| `/api/mail-desk` | POST `refresh`/`decide`/`reset` | **route** `assertWritable` (route.ts:21) **+ lib** maildesk.ts:669 (decide), :776 (reset); refresh also re-gated inside the mail-sync job path |
| `/api/desk/setup` | POST `setupDesk`, `?triggers=1` `installDeskTriggers` | **lib** tlperformance.ts:603, :646 |

### Cron / jobs (GET or POST that mutate)

| Route | Job | Guard |
|---|---|---|
| `/api/cron/analytics-aggregation` | aggregates | **route** `requireJobCaller` :24 |
| `/api/cron/daily-layers` | layers | **route** :25 |
| `/api/cron/flag-detection` | prod flags | **route** :25 |
| `/api/cron/job-data-tick` | `jobDataTick` | **lib** jobs.ts:340 |
| `/api/cron/job-nightly-aggregates` | `jobNightlyAggregates` | **lib** jobs.ts:377 |
| `/api/cron/job-productivity-daily` | `jobProductivityDaily` | **route** :21 |
| `/api/cron/job-qa-engine` | `qaQueueStep_`/`qaHistoryStep_`/`qaCtlReminders` | **route** `requireJobCaller` — **WP-42 fix** (+ lib qaCtlReminders :2122) |
| `/api/cron/job-quarterly-report` | `jobQuarterlyReport` | **route** :22 |
| `/api/cron/job-tl-queue` | `jobTlQueueMetrics` + `?dates=` rebuild | **route** `requireJobCaller` — **WP-42 fix** (+ lib tlqueue.ts:254) |
| `/api/cron/job-tph-hourly` | `jobTphHourly` | **route** :21 |
| `/api/cron/job-tph-past-days` | `jobTphPastDays` | **route** :21 |
| `/api/cron/meeting-reminders` | meetings | **route** :16 |
| `/api/cron/missed-1on1-check` | missed 1:1 | **route** :16 |
| `/api/cron/oo-reminders` | 1:1 reminders | **route** :16 |
| `/api/cron/scorecard-nightly` | scorecard | **route** :24 |
| `/api/cron/task-reminders` | tasks | **route** :16 |
| `/api/desk/job/mail` | `jobMailDesk` | **lib** maildesk.ts:486 `requireJobCaller` (golden-tested since WP-18) |
| `/api/integrations/freshchat` | `syncAllMirrors` | **route** `requireJobCaller` — **WP-42 fix** |
| `/api/integrations/maqsam` | `syncAllMirrors` | **route** `requireJobCaller` — **WP-42 fix** |
| `/api/admin/migrate` | keyed migration engine | **route** `assertWritable` — **WP-42 fix** (key-only script calls unaffected: no session ⇒ not blocking) |
| `/api/admin/mirrors` | POST `syncAllMirrors` | **key** `requireAdminCaller` :22 + **route** `assertWritable` :50. `{peek:{…}}` branch is a read-only diagnostic — exempt by design |
| `/api/admin/backfill` | POST chunked recompute | **key** `requireAdminCaller` :20 + **route** `assertWritable` :29 |

### Quality (dispatcher + REST)

| Route | Mutating handlers | Guard |
|---|---|---|
| `/api/qa/[action]` POST + GET | 22 interactive write actions: `setQaAuditorGrant`, `startQaAudit`, `submitQaAudit`, `resendQaAuditEmail`, `passQaQueueItem`, `requestQaAudit`, `createQaOffQueueAudit`, `waiveQaAuditRequest`, `createQaNonTicketAudit`, `confirmQaCtl`, `submitQaCtl`, `decideQaDispute`, `createQaCalibration`, `submitQaCalibrationAudit`, `addQaKbGap`, `markQaKbGapAdded`, `saveQaForm`, `saveQaSampling`, `importQaQueueNow`, `backfillQaSampleBasis`, `backfillQaInteractionDates`, `restartQualityAuditHistory` | **lib** `assertWritable` server.ts:498, :678, :701, :788, :811, :896, :913, :932, :952, :1017, :1134, :1309, :1472, :1512, :1582, :1621, :1876, :1968, :2090, :2199, :2217, :2285 |
| `/api/qa/[action]` (job actions) | `qaCtlReminders`, `qaEnsureCtlPopups`, `qaImportHistory`, `qaReconcileQueueLog` | **lib** `requireJobCaller` :2122, :2188, :2241, :2253 (the old WP-F10 exposure is closed) |
| `/api/quality/audits` | POST | **route** `viewAsGuard` :127 |

### Queue

| Route | Mutating handlers | Guard |
|---|---|---|
| `/api/queue/aging-flags` | POST flag → `agingFlagTicket`, resolve → `agingResolveFlag` | **lib** pages.ts:289, :327 |
| `/api/queue/checkins` | POST `submitQueueCheckin` | **lib** server.ts:280 |
| `/api/queue/checkins-page` | POST `submitCheckin` | **lib** pages.ts:199 |
| `/api/queue/refresh` | POST `refreshQueueNow` | **lib** pages.ts:248 (rate-limit cache write precedes the job — under view-as the guard fires first) |
| `/api/queue/heatmap` | POST ops `save`/`build`/`regression`/`assumptions`/`countries` | **lib** heatmap.ts:541, :564, :586, :613, :627. `op:'parse'` (`parseHeatmapUpload`) only parses — no write, exempt |
| `/api/queue/scheduler` | POST ops `save`/`saveSettings`/`saveTeamDates`/`saveOffDays`/`setOverride`/`setHourOverride`/`submitRequest`/`respondToSwap`/`decide`/`import` | **lib** scheduler.ts:1292, :1340, :1353, :1409, :1452, :1468, :1538, :1595, :1619, :1670. `plan`/`settings`/`requests`/`offdays` are reads; `setupTables` only probes table existence — exempt |

### Operations — trackers

| Route | Mutating handlers | Guard |
|---|---|---|
| `/api/trackers` | POST `createTracker` | **lib** trackers.ts:951 (validation first — parity) |
| `/api/trackers/records` | POST `addTrackerRecord` | **lib** `writeTrackerRow_` → trackers.ts:595 |
| `/api/trackers/fields` | POST `addTrackerField`, PATCH `updateTrackerField` | **lib** :635/:749 (add column + register) and :778/:823-867 (update) — guards fire at the first physical write, matching `vaWrap_` ordering |
| `/api/trackers/setup` | POST `setupTrackers` | **lib** per-item guards at each first write (:1005+ comment — no blanket guard by design) |

### People

| Route | Mutating handlers | Guard |
|---|---|---|
| `/api/people/actions` | POST `actionsCreate` | **lib** actions.ts:347 |
| `/api/people/actions/status` | POST `actionsSetStatus` | **lib** actions.ts:364 |
| `/api/people/actions/updates` | POST `actionsPostUpdate` | **lib** actions.ts:382 |
| `/api/people/coaching` | POST `coachingSignal` | **lib** coaching.ts:77 (after `pwCanSignal_`) |
| `/api/people/meetings` | POST `meetingsCreateSeries` | **lib** meetings.ts:147 |
| `/api/people/notes` | POST `notesSave`, DELETE `notesDelete` | **lib** notes.ts:58, :90 (owner check on `realEmail` precedes) |
| `/api/people/one-on-ones` | POST `oneOnOnesSubmit` | **lib** one-on-ones-page.ts:826 |
| `/api/people/one-on-ones/schedule` | POST `oneOnOnesSchedule` | **lib** one-on-ones.ts:462 |
| `/api/people/one-on-ones/delete` | POST `deleteLog`/`deleteBooking` | **lib** one-on-ones-delete.ts:185, :301 (`deletePreview` is a read) |
| `/api/people/one-on-ones/restore` | POST `oneOnOnesRestore` | **lib** one-on-ones-delete.ts:350 |
| `/api/people/scorecard` | POST `refreshScorecard` | **lib** scorecard-server.ts:526 |
| `/api/people/tasks` | POST `tasksCreate` | **lib** tasks.ts:258 |
| `/api/people/tasks/status` | POST `tasksSetStatus` | **lib** tasks.ts:416 |
| `/api/people/tasks/deadline` | POST `tasksSetDeadline` | **lib** tasks.ts:464 |
| `/api/people/tasks/details` | POST `tasksEditDetails` | **lib** tasks.ts:508 |
| `/api/people/tasks/milestone` | POST `tasksPostMilestone` | **lib** tasks.ts:368 |
| `/api/people/tasks/preview` | POST `tasksPreview` | **n/a — read-only compute** (tasks.ts:237-247, no writes) |

### KPI (desk + payout logs)

| Route | Mutating handlers | Guard |
|---|---|---|
| `/api/kpi/logs` | POST `kpiLogSave`, DELETE `kpiLogRemove` | **lib** kpilogs.ts:108, :167 |
| `/api/kpi/behaviour` | POST `kpiLogAppend`, DELETE `kpiLogRemove` | **lib** kpi/server.ts:273, :290 |
| `/api/kpi/leave` | POST `kpiLogAppend`, DELETE `kpiLogRemove` | **lib** kpi/server.ts:273, :290 |
| `/api/kpi/ol-cases` | POST `olCaseUpsert`, DELETE `olCaseDelete` | **lib** kpi/server.ts:348, :372 |

### TPH + prod + TL

| Route | Mutating handlers | Guard |
|---|---|---|
| `/api/tph/cases` | POST `saveTphCases` | **route** `viewAsGuard` (route.ts) |
| `/api/tph/days` | POST `saveTphDays` | **route** `viewAsGuard` :36 |
| `/api/tph/tasks` | POST `saveTphTask` | **route** `viewAsGuard` |
| `/api/tph/slots` | POST `saveTphSlots` | **route** `viewAsGuard` |
| `/api/tph/run-day` | POST | **route** `viewAsGuard` |
| `/api/tph/run-step` | POST | **route** `viewAsGuard` |
| `/api/prod/flags/[flagId]/decide` | POST flag decision | **route** requireRole + `viewAsGuard` (route.ts:38-39) |
| `/api/fcr/daily` | POST `fcrDailyInput` upsert | **route** requireRole + `assertWritable` (route.ts:43-44) |
| `/api/tl/kb` | POST `kbTrackerSave` | **lib** tlperformance.ts:543 (after KB-editor check :541) |
| `/api/tl/otd` | POST `otdSave` | **lib** tlperformance.ts:578 |
| `/api/tl/rate` | POST `tlpRateArea` / `tlpRateProject` | **lib** tlperformance.ts:446, :474 (after the manager checks — parity) |

## N/A — POSTs that don't mutate

| Route | Why exempt |
|---|---|
| `/api/auth/login` | Session creation only (Supabase signIn); no app-data write |
| `/api/admin/list-sheets` | Read-only workbook-tab diagnostic (keyed) |
| `/api/integrations/freshdesk` | Placeholder — returns `{ok:true, note:'not wired'}`; zero writes |
| `/api/integrations/gmail` | Placeholder — same |
| `/api/people/tasks/preview` | Pure "does it fit" compute |
| `/api/queue/scheduler` ops `plan`/`settings`/`requests`/`offdays`/`setupTables` | Reads / existence probes dispatched over POST |
| `/api/queue/heatmap` op `parse` | Parse-only |
| `/api/admin/mirrors` `peek` branch | Read-only diagnostic |
| `/api/hub/my-day` `searchMail`/`debug` | Read branches |
| `/api/qa/[action]` read actions + `checkQaEngineSettings` | Reads / settings diagnostic |

## Test evidence — `tests/golden/viewas-sweep.test.ts` (65 tests, all green)

- **Mechanism invariants**: sessionless ⇒ no view-as can attach; non-owner `startViewAs` refuses; forged `view_as` row owned by a non-owner is inert (agent "viewing as admin" is impossible — the state can't exist, and the agent's writes stay role-denied anyway); start/stop rows are the only allowed writes while on.
- **admin-viewing-as-agent** (owner → agent target): every lib write the agent role could reach refuses `VIEW_AS_READONLY` (`actionsSetStatus`, `agingFlagTicket`, `mailApprovalDecide` after approver+pending checks, `addOption`, notes owner-path via `realEmail`); admin-only writes refuse with the role denial first — still refused.
- **admin-viewing-as-tl**: 16 representative fns across people/queue/desk/kpi/notes/jobs refuse.
- **admin-viewing-as-admin** (owner → second admin `boss@`): role gates all pass and only view-as stops the write — `setAdminConfig`, `saveConfigSetting`, `setAppUrl`, `syncRosterNow`, `setPersonOverrides`, `schedulerSave`, `runPriorHeatmapRegression`, `setupDesk`, `installDeskTriggers`, `setQaAuditorGrant`, `importQaQueueNow`, `backfillQaSampleBasis`, `createTracker`, `requireJobCaller`, `kbTrackerSave` — all refuse.
- **Route-level**: 19 wired handler calls (`/api/config`, `/api/roster` POST+PUT, `/api/quality/audits`, `/api/tph/days`, `/api/mail-desk`, `/api/hub/my-day`, `/api/options/[listKey]`, `/api/qa/setQaAuditorGrant` dispatcher, `/api/queue/refresh`, `/api/hub/admin`, `/api/desk/setup` + `?triggers=1`, `/api/kpi/leave` POST+DELETE, `/api/holidays` POST+DELETE, `/api/admin/backfill`, `/api/admin/mirrors`) → all 403 `VIEW_AS_READONLY`.
- **WP-42 fixes**: `job-tl-queue` both branches, `job-qa-engine`, `integrations/freshchat`, `integrations/maqsam`, `admin/migrate` (with migration key) → all 403 under a viewing-as session.
- Existing golden parity suites (`operations.test.ts` "View as write refusals", `desk.test.ts` jobMailDesk) remain green.

## Gates

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — **1126 passed** (1061 baseline + 65 new)
- `npx eslint` on all touched files — clean

## Residual / follow-ups

- None blocking. `requireJobCaller`'s sessioned non-admin denial maps to 500 today (it is neither `Unauthorized`-shaped nor `do not have access`) — cosmetic status nuance only; the write is still refused.
