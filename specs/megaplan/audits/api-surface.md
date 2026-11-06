# WP-18 — API-surface cross-check

**Scope.** All `src/app/api/**/route.ts` (authoritative enumeration via `find` — **111 route files**), every page component `ce`/`api`/`P` fetch object in `src/features/*/components/*-page.tsx` + `src/app/**/page.tsx` + the shared shell (`src/features/shared/shell/context.ts`), and every `oi("fn")`-style server call in `.devin/work/extract/*/pages/*.closure.js` (37 closures; the seam name is minified per bundle — `D`, `N`, `se`, `ve`, `ae`, `fe`, `J`, `yn`, `zo`, `we`, `oi`, `L`, `Ni` — extracted via `seam("literal")` call sites).

**Method.** For each route: HTTP methods → auth gate actually executed (route-level vs. enforced inside the called module fn — both recorded because most routes are thin by design and the gate lives in the lib, matching legacy `Auth.js`/`Repo.js` where guards sat inside the function, not the caller) → mutating? → `assertWritable`/`viewAsGuard` present on the write path (route or lib) → error envelope. Lib gates were verified per-function (grep + targeted reads of every exported handler).

**Conventions.** `requireRole`/`requireAuth`/`requireJobCaller`/`currentEmail`/`realEmail`/`actorEmail` → `src/features/shared/platform/identity.ts` (re-exported via `shared/lib/auth.ts`). `assertWritable` ≡ `viewAsGuard` → `shared/platform/viewas.ts` (refuses while the owner has View-as on; passes with no session). `requireAdminCaller` → `shared/lib/admin-auth.ts` (admin session **or** `x-migration-key`). `cronOk`/`checkAdminAuth`/`CRON_SECRET` bearer checks are route-local. `qaRequireRole_` is the Quality module's `requireRole` wrapper. `apiError` → `{error[,code,detail,hint]}` with mapped status; `dbErr` → same described envelope; hand-rolled `NextResponse.json({error})` → `{error}`.

**Proxy fact.** `src/proxy.ts` excludes `/api` from page protection — an API route with no route **or** lib gate is genuinely public. Public-by-design only: `/api/auth/login`, `/api/auth/logout`.

---

## 1. Route matrix (111)

Gate column legend: **[route]** = executed in `route.ts`; **[lib]** = inside the called module fn (verified); **—** = none.

