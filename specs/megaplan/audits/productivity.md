# WP-16 — cx-productivity audit

Run against HEAD by wave-1 agent. Oracle: `../Productivity_Depricated/` (`ProductivityApp.js`, `ProdTph.js`, `productivity.js`, `ProdValidation.js`, `Code.js`, `Health.js`) + extracted bundle `.devin/work/extract/productivity/` (`pages/*.closure.js`, `pages/*.js`, `app.pretty.js` call maps).

**Scope:** 4 registered pages + the `tph-grid` extra route, the prod/TPH API surface, the daily job chain + TPH/quarterly jobs, and residual gaps (`getFlagAnalytics`, `redetectProductivityFlags`, `backfillProductivityIntervals`, `importProductivityEmail`, dispute dead code, TPH cadence, fake tests).

## Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** (post-fix) |
| `npx vitest run` | **817 tests / 41 files / 0 failures** |

Real oracle coverage for this module lives in `tests/golden/`: `prod-validation.test.ts` (26), `productivity.test.ts` (16), `tph.test.ts` (22) — 64 verbatim-vs-`node:vm` tests. The fake literal-assertion suites in `src/features/cx-productivity/lib/{productivity,tph}.test.ts` (zero imports of ported code; logic re-created inline) are **WP-25 scope, confirmed safe to retire** — every pure fn they pretend to cover is covered by a golden suite.

## Function matrix

Legacy public functions = top-level `function name(` without trailing `_` across the four productivity files (+ `Code.js` delegation).