| Route | Methods | Auth gate | Module fn(s) called | Mutating | `assertWritable` on writes | Error envelope |
|---|---|---|---|---|---|---|
| **admin / platform ops** |||||||
| /admin/backfill | POST | requireAdminCaller [route] | `runBackfill` | yes | ✔ [route] (added WP-18) | apiError |
| /admin/list-sheets | POST | `x-migration-key` fail-closed [route] | sheets list (inline) | no (diagnostic) | n/a | {error} |
| /admin/migrate | POST | `x-migration-key` fail-closed [route] | `migrateTable` (inline) | yes | n/a — key-only callers, no session | {error} |
| /admin/mirrors | GET,POST | requireAdminCaller [route] | `syncAllMirrors`, mirror state | yes (POST sync branch) | ✔ [route] (added WP-18; `peek` branch exempt — read-only) | apiError |
| /admin/source-health | GET | requireAdminCaller [route] | health probes (inline) | no | n/a | apiError |
| /alerts/one-on-one | GET,POST | currentEmail [route] | `oneOnOneAlerts`, `oneOnOneAlertsSeen` | yes (dismiss) | ✔ [lib] | {error} |
| /auth/login | POST | none — **public by design** | supabase `signInWithPassword` | session only | n/a | {error} |
| /auth/logout | GET | none — public by design (own session) | supabase `signOut` + redirect | session only | n/a | redirect |
| /bootstrap | GET | currentUser/currentEmail [route] | `viewAsState`, `pendingPopupsFor`, `allOptions`, `appUrls` | no | n/a | {error} |
| /calendar | GET | requireRole [route] | calendar read | no | n/a | {error} |
| /config | GET,POST,PUT | requireRole [route] | config get/set (supabase) | yes | ✔ viewAsGuard [route] | apiError+dbErr |
| /holidays | GET,POST,DELETE | requireRole [route] | `shared/platform/holidays` | yes | ✔ [lib] | apiError |
| /mail-log | GET | requireRole [route] | `shared/platform` mail log | no | n/a | {error} |
| /options | GET | currentEmail [route] | `optionsFor` list | no | n/a | {error} |
| /options/[listKey] | GET | currentEmail [route] | `optionsFor` | no | n/a | {error} |
| /options/[listKey] | POST | **none** — `actorEmail` falls back to `system:trigger` with no session | `addOption` | yes | ✔ in lib but useless w/o auth → **WP-F8** | {error} |
| /popups | GET | currentEmail [route] | `pendingPopupsFor` | no | n/a | {error} |
| /roster | GET,POST,PUT | requireRole [route] | roster read/write (supabase) | yes | ✔ viewAsGuard [route] | apiError+dbErr |
| /view-as | GET,POST,DELETE | `viewAsRequireOwner` [lib] | `getViewAsState`, `startViewAs`, `stopViewAs` | yes (start/stop = the mechanism itself) | by design (writes its own log) | {error} |
| /view-as/people | GET | `viewAsRequireOwner` [lib] | `getViewAsPeople` | no | n/a | {error} |
| **cron (all Bearer `CRON_SECRET`; sessionless `requireJobCaller` where noted)** |||||||
| /cron/analytics-aggregation | GET | CRON_SECRET + requireJobCaller | `jobProductivity` step | yes (job) | n/a trigger | {error} |
| /cron/daily-layers | GET | CRON_SECRET + requireJobCaller | `jobProductivity` step | yes | n/a | {error} |
| /cron/flag-detection | GET | CRON_SECRET + requireJobCaller | `jobProductivity` step | yes | n/a | {error} |
| /cron/job-data-tick | GET | cronOk + requireJobCaller | `jobDataTick` | yes | n/a | apiError |
| /cron/job-nightly-aggregates | GET | cronOk | `jobNightlyAggregates` | yes | n/a | apiError |
| /cron/job-productivity-daily | GET | CRON_SECRET + requireJobCaller | `jobProductivityDaily` | yes | n/a | {error} |
| /cron/job-qa-engine | GET | cronOk | `cx-quality/lib/server` engine fns | yes | n/a | apiError |
| /cron/job-quarterly-report | GET | CRON_SECRET + requireJobCaller | `jobQuarterlyReport` | yes | n/a | {error} |
| /cron/job-tl-queue | GET | cronOk + requireJobCaller | `jobTlQueueMetrics` | yes | n/a | apiError |
| /cron/job-tph-hourly | GET | CRON_SECRET + requireJobCaller | tph hourly job | yes | n/a | {error} |
| /cron/job-tph-past-days | GET | CRON_SECRET + requireJobCaller | tph past-days job | yes | n/a | {error} |
| /cron/meeting-reminders | GET | CRON_SECRET + requireJobCaller | `cx-people/lib/reminders` | yes | n/a | {error} |
| /cron/missed-1on1-check | GET | CRON_SECRET + requireJobCaller | `cx-people/lib/reminders` | yes | n/a | {error} |
| /cron/oo-reminders | GET | CRON_SECRET + requireJobCaller | `one-on-one-reminders` | yes | n/a | {error} |
| /cron/scorecard-nightly | GET | CRON_SECRET + requireJobCaller | scorecard nightly | yes | n/a | {error} |
| /cron/task-reminders | GET | CRON_SECRET + requireJobCaller | `cx-people/lib/reminders` | yes | n/a | {error} |
| **desk** |||||||
| /desk/job/mail | POST | requireJobCaller [route] | `jobMailDesk` | yes | n/a trigger | apiError |
| /desk/setup | POST | requireRole admin + assertWritable [lib] | `setupDesk`, `installDeskTriggers` | yes | ✔ [lib] | apiError |
| /kpi/logs | GET,POST,DELETE | requireRole [lib] | `kpiLogsPage`, `kpiLogSave`, `kpiLogRemove` | yes | ✔ [lib] | apiError |
| /mail-desk | GET,POST | requireRole [lib] | `mailDeskPage`, `mailDeskRefresh`, `mailApprovalDecide`, `mailApprovalReset` | yes | ✔ [route] (added WP-18; decide/reset also [lib]) | apiError |
| /tl/kb | GET,POST | requireRole [lib] | `kbTrackerPage`, `kbTrackerSave` | yes | ✔ [lib] | apiError |
| /tl/otd | POST | requireRole [lib] | `otdSave` | yes | ✔ [lib] | apiError |
| /tl/page | GET | requireRole [lib] | `tlPerformancePage` | no | n/a | apiError |
| /tl/rate | POST | requireRole [lib] | `tlpRateArea`, `tlpRateProject` | yes | ✔ [lib] | apiError |
| **hub** |||||||
| /hub/admin | GET,POST | requireRole admin + assertWritable [lib] | `cx-hub/lib/admin` (config rows, setConfig, setAppUrl…) | yes | ✔ [lib] | apiError |
| /hub/ecosystem | GET | requireRole [route] | `getEcosystemHealth` | no | n/a | apiError |
| /hub/home | GET | requireRole [lib] | `getHomePage` | no | n/a | apiError |
| /hub/my-day | GET,POST | `requireAssistantOwner_`/`realEmail` [lib] | `getMyDay`, `getMyDayPart`, `searchMyMail`, `createFocusBlock`, `setAssistantSettings`, `markFollowUpDone`, `installAssistantDigestTrigger`, `debugMyDay` | yes | ✔ [route] for all write actions (added WP-18); `focusBlock` also [lib] | apiError |
| /hub/roster | GET,POST | requireRole + assertWritable [lib] | `cx-hub/lib/roster` (getRosterAdmin, setPerson, holidays, overrides, syncRoster) | yes | ✔ [lib] | apiError |
| **integrations** |||||||
| /integrations/freshchat | POST | CRON_SECRET bearer [route] | `syncAllMirrors` (freshchat) | yes (job) | n/a trigger | apiError |
| /integrations/freshdesk | POST | CRON_SECRET bearer [route] | placeholder (not wired) | no | n/a | {error} |
| /integrations/gmail | POST | CRON_SECRET bearer [route] | placeholder (not wired) | no | n/a | {error} |
| /integrations/maqsam | POST | CRON_SECRET bearer [route] | `syncAllMirrors` (maqsam) | yes (job) | n/a trigger | apiError |
| **kpi (people module)** |||||||
| /kpi/behaviour | GET,POST,DELETE | requireRole [route] | `cx-people/lib/kpi/server` | yes | ✔ [lib] | apiError |
| /kpi/leave | GET,POST,DELETE | requireRole [route] | `cx-people/lib/kpi/server` | yes | ✔ [lib] | apiError |
| /kpi/ol-cases | GET,POST,DELETE | requireRole [route] | `cx-people/lib/kpi/server` | yes | ✔ [lib] | apiError |
| /kpi/payout | GET | requireRole [route] | `kpiPayout_` | no | n/a | apiError |
| **people** |||||||
| /people/actions | GET,POST | requireRole [route]+[lib] | `actionsMine`, create/update | yes | ✔ [lib] | apiError |
| /people/actions/status | POST | requireRole + assertWritable [lib] | `actionsSetStatus` | yes | ✔ [lib] | apiError |
| /people/actions/updates | POST | requireRole + assertWritable [lib] | `actionsPostUpdate` | yes | ✔ [lib] | apiError |
| /people/agents | GET | requireRole [lib] | agents page | no | n/a | apiError |
| /people/coaching | GET,POST | requireRole + assertWritable [lib] | `coachingPage`, `coachingSignal` | yes | ✔ [lib] | apiError |
| /people/meetings | GET,POST | requireRole + assertWritable [lib] | meetings ops (create/open/save/review/add_actions/log_actions/close/send_summary) | yes | ✔ [lib] | apiError |
| /people/notes | GET,POST,DELETE | `realEmail` (session) [lib] | `notesPage`, `notesSave`, `notesDelete` | yes | ✔ [lib] | apiError |
| /people/one-on-ones | GET,POST | requireRole + assertWritable [lib] | `oneOnOnesPage`, `oneOnOnesSubmit` | yes | ✔ [lib] | apiError |
| /people/one-on-ones/delete | POST | requireRole + assertWritable [lib] | delete preview/log/booking | yes | ✔ [lib] | apiError |
| /people/one-on-ones/log | GET | requireRole [lib] | `oneOnOnesGetLog` | no | n/a | apiError |
| /people/one-on-ones/productivity | GET | requireRole [lib] | `oneOnOnesProductivity` | no | n/a | apiError |
| /people/one-on-ones/restore | POST | requireRole + assertWritable [lib] | `oneOnOnesRestore` | yes | ✔ [lib] | apiError |
| /people/one-on-ones/schedule | POST | requireRole + assertWritable [lib] | book/reschedule/not_held | yes | ✔ [lib] | apiError |
| /people/one-on-ones/start | GET | requireRole [lib] | `oneOnOnesStart` | no | n/a | apiError |
| /people/scorecard | GET,POST | requireRole + assertWritable [lib] | scorecard page/detail/admin/refresh/source ops | yes | ✔ [lib] | apiError |
| /people/tasks | GET,POST | requireRole + assertWritable [lib] | `tasksPage`, `tasksCreate` | yes | ✔ [lib] | apiError |
| /people/tasks/deadline | POST | requireRole + assertWritable [lib] | `tasksSetDeadline` | yes | ✔ [lib] | apiError |
| /people/tasks/details | POST | requireRole + assertWritable [lib] | `tasksEditDetails` | yes | ✔ [lib] | apiError |
| /people/tasks/milestone | POST | requireRole + assertWritable [lib] | `tasksPostMilestone` | yes | ✔ [lib] | apiError |
| /people/tasks/preview | POST | requireRole [lib] (read-only preview) | `tasksPreview` | no (computes only) | n/a | apiError |
| /people/tasks/status | POST | requireRole + assertWritable [lib] | `tasksSetStatus` | yes | ✔ [lib] | apiError |
| **productivity** |||||||
| /fcr/daily | GET,POST | requireRole [route] | `cx-people/lib/scorecard/fcr` | yes | ✔ [route]+[lib] | apiError+dbErr |
| /prod/analytics | GET | requireRole [route] | `getProdAnalyticsPage` | no | n/a | {error} |
| /prod/daily-layers | GET | requireRole [route] | `prod_daily_layers` read | no | n/a | apiError+dbErr |
| /prod/flags | GET | requireRole [route] | `getProdReviewPage` | no | n/a | {error} |
| /prod/flags/[flagId] | GET | requireRole [route] | `getProdFlag` | no | n/a | {error}+dbErr |
| /prod/flags/[flagId]/decide | POST | requireRole [route] | `decideProdFlag` | yes | ✔ viewAsGuard [route] | apiError+dbErr |
| /prod/intervals | GET | requireRole [route] | `prod_intervals` read | no | n/a | apiError+dbErr |
| /prod/my-page | GET | requireRole [route] | `getProdMyPage` | no | n/a | {error} |
| /tph/cases | GET | **none** → **WP-F9** | `prod_tph_cases` read | no | n/a | dbErr (no try/catch) |
| /tph/cases | POST | requireRole admin/tl [route] | `saveTphCases` | yes | ✔ viewAsGuard [route] | apiError |
| /tph/days | GET,POST | requireRole [route] | tph days read/save | yes | ✔ viewAsGuard [route] | apiError+dbErr |
| /tph/page | GET | requireRole [route] | `getTphPage` | no | n/a | {error} |
| /tph/run-day | POST | requireRole [route] | `runTphDay` | yes | ✔ viewAsGuard [route] | apiError |
| /tph/run-step | POST | requireRole [route] | `runTphStep` | yes | ✔ viewAsGuard [route] | apiError |
| /tph/slots | POST | requireRole [route] | `saveTphSlots` | yes | ✔ viewAsGuard [route] | apiError |
| /tph/tasks | GET | **none** → **WP-F9** | `prod_tph_tasks` read | no | n/a | dbErr (no try/catch) |
| /tph/tasks | POST | requireRole admin/tl [route] | `saveTphTask` | yes | ✔ viewAsGuard [route] | apiError |
| /tph/touches | GET | requireRole [route] | `getTphTouchList` | no | n/a | apiError |
| /tph/trend | GET | requireRole [route] | `getTphTrend` | no | n/a | {error} |
| **quality** |||||||
| /qa/[action] | GET,POST | per-handler gates [lib] — dispatcher is a 39-name allowlist | all `P.*` page fns + admin/backfill/reconcile | yes (many) | ✔ [lib] per mutating handler; **2 ungated handlers → WP-F10** | apiError |
| /quality/audits | GET,POST | requireRole admin/tl [route] | `qa_audits` read/insert | yes | ✔ viewAsGuard [route] | apiError+dbErr |
| **queue** |||||||
| /queue/aging | GET | requireRole [lib] | `getAgingPage` | no | n/a | apiError |
| /queue/aging-flags | GET,POST | requireRole + assertWritable [lib] | `agingFlagTicket`, `agingResolveFlag` | yes | ✔ [lib] | apiError |
| /queue/analytics | GET | requireRole [lib] | `getAnalyticsPage` | no | n/a | apiError |
| /queue/checkins | GET,POST | requireRole [route] | `submitQueueCheckin`, TL check-in reads | yes | ✔ [lib] | apiError |
| /queue/checkins-page | GET,POST | requireRole + assertWritable [lib] | `getCheckinsPage`, `submitCheckin` | yes | ✔ [lib] | apiError |
| /queue/health | GET | requireRole [lib] | `getQueueHealthPage` | no | n/a | apiError |
| /queue/heatmap | GET,POST | requireRole + assertWritable [lib] | `getHeatmapPage`, `getHeatmapInput`, `saveHeatmapInput`, `parseHeatmapUpload`, `buildHeatmapFromSource`, `runPriorHeatmapRegression`, `saveHeatmapAssumptions`, `setHeatmapCountries` | yes | ✔ [lib] on all write ops | apiError |
| /queue/refresh | POST | requireRole admin/tl + assertWritable [lib] | `refreshQueueNow` | yes | ✔ [lib] | apiError |
| /queue/scheduler | GET,POST | requireRole + assertWritable [lib] | `schedulerPlan`, `schedulerSettings`, `schedulerRequests`, `schedulerOffDays`, `schedulerSave`, `schedulerSaveSettings`, `schedulerSaveTeamDates`, `schedulerSaveOffDays`, `schedulerSetOverride`, `schedulerSetHourOverride`, `schedulerSubmitRequest`, `schedulerRespondToSwap`, `schedulerDecide`, `schedulerImport`, `setupSchedulerTables` | yes | ✔ [lib] on all write ops | apiError |
| /tl/performance | GET | requireRole [route] | `getTlPerformance` (cx-queue server) | no | n/a | apiError |
| **trackers (operations)** |||||||
| /trackers | GET,POST | requireRole [lib] | `getTrackersPage`, `createTracker` | yes | ✔ [lib] | apiError |
| /trackers/fields | PATCH,POST | requireRole + assertWritable [lib] | `addTrackerField`, `updateTrackerField` | yes | ✔ [lib] | apiError |
| /trackers/records | GET,POST | requireRole + assertWritable [lib] | `getTrackerRecords`, `addTrackerRecord` | yes | ✔ [lib] | apiError |
| /trackers/setup | POST | requireRole admin + assertWritable [lib] | `setupTrackers` | yes | ✔ [lib] | apiError |

**Notes on gates.** "—" in the gate column never means unprotected where `[lib]` is shown: the port deliberately keeps routes thin (`PORTING-GUIDE.md` — auth gate → lib call → `NextResponse.json`) and the guard sits inside the called function exactly as legacy `Auth.js`/`viewAsGuard_` did. Every route without **any** gate is listed in §3.

---

## 2. Dead fetches (page → route)

Every fetch target in `src/features/*/components/*-page.tsx`, `src/app/**/page.tsx` and `src/features/shared/shell/context.ts` resolves to an existing route **except**:

| File | Target | Status |
|---|---|---|
| `src/app/my-status/page.tsx:35` | `POST /api/prod/disputes` (raiseProdDispute) | route absent — **intentional**: `prod_disputes` deprecated per `00-gap-review.md`; call sits behind the always-empty `disputes:[]` payload (dead code path) |
| `src/app/status-validation/page.tsx:46` | `POST /api/prod/disputes/[id]/decide` (decideProdDispute) | route absent — same intentional deprecation; unreachable unless a dispute row exists |

All other targets verified live: `/api/bootstrap`, `/api/view-as{,/people}`, `/api/alerts/one-on-one`, `/api/popups`, `/api/options{,/[k]}`, `/api/config`, `/api/roster`, `/api/auth/login`, `/api/hub/{home,roster,admin,my-day,ecosystem}`, `/api/health`, `/api/queue/{health,refresh,scheduler,heatmap,checkins-page,analytics,aging,aging-flags}`, `/api/people/{one-on-ones{,/start,/log,/productivity,/schedule,/delete,/restore},tasks{,/status,/details,/milestone,/preview,/deadline},meetings,actions{,/updates,/status},notes,coaching,scorecard}`, `/api/tl/{page,rate,otd,kb}`, `/api/kpi/logs`, `/api/mail-desk`, `/api/trackers{,/records,/fields}`, `/api/qa/<fn>` (all 33 `P.*` names ∈ HANDLERS), `/api/tph/{page,trend,slots,tasks,run-step,run-day,touches,cases}`, `/api/prod/{my-page,flags,flags/[id],flags/[id]/decide,analytics}`.