| Legacy fn | Ported to | Route / caller | Status |
|---|---|---|---|
| `getProdReviewPage` (ProductivityApp.js:684) | `app/api/prod/flags/route.ts` GET:46 (inline assembly; `ruleView` prod-validation.ts:281; `flagView`; `prodSeenStatuses_`; scope `flagInScope` prod-access.ts) | `GET /api/prod/flags` | OK |
| `getProdFlag` (:704) | `app/api/prod/flags/[flagId]/route.ts` GET:11 | `GET /api/prod/flags/[flagId]` | OK |
| `decideProdFlag` (:717) | `app/api/prod/flags/[flagId]/decide/route.ts` POST:35 (`prodCheckDecision_` + dirty-mark) | `POST /api/prod/flags/[flagId]/decide` | OK |
| `getProdMyPage` (:740) | `app/api/prod/my-page/route.ts` GET:27 | `GET /api/prod/my-page` | OK |
| `getProdAnalyticsPage` (:1035) | `app/api/prod/analytics/route.ts` GET:13 (`prodAnalyticsFor_`/`prodAnalytics_` lib/prod/analytics.ts) | `GET /api/prod/analytics` | OK |
| `raiseProdDispute` / `decideProdDispute` | — | — | **D5: removed upstream in legacy** (ProductivityApp.js:29,55,754; server returns `disputes: []`). Dead page code retained verbatim; see Residuals #5. |
| `getFlagAnalytics` (Code.js → `getProdFlagAnalytics_`) | write side only: `prodFlagAnalyticsStep_` jobs/productivity.ts:268 | — | **PORTED-AS (write side)** — 0 call sites in the bundle's server-call map (`ce`/`ae` in app.pretty.js:1686-1708); no page-facing endpoint needed. Table `prod_flag_analytics` still consumed by quarterly report. |
| `jobProductivityDaily` (:450) | `jobProductivityDaily` jobs/productivity.ts:379 → `prodDailySteps_` :316 | `GET /api/cron/job-productivity-daily` | OK (see Jobs matrix) |
| `backfillProductivityIntervals` (:531) | `runBackfill` jobs/backfill.ts:88 (`kinds`: mirrors/grid/tph/layers/flags; resumable cursor + time budget; honest skips) | `POST /api/admin/backfill` | **PORTED-AS** — legacy re-read the FD_AUX sheet per date; port sources intervals from the migrated `prod_intervals` store / mirror seams and skips honestly when sources are absent. Same admin-entry semantics, documented shift. |
| `importProductivityEmail` (:565) | `prodSnapshotIntervals_` jobs/productivity.ts:117 + `prodLatestActivityMail_` :64 (Gmail adapter seam; `env.lastMail`/`setLastMail` → config `prod_last_mail`) | daily chain step `prod_snapshot` | **GATED G4** — seam correct: returns `{skipped:'gmail adapter not configured'}` rather than fabricating rows. |
| `redetectProductivityFlags` (:576) | `runBackfill` `kinds:['flags']` jobs/backfill.ts:251 → `prodFlagsStep_` + dirty mark | `POST /api/admin/backfill` | **RESOLVED at HEAD** — was MISS (re-detection ran but recomputed dates were never marked dirty); fixed inline this audit (backfill.ts:262 `dirty.push(d)`). |
| `setupProductivity` (:592) | — | — | **DIAG** — GAS admin installer (sheet/tab/property seeding). Settings seeding covered by platform config seed + migrations; documented skip, same class as `setupQuality`/`diagnoseAging` in sibling audits. |
| `installProductivityTriggers` (:611) | — | — | **DIAG** — GAS trigger install → `vercel.json`; cadence deltas → WP-24. |
| `runProductivityRange` (productivity.js:240) | `runProductivityRange` lib/prod/engine.ts:611 (guard + run-log + optional `buildAgentAggregates_` io seams) | reachable via `/api/admin/backfill` `kinds:['layers']` | PORTED-AS (functionally) |
| `jobQuarterlyReport` (:983) | `jobQuarterlyReport` jobs/quarterly.ts:134 (`prodQuarterlyReport_` :29, `prodSendQuarterlyReport_` :76; aggregates `prod_flag_analytics` → `prod_quarterly_reports`; mail adapter honored) | `GET /api/cron/job-quarterly-report` | OK |
| `getTphPage` (ProdTph.js:794) | `lib/tph/page.ts:259` (`tphLoadStore_` + page assembly) | `GET /api/tph/page` | OK |
| `getTphTrend` (:891) | `lib/tph/page.ts:337` | `GET /api/tph/trend` | OK |
| `saveTphSlots` (:1026) | `saveTphSlots` lib/tph/write.ts:114 (`tphCheckDate_`/`tphCheckAgent_`/`tphCheckCalls_`, grid paint + ±calls flag) | `POST /api/tph/slots` | OK |
| `saveTphTask` (:1054) | `saveTphTask` lib/tph/write.ts:148 (add + `remove` path; `task:` source tagging verbatim) | `POST /api/tph/tasks` | OK |
| `saveTphCases` (:1088) | `saveTphCases` lib/tph/write.ts:204 (TL manual rows `source:'tl'` preserved vs `auto`) | `POST /api/tph/cases` | OK |
| `jobTphHourly` (:1119) | `jobTphHourly` jobs/tph.ts:20 → `tphCaptureCases_` | `GET /api/cron/job-tph-hourly` | OK — **cadence divergent** (WP-24): `5,55 * * * *` = 30 min vs legacy `everyHours(15min)`. |
| `diagnoseTphTouches` (:1242) | pure core only: `tphDiagnoseTouchLines_` lib/tph/index.ts:1769 | — | **DIAG → WP-F7** — no admin route/wrapper; expose or document skip. |
| `runTphStep` (:1406) | `tphRunStep_` lib/tph/run.ts (steps `touches`/`calls`/`cases_tickets`/`cases_chats`) | `POST /api/tph/run-step` | OK |
| `getTphTouchList` (:1418) | `tphTouchList_` lib/tph/index.ts:690 (`fd_activities` tail + headcount seam in route) | `GET /api/tph/touches` | OK |
| `runTphDay` (:1436) | route loop verbatim — `TPH_STEPS` + `TPH_TIME_GUARD_MS`, per-step error buckets, `touches` throw re-throw | `POST /api/tph/run-day` | OK |
| `jobTphPastDays` (:1484) | `jobTphPastDays` jobs/tph.ts:37 → `tphBuildPastDays_` (prev-3-day stale/missing rebuild) | `GET /api/cron/job-tph-past-days` | OK — **cadence divergent** (WP-24, new finding): `0 5 * * *` = daily vs legacy `everyHours(1)`. |