`/api/queue/heatmap` GET `?input=` → `getHeatmapInput` ✔; scheduler GET `?view=` variants ✔.

---

## 3. Routes with no auth gate

| Route | Verdict |
|---|---|
| POST /api/options/[listKey] | **REAL GAP → WP-F8.** `actorEmail()` returns `system:trigger` sessionless, `assertWritable` passes sessionless → anonymous `INSERT` into `options`. Needs `currentEmail()`/`requireAuth` (outside the assertWritable-only fix allowance → reported). |
| GET /api/tph/cases | **REAL GAP → WP-F9.** No `requireRole`, no try/catch — anonymous read of `prod_tph_cases`. POST on the same route is correctly gated admin/tl + viewAsGuard. |
| GET /api/tph/tasks | **REAL GAP → WP-F9.** Same pattern on `prod_tph_tasks`. |
| POST|GET /api/qa/qaCtlReminders, /api/qa/qaEnsureCtlPopups | **REAL GAP → WP-F10.** Both exported fns have **no internal gate** (cron-intended; cron calls the lib via `/api/cron/job-qa-engine`), yet sit in the public dispatcher `HANDLERS` → anonymous POST sends reminder emails / raises popups. Fix = remove the two keys from HANDLERS (or wrap with `requireJobCaller`). |
| POST /api/auth/login, GET /api/auth/logout | public by design. |
| GET /api/bootstrap | `currentUser()` executes first — sessionless callers get the `role:'unknown'` limited shell (or 401); no sensitive data. Acceptable as designed. |
| GET /api/view-as, GET /api/view-as/people | session enforced inside (`viewAsRequireOwner`); state returns `{target:''}` sessionless. Covered. |

Routes whose file shows no `require*` token but are fully lib-gated (documented, NOT gaps): `/api/hub/{admin,home,roster,my-day}`, `/api/queue/{aging,aging-flags,analytics,checkins-page,health,heatmap,refresh,scheduler}`, `/api/people/**` (all), `/api/kpi/logs`, `/api/mail-desk`, `/api/tl/{kb,otd,page,rate}`, `/api/trackers/**`, `/api/qa/[action]` (gated per-handler except the two above), `/api/desk/setup`, `/api/alerts/one-on-one`, `/api/options` (GET).

---

## 4. Legacy `oi("fn")` → route map

Call surface extracted from all 37 closures. **Result: 100 % of live page calls map to a ported route; the only unmapped names are the two intentionally-deprecated dispute calls.**

| Legacy fn (per app bundle) | Route |
|---|---|
| hub: `getBootstrap getConfig getConfigRows getDropdownOptions addDropdownOption getViewAsPeople getViewAsState saveConfigSetting setAppUrl setConfig startViewAs stopViewAs oneOnOneAlerts oneOnOneAlertsSeen popupsPoll` | `/api/bootstrap`, `/api/hub/admin` (`fn=config`, actions `setConfig`/`saveConfig`/`setAppUrl`), `/api/options/[k]` GET/POST, `/api/view-as{,/people}` GET/POST/DELETE, `/api/alerts/one-on-one` GET/POST, `/api/popups` — same shared-shell set recurs in every app's bundle and maps identically |
| hub domain: `getHomePage getRosterAdmin setPersonV2Fields setPersonOverrides addHoliday removeHoliday syncRosterNow getQueueHealthPage refreshQueueNow getMyDay getMyDayPart searchMyMail createFocusBlock setAssistantSettings markFollowUpDone installAssistantDigestTrigger getEcosystemHealth` | `/api/hub/home`, `/api/hub/roster` (actions `setPerson`/`setOverrides`/`addHoliday`/`removeHoliday`/`syncRoster`), `/api/queue/health`, `/api/queue/refresh`, `/api/hub/my-day` (GET `?part`, actions `searchMail`/`focusBlock`/`setSettings`/`followUpDone`/`installDigest`), `/api/hub/ecosystem` |
| desk (13): `tlPerformancePage tlpRateArea tlpRateProject otdSave kbTrackerPage kbTrackerSave kpiLogsPage kpiLogSave kpiLogRemove mailDeskPage mailDeskRefresh mailApprovalDecide mailApprovalReset` | `/api/tl/page`, `/api/tl/rate` (action `area`/`project`), `/api/tl/otd`, `/api/tl/kb` GET/POST, `/api/kpi/logs` GET/POST/DELETE, `/api/mail-desk` GET + actions `refresh`/`decide`/`reset` |
| operations (6): `getTrackersPage getTrackerRecords addTrackerRecord addTrackerField updateTrackerField createTracker` | `/api/trackers` GET/POST, `/api/trackers/records` GET/POST, `/api/trackers/fields` POST/PATCH |
| people (43): `oneOnOnes*(13) meetings*(9) actions*(3) tasks*(7) notes*(3) coachingPage coachingSignal getScorecard*(3) refreshScorecard saveScorecardSource removeScorecardSource` + shared shell | `/api/people/one-on-ones{,/start,/log,/productivity,/schedule ops,/delete ops,/restore}` + POST submit; `/api/people/meetings` GET + 8 POST ops; `/api/people/actions{,/updates,/status}`; `/api/people/tasks{,/preview,/milestone,/status,/deadline,/details}`; `/api/people/notes` GET/POST/DELETE; `/api/people/coaching`; `/api/people/scorecard` GET views + POST `refresh`/`save_source`/`remove_source` |
| productivity (15): `getProdMyPage getProdReviewPage getProdFlag decideProdFlag getProdAnalyticsPage getTphPage getTphTrend getTphTouchList saveTphSlots saveTphTask runTphStep runTphDay saveTphCases` → 13 map | `/api/prod/my-page`, `/api/prod/flags`, `/api/prod/flags/[id]`, `/api/prod/flags/[id]/decide`, `/api/prod/analytics`, `/api/tph/{page,trend,touches,slots,tasks,run-step,run-day,cases}`; **`raiseProdDispute`, `decideProdDispute` → unmapped (deprecated `prod_disputes`, gap-review)** |
| quality (33 via `P`): all `getQa*`/`submitQa*`/`createQa*`/`decideQaDispute`/`saveQa*`/`confirmQaCtl`/`requestQaAudit`/`waiveQaAuditRequest`/`passQaQueueItem`/`importQaQueueNow`/`resendQaAuditEmail`/`setQaAuditorGrant`/`addQaKbGap`/`markQaKbGapAdded`/`startQaAudit` | `POST /api/qa/<fn>` — every `P` name exists in `HANDLERS` (route.ts:11-51) |
| queue (33): `getQueueHealthPage refreshQueueViaHub submitCheckin getCheckinsPage getAnalyticsPage getAgingPage agingFlagTicket agingResolveFlag` + `scheduler*(14)` + `getHeatmapPage getHeatmapInput saveHeatmapInput saveHeatmapAssumptions buildHeatmapFromSource runPriorHeatmapRegression setHeatmapCountries parseHeatmapUpload` + shared shell | `/api/queue/{health,refresh,checkins-page POST submitCheckin? — submitCheckin maps to /api/queue/checkins-page POST,analytics,aging,aging-flags}`, `/api/queue/scheduler` GET views + POST ops (`save`,`saveSettings`,`saveTeamDates`,`saveOffDays`,`submitRequest`,`respondToSwap`,`decide`,`setOverride`,`setHourOverride`,`import` — `schedulerPlan/Settings/Requests/OffDays` fold into GET), `/api/queue/heatmap` GET `?input=` + POST ops |