## Per-page checklist

Bundle call maps (`app.pretty.js:1686-1708`): `ce` → reviewPage/flag/decide/myPage/dispute/decideDispute/analytics; `ae` → page/trend/saveSlots/addTask/removeTask/runStep/runDay/touchList/saveCases. Every `ce`/`ae` call maps to a real fetch below; the two dispute calls are dead-by-design (no routes exist; see Residuals #5).

| Page (bundle id) | Structure / copy / order | Fetch↔route map | Gate | Verdict |
|---|---|---|---|---|
| `status-validation` (Ra) | `dq-head`/`Pa` header, `pv-q` pending list (`pv-item` buttons, `pv-item__who`/`__what`, `Y` days-left badge), `Da` decide panel in `cx-panel--pad` (`cx-grid-2 pv-review` when open), `pv-d` disputes block (never rendered — `disputes:[]`), `pv-h` decided table, `La` admin source section (query / lastMailAt / lastSnapshot / statusesSeen + "(not in Productivity %)" suffix). Copy verbatim incl. "Nothing to review", "N to review", "auto-accepts today"/"N days left", rule subtitle. | reviewPage→`GET /api/prod/flags`; flag→`GET /api/prod/flags/[id]`; decide→`POST .../decide`; decideDispute→dead | page+API `admin\|tl`; detail also `agent` via `flagInScope` | **parity** |
| `my-status` (Ia) | `dl` mine card, flags list w/ kt strip + `Mt` cases + `DecisionChip`, unreachable dispute affordance (`canDispute:false`), `Tn` trend. | myPage→`GET /api/prod/my-page`; dispute→`POST /api/prod/disputes` (route absent, unreachable) | registry `agent`; API `admin\|tl\|agent` (own-data) | **parity** — one note: `ruleView` emits `disputeDays:3` (prod-validation.ts:292) where legacy `prodRuleView_` emits no such key, so the subtitle renders "…up to 3 days after the review." vs legacy's literal `undefined`. Superset, not a rewrite — question for PM (Residuals #6). |
| `productivity-analytics` (Fa) | week-nav aside, `pa-a`/`pa-t`/`pa-d`/`pa-w`/`pa-h`/`pa-c` sections, `tlMedian` row; heatmap + calibration admin-only (server-omitted for TLs); disputes always `[]` (mechanism removed); legacy `eval('from')` quirk preserved. | analytics→`GET /api/prod/analytics` | `admin\|tl` page+API | **parity** |
| `tph` + `tph-grid` extra (za+Ga) | `app/tph/page.tsx` re-exports `app/tph-grid/page.tsx` (~1.9k lines) so `/tph` (registry path) and `/tph-grid` (old URL) serve the identical component. 6 tabs + hidden grid panel, `tph-grid`/`tph-gridwrap`/`tph-lock` classes, `Ya` tabs w/ badges, `Ja` day-nav; `storeErrors` additive notice incl. `GET /api/admin/source-health` hint. | page→`GET /api/tph/page`; trend→`GET /api/tph/trend?from=`; saveSlots→`POST /api/tph/slots`; addTask/removeTask→`POST /api/tph/tasks` ×2; saveCases→`POST /api/tph/cases`; runStep→`POST /api/tph/run-step`; runDay→`POST /api/tph/run-day`; touchList→`GET /api/tph/touches` | `admin\|tl` all routes | **parity** |

## Gate matrix

| Route | Role | view-as write refusal | Notes |
|---|---|---|---|
| `GET /api/prod/flags`, `/api/prod/flags/[flagId]` | admin\|tl (detail: +agent scoped by `flagInScope` — admin all, tl roster team w/ stored `tl_email` fallback, agent self) | n/a | registry `status-validation: admin,tl` ✓ |
| `POST /api/prod/flags/[flagId]/decide` | admin\|tl | ✅ `viewAsGuard` | marks decided date dirty (decision changes effective layers) ✓ |
| `GET /api/prod/my-page` | admin\|tl\|agent | n/a | registry `my-status: agent` (nav visibility); API allows all roles their own — matches legacy `getProdMyPage` ✓ |
| `GET /api/prod/analytics` | admin\|tl | n/a | registry `productivity-analytics: admin,tl`; admin-only fields server-omitted for TL ✓ |
| `GET /api/tph/page`, `/trend`, `/touches`, `/days` | admin\|tl | n/a | registry `tph: admin,tl` ✓ |
| `POST /api/tph/{slots,tasks,cases,run-step,run-day,days}` | admin\|tl | ✅ `viewAsGuard` on all mutating routes | ✓ |
| `POST /api/admin/backfill` | `requireAdminCaller` | n/a | admin maintenance ✓ |
| `/api/cron/*` (7 prod routes) | `requireJobCaller` + `CRON_SECRET` bearer | n/a | ✓ |
| surplus read routes `GET /api/prod/{intervals,daily-layers}` | admin\|tl | n/a | **no page callers** — test/debug seams → noted for WP-18 (Residuals #7) |

## Jobs matrix

Daily chain — `prodDailySteps_` (jobs/productivity.ts:316) keeps each legacy `dqStep_` name verbatim; `dqStep_` (shared/jobs/steps.ts) is a verbatim port (`hbBeat(job)` stamps the exact job key). Chain = legacy 7 steps + additive `mirror_sync` head:

| dqStep_ key | Impl | Legacy step |
|---|---|---|
| `mirror_sync` | jobs/productivity.ts:319 | *(additive — FD mirror prefetch seam)* |
| `prod_snapshot` | `prodSnapshotIntervals_` :117 → Gmail adapter seam (G4-gated skip) | prod_snapshot |
| `prod_flags` | `prodFlagsStep_` :243 | prod_flags |
| `prod_flag_analytics` | `prodFlagAnalyticsStep_` :268 | prod_flag_analytics |
| `productivity` | `prodComputeStep_` :278 | productivity |
| `prod_tph_touches` | :353 | prod_tph_touches |
| `prod_tph_calls` | :361 | prod_tph_calls |
| `prod_tph_cases_rebuilt` | `prodTphCasesRebuiltStep_` :287 | prod_tph_cases_rebuilt |

| Job route | Impl | `dqStep_` key | vercel.json | Legacy | Cadence verdict |
|---|---|---|---|---|---|
| `/api/cron/job-productivity-daily` | `jobProductivityDaily` :379 | (chain above) | `30 6 * * *` | ~08:30 business tz | per WP-A doc (08:30 Cairo→06:30 UTC); tz detail → WP-24 |
| `/api/cron/flag-detection` | `prodFlagsStep_` (yesterday) | `prod_flags` | `30 6 * * *` | step ran once inside chain | **additive re-run** — WP-24 |
| `/api/cron/daily-layers` | `prodComputeStep_` (dirty dates) | `productivity` | `45 6 * * *` | step ran once inside chain | **additive re-run** — WP-24 |
| `/api/cron/analytics-aggregation` | `prodFlagAnalyticsStep_` (yesterday) | `prod_flag_analytics` | `0 7 * * *` | step ran once inside chain | **additive re-run** — WP-24 |
| `/api/cron/job-tph-hourly` | `jobTphHourly` tph.ts:20 | `prod_tph_cases` | `5,55 * * * *` (30 min) | `everyHours(15min)` | **divergent** — WP-24 |
| `/api/cron/job-tph-past-days` | `jobTphPastDays` tph.ts:37 | `prod_tph_auto` | `0 5 * * *` (daily) | `everyHours(1)` | **divergent** — WP-24 (new finding: 24× less frequent) |
| `/api/cron/job-quarterly-report` | `jobQuarterlyReport` quarterly.ts:134 | — | `0 6 1 * *` (monthly, quarter-check inside) | `onMonthDay(1)` | parity |

Heartbeat: `HB_PLAN` (shared/platform/health.ts:51-53) is verbatim vs legacy `Health.js:48-50` — exactly the 3 productivity rows `prod_snapshot`/`prod_flags`/`productivity`; TPH step names (`prod_tph_cases`, `prod_tph_auto`) beat via `dqStep_` like legacy (not HB_PLAN rows in either).

## Residual gaps

1. **RESOLVED inline (this audit):** `runBackfill` `kinds:['flags']` now pushes re-detected dates into `prod_dirty_dates` after `prodFlagsStep_` (jobs/backfill.ts:262), matching `redetectProductivityFlags`'s `prodMarkDirty_(dates)` — previously recomputed flags never re-layered.
2. **`diagnoseTphTouches`** — pure `tphDiagnoseTouchLines_` ported; no admin wrapper/route. **DIAG → WP-F7.**
3. **TPH cadence** — `job-tph-hourly` 30-min vs 15-min; `job-tph-past-days` daily vs hourly (new finding); three standalone step crons add same-day re-runs legacy didn't have. All **WP-24**, documented here only.
4. **`importProductivityEmail` / G4** — seam verified correct: `prodLatestActivityMail_` returns honest `skipped:'gmail adapter not configured'`; `prod_last_mail` config seam wired (`env.lastMail`/`setLastMail`). Minor note for G4 landing: `source.lastMailAt` in the flags route is hardcoded `''`; when the adapter lands, read it from `env.lastMail().ms` (1 line, app/api — outside WP-16's fix scope).
5. **Dispute UI (D5)** — dead parity code confirmed, *not* a shipped workflow: `disputes:[]` server-side (flags route:140), `canDispute:false` in `flagView`, `/api/prod/disputes*` routes absent, `prod_dispute_days` deprecated. Page-side `DisputeRaise`/decide components retained verbatim per D5 — unreachable.
6. **`ruleView.disputeDays` superset** — port emits the deprecated setting (renders "3"); legacy emitted no key (rendered `undefined`). Copy string itself verbatim. **Question for PM:** keep superset or strip to verbatim `undefined`.
7. **Surplus read-only API** — `/api/prod/intervals`, `/api/prod/daily-layers`, `/api/tph/days` have no page callers (test/debug seams) → noted for WP-18 api-surface audit.
8. **Fake tests** — `lib/{productivity,tph}.test.ts` confirmed literal-assertion fakes; real coverage = 64 golden tests → **WP-25**, safe to retire.
9. **`setupProductivity` / `installProductivityTriggers`** — DIAG, GAS-only installers; documented skips (config seed covers `PROD_SETTINGS`; `vercel.json` owns triggers).

## Report

- **Shipped:** audit doc; `jobs/backfill.ts` dirty-mark fix (+2 lines) — `redetectProductivityFlags` semantics now complete via `/api/admin/backfill`.
- **Gates:** `tsc --noEmit` 0 errors; `vitest run` 817/817 green.
- **WP-F rows added:** `WP-F7` — expose `diagnoseTphTouches` as an admin diagnostic route (pure `tphDiagnoseTouchLines_` already ported) or document skip.
- **Existing WPs cited:** WP-24 (3 cadence deltas: tph-hourly 15→30min, tph-past-days hourly→daily, additive standalone step crons), WP-25 (fake tests), WP-18 (surplus read routes), G4 (Gmail import seam), WP-17 (deep shell-gate sweep).
- **Questions for PM/orchestrator:** (a) keep `ruleView.disputeDays` superset or strip to verbatim `undefined`? (b) expose `diagnoseTphTouches` (WP-F7) or document-skip like `diagnoseAging`? (c) `backfillProductivityIntervals` PORTED-AS accepted — port sources intervals from migrated store/mirror seams rather than re-reading FD_AUX sheet rows?