**Unmapped legacy calls:** `raiseProdDispute`, `decideProdDispute` — deprecated store (`prod_disputes`), documented residual per `00-gap-review.md` and WP-16 audit; page call sites are unreachable dead code. Server-side legacy fns not invoked by pages (roster sync jobs, Freshchat pulls, `diagnoseAging`, `debugMyDay`, `doPost`, QA/people/productivity backfill+setup+diagnostic fns) are job/diagnostic surface already classified in module audits — `debugMyDay` does exist as a `/api/hub/my-day` `debug` action; `runRosterSync`/`jobRosterSync` and Freshchat remain gated/missing-credentials per gap-review §4/§10 (not new gaps).

---

## 5. Fixes applied this audit (permitted ≤30-line `assertWritable` passthroughs)

| File | Change | Why |
|---|---|---|
| `src/app/api/mail-desk/route.ts` | `+ assertWritable()` at POST top | `refresh` action runs `mailDeskRefresh`→job writes with no guard in lib; legacy `Repo.js` guarded at write level |
| `src/app/api/hub/my-day/route.ts` | `+ assertWritable()` for all POST actions except `searchMail`/`debug` (reads) | `followUpDone`→`appendRow` (unguarded repo seam); legacy `appendRow_` ran `viewAsGuard_` |
| `src/app/api/health/route.ts` | `+ assertWritable()` in POST after `requireRole(['admin'])` | `setupHealth` writes `health` rows; admin-viewing-as-admin could write |
| `src/app/api/admin/mirrors/route.ts` | `+ assertWritable()` before `syncAllMirrors` | bulk mirror writes; `peek` diagnostic branch left unguarded (read-only) |
| `src/app/api/admin/backfill/route.ts` | `+ assertWritable()` before `runBackfill` | bulk recompute writes |

13 insertions total across 5 route files; no behavioral change for key/cron/session callers (`assertWritable` passes with no session and for non-view-as users).

## 6. New follow-ups

- **WP-F8** — `POST /api/options/[listKey]` unauthenticated write.
- **WP-F9** — `GET /api/tph/cases` + `GET /api/tph/tasks` unauthenticated reads.
- **WP-F10** — `qaCtlReminders`/`qaEnsureCtlPopups` exposed ungated via `/api/qa/[action]` dispatcher.

## 7. Gate result

`npx tsc --noEmit` — **see tracker evidence** (run post-edit).
