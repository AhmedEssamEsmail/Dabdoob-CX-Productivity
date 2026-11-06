# WP-12 — cx-queue audit (Queue & Workforce)

Run 2026-11-06 against HEAD (`b051bb8` + wave-0 fixes). Legacy source: `Queue_deprecated` (page-facing files) + `Command_Center_V2_deprecated` (hub-owned pipeline steps the port keeps under `cx-queue/lib/jobs.ts`). Page extracts: `.devin/work/extract/queue/pages/*.closure.js`.

**Verdict:** all 6 pages are verbatim re-ports at parity (classes, copy, call-wiring). One real defect found and fixed inline: the queue jobs ran the legacy `dqStep_` step names but never called `hbBeat_`/`hbFlush_`, so every queue heartbeat row stayed empty, `dqLastRun` always returned `''` (inflow ran every tick instead of hourly), and the Health board showed all queue jobs as never-run. Two larger residuals → WP-F2, WP-F3.

## 1. Legacy public-function matrix

Public = no trailing underscore. Verified by grep across all 26 legacy `.js` files; non-queue files (Auth/Code/Repo/Popups/etc.) belong to their own module audits. `TlSnapshots.js`, `KpiPayout.js`, `WorkCalendar.js` contain only `*_` helpers (covered by golden tests / feeding WP-F2).

| Legacy fn | File:line | Port | Route | Status |
|---|---|---|---|---|
| `getQueueHealthPage` | QueueCore.js:256 | `server.ts:70` | `GET /api/queue/health` | PORTED |
| `refreshQueueViaHub` | QueuePages.js:15 | `pages.ts:246` `refreshQueueNow` | `POST /api/queue/refresh` | PORTED-AS — single deployment: same-app `refreshQueueNowJob` instead of cross-app URL fetch; `requireRole(admin,tl)` + `assertWritable()` + throttle parity kept |
| `getAgingPage` | QueuePages.js:43 | `pages.ts:38` | `GET /api/queue/aging` | PORTED |
| `getAnalyticsPage` | QueuePages.js:73 | `pages.ts:78` | `GET /api/queue/analytics` | PORTED |
| `getCheckinsPage` | QueuePages.js:105 | `pages.ts:109` | `GET /api/queue/checkins-page[?slot]` | PORTED |
| `submitCheckin` | QueuePages.js:233 | `pages.ts:197` | `POST /api/queue/checkins-page` | PORTED |
| `agingFlagTicket` | AgingHelp.js:10 | `pages.ts:287` → `server.ts:151` | `POST /api/queue/aging-flags` | PORTED |
| `agingResolveFlag` | AgingHelp.js:35 | `pages.ts:325` → `server.ts:162` | `POST /api/queue/aging-flags` | PORTED |
| `getHeatmapPage` | Heatmap.js:388 | `heatmap.ts:527` | `/api/queue/heatmap` op dispatcher | PORTED |
| `saveHeatmapInput` | Heatmap.js:399 | `heatmap.ts:539` | same | PORTED |
| `parseHeatmapUpload` | Heatmap.js:409 | `heatmap.ts:550` (CSV+XLSX) | same | PORTED |
| `buildHeatmapFromSource` | Heatmap.js:421 | `heatmap.ts:562` | same | PORTED |
| `runPriorHeatmapRegression` | Heatmap.js:438 | `heatmap.ts:584` | same | PORTED |
| `getHeatmapInput` | Heatmap.js:452 | `heatmap.ts:605` | same | PORTED |
| `saveHeatmapAssumptions` | Heatmap.js:458 | `heatmap.ts:611` | same | PORTED |
| `setHeatmapCountries` | Heatmap.js:472 | `heatmap.ts:625` | same | PORTED |
| `schedulerPlan` | Scheduler.js:1397 | `scheduler.ts:1235` | `/api/queue/scheduler` op dispatcher | PORTED |
| `schedulerSave` | Scheduler.js:1446 | `scheduler.ts:1279` | same | PORTED |
| `schedulerSettings` | Scheduler.js:1493 | `scheduler.ts:1321` | same | PORTED |
| `schedulerSaveSettings` | Scheduler.js:1499 | `scheduler.ts:1327` | same | PORTED |
| `schedulerSaveTeamDates` | Scheduler.js:1509 | `scheduler.ts:1340` | same | PORTED |
| `schedulerOffDays` | Scheduler.js:1524 | `scheduler.ts:1368` | same | PORTED |
| `schedulerSaveOffDays` | Scheduler.js:1548 | `scheduler.ts:1396` | same | PORTED |
| `schedulerSetOverride` | Scheduler.js:1570 | `scheduler.ts:1439` | same | PORTED |
| `schedulerSetHourOverride` | Scheduler.js:1585 | `scheduler.ts:1455` | same | PORTED |
| `schedulerRequests` | Scheduler.js:1624 | `scheduler.ts:1515` | same | PORTED |
| `schedulerSubmitRequest` | Scheduler.js:1635 | `scheduler.ts:1525` | same | PORTED |
| `schedulerRespondToSwap` | Scheduler.js:1685 | `scheduler.ts:1582` | same | PORTED |
| `schedulerDecide` | Scheduler.js:1700 | `scheduler.ts:1606` | same | PORTED |
| `schedulerImport` | Scheduler.js:1743 | `scheduler.ts:1657` | same | PORTED |
| `setupSchedulerTables` | Scheduler.js:1786 | `scheduler.ts:1717` | admin | PORTED-AS — Postgres tables are migrated, not created; kept as parity probe |
| `importOctober2026Shifts` | Scheduler.js:1797 | `scheduler.ts:1728` | admin (delegates to `schedulerImport`) | **DIVERGENCE → WP-F3** (89/124 fixture lines missing) |
| `jobTlQueueMetrics` | TlQueue.js:467 | `tlqueue.ts:170` | `GET/POST /api/cron/job-tl-queue` | PORTED (partial internals → WP-F2) |
| `rebuildTlQueueMetrics` | TlQueue.js:474 | `tlqueue.ts:111` (+`rebuildTlQueueMetricsEntry`:184, `?dates=` on cron route) | same | PORTED (partial → WP-F2) |
| `installTlQueueTrigger` | TlQueue.js:488 | `tlqueue.ts:191` | none | PORTED-AS — schedules live in `vercel.json`/pg_cron; returns a note, no install |
| `dqCheckinTick_` / `dqRemindMissedCheckins_` / `dqStep_` / `dqMarkRun_` / `dqLogRun_` / `dqRewrite_` / `dqActiveTlEmails_` | hub Queue.js / Stores.js | `jobs.ts:47–330` | via cron routes | PORTED (heartbeats fixed this audit) |
| `jobDataTick` / `refreshQueueNow` internals / `jobNightlyAggregates` / `buildQueueAggregates_` / `buildInflowAggregates_` / `buildAgentAggregates_` | hub Aggregates.js:155–522 | `jobs.ts:81–395` | `/api/cron/job-data-tick`, `/api/cron/job-nightly-aggregates`, `/api/queue/refresh` | PORTED |

Non-page legacy helpers (`tlq*`, `tls*`, `kpi*`, `wc*`, `hm*` internals): ported in `index.ts`, `tlqueue.ts`, `heatmap-engine.ts`, `scheduler.ts`; pure ones golden-tested (`tests/golden/queue.test.ts`, 10 tests incl. 200-vector sweep).

**No `MISS`, no unclassified `DIAG`.** `GATED` items: `fc_messages` job and the Freshchat daily-report mirror have no implementation — `FRESHCHAT_API_KEY` absent (B3 / WP-53); Maqsam mirror is live.

## 2. Page parity checklist

All 6 page components are thin-route + verbatim-closure ports (`b051bb8`). Class vocabulary, section order, empty states, copy strings and `oi()`-call→fetch mappings all verified against the closure extracts. Titles/`purpose` come from the route registry (`specs/legacy-parity/data/legacy-route-registry.json:338–416`) — matching the legacy `t.title`/`t.purpose` props.

| Page | Closure | Component | Calls → fetches | Verdict |
|---|---|---|---|---|
| `/queue` | `queue.closure.js` (`Ua`, `_t`, `ys`) | `queue-page.tsx` + `shared.tsx` | `getQueueHealthPage`→`/api/queue/health`; `refreshQueueViaHub`→`POST /api/queue/refresh` | parity |
| `/aging` | `aging.closure.js` (`za`) | `aging-page.tsx` | `getAgingPage`→`/api/queue/aging`; flag/resolve→`/api/queue/aging-flags`; refresh→`/api/queue/refresh` | parity |
| `/checkins` | `checkins.closure.js` | `checkins-page.tsx` | `getCheckinsPage`→`/api/queue/checkins-page(?slot)`; `submitCheckin`→POST same | parity |
| `/analytics` | `analytics.closure.js` | `analytics-page.tsx` | `getAnalyticsPage`→`/api/queue/analytics` | parity |
| `/heatmap` | `heatmap.closure.js` | `heatmap-page.tsx` | all 8 heatmap fns→`/api/queue/heatmap` dispatcher | parity |
| `/scheduler` | `scheduler.closure.js` | `scheduler-page.tsx` | all scheduler fns→`/api/queue/scheduler` dispatcher | parity |

Verified details: `dq-head`/`page-title`/`page-purpose`/`dq-head__aside` header shape, `dq-stats`/`dq-stat*` tiles, `dq-refresh` cooldown + `retryInS` + `aria-busy`, `cx-ladder`/`cx-agechip`/`data-age`/`ageRank`, `cx-agegrid`, `cx-dayrail`, `dq-headline`/`dq-rank`/`dq-chart__*`, `hm-*` and `sch-*` vocab, `cc-skel__*`/`cc-sweep-*`/`cc-tip` machinery (`shared.tsx`), count-up/`arDigits`/rtl handling, exact copy incl. "No queue matches…", "Stale: these figures are from the daily report", "Freshdesk is read every 15 minutes…", "Ask my TL for help", "Four times a day: 09:30, 13:00, 18:30 and 22:00 Kuwait time.", missed/late check-in flows with correction reason, `?unassigned`/`?flagged`/`?ticket`/`?mine` hash-param deep links.

Minor notes (not defects): `queue-page.tsx` `route.purpose ?? '…'` fallback is dead code while the registry supplies `purpose` (legacy passes `t.purpose` unconditionally); aging's "not specialist" registry note is realised as `scope==='agent'` rendering + specialist→agent identity mapping (`platform/identity.ts:103`).

## 3. Gate matrix

Legacy `requireRole_`/`viewAsGuard_` → port `requireRole`/`assertWritable` (data layer, so the thin dispatcher routes stay safe). All verified at file:line.

| Entry | Legacy gate | Port gate | Match |
|---|---|---|---|
| `getQueueHealthPage` | `admin,tl` (QueueCore.js:257) | `server.ts:71` | ✓ |
| `refreshQueueViaHub` | `admin,tl` + `viewAsGuard_` | `pages.ts:247–248` | ✓ |
| `getAgingPage` | `admin,tl,agent` | `pages.ts:39` | ✓ |
| `getAnalyticsPage` | `admin,tl` | `pages.ts:79` | ✓ |
| `getCheckinsPage` | `admin,tl` | `pages.ts:110` | ✓ |
| `submitCheckin` | `admin,tl` + write | `pages.ts:198–199` | ✓ |
| `agingFlagTicket` | `admin,tl,agent` + write | `pages.ts:288–289` | ✓ |
| `agingResolveFlag` | `admin,tl` + write | `pages.ts:326–327` | ✓ |
| heatmap reads (page/input/parse) | `admin,tl` | `heatmap.ts:528/551/606` | ✓ |
| heatmap writes (input/assumptions) | `admin,tl` + write | `heatmap.ts:540–541/612–613` | ✓ |
| heatmap admin (build/regression/countries) | `admin` | `heatmap.ts:563/585/626` | ✓ |
| scheduler reads (plan/settings/offDays/requests) | `schUser_` = `admin,tl` | `scheduler.ts:1236/1322/1369/1516` | ✓ |
| scheduler writes (save/*) | `schAdmin_` = `admin` | `scheduler.ts:1280/1328/1341/1397/1440/1456/1607/1658/1718` | ✓ |
| `schedulerSubmitRequest`/`RespondToSwap` | `admin,tl` + write | `scheduler.ts:1526/1583` | ✓ |
| `importOctober2026Shifts` | (editor one-off) → `schedulerImport`=`admin` | delegates to `schedulerImport` `admin`+write | ✓ |
| `rebuildTlQueueMetrics`/`installTlQueueTrigger` | `admin` (TlQueue.js:475/489) | entry via cron `requireJobCaller`/CRON_SECRET; `installTlQueueTrigger` probe unexported from any route | ✓ (route-level) |
| Registry roles (page metadata) | — | queue `admin,tl` · aging `admin,tl,agent` · checkins/analytics/heatmap/scheduler `admin,tl` | ✓ |

View-as: every mutating fn calls `assertWritable()` at the data layer (pages/server/heatmap/scheduler); `importOctober2026Shifts` inherits it through `schedulerImport`. `/api/cron/job-tl-queue` accepts Bearer `CRON_SECRET` or a session through `requireJobCaller` — same pattern as the other cron routes.

## 4. Jobs / heartbeat map (fixed this audit)

**Defect found & fixed:** `jobs.ts` ran the verbatim `dqStep_` step names but had no `hbBeat`/`hbFlush` at all, and `jobTlQueueMetrics` had no `hbRun_`/`dqMarkRun_`. Consequences: Health board showed every queue job "awaiting first run"; `dqLastRun` (`stores.ts:97` → health `last_ok_at` fallback) always returned `''`, so `jobDataTick`'s hourly `inflow` gate never throttled (ran every 15-min tick) and page as-of/synced-at hints stayed empty. `dqMarkRun_` itself writes only the in-process `cachePut`, so the heartbeat row was the sole cross-request stamp.

Fix (verbatim per `Stores.js:600`, `Aggregates.js:179–181/294–299/433/471/504`, `Queue.js:56/73`, `TlQueue.js:470`):

- `jobs.ts` — `dqStep_` beats `ok`/`Skipped: …`/`error`; `hbFlush()` in `jobDataTick` `finally`, `refreshQueueNowJob` tail, `jobNightlyAggregates` `finally`; `dqCheckinTick_` beats `queue_snapshot` `ok 'Captured <key>'` / `warn '<reason>'`; `buildQueueAggregates_` beats `daily_report` `ok`/`warn 'Freshchat tab is empty'`/`warn stale`/`error`; `buildInflowAggregates_` beats `daily_report` `error` on Freshchat/Maqsam read failure; `dqMarkRun_` exported.
- `tlqueue.ts` — `jobTlQueueMetrics` wrapped in `hbRun('tl_queue_metrics', …)` + `dqMarkRun_` (verbatim `TlQueue.js:470`).

| HB_PLAN job | Implementation | Beat (verbatim name) | Cadence |
|---|---|---|---|
| `freshdesk_sync` | `jobs.ts` `dqStep_` → `fdSyncIncremental_` (job-data-tick + refresh) | `freshdesk_sync` | ~15 min |
| `queue_aggregates` | `dqStep_` → `buildQueueAggregates_` | `queue_aggregates` | ~15 min |
| `checkin_tick` | `dqStep_` → `dqCheckinTick_` | `checkin_tick` | ~15 min |
| `inflow` | `dqStep_` → `buildInflowAggregates_` (hourly via `dqLastRun`; hourly+weekly+monthly rebuild in nightly) | `inflow` | ~60 min |
| `queue_snapshot` | inside `dqCheckinTick_` capture loop | `queue_snapshot` | 4×/day (+ `agg_snapshots_today` evidence fold in `hbEvidence`:484) |
| `daily_report` | inside `buildQueueAggregates_`/`buildInflowAggregates_` source reads | `daily_report` | per source-read; Freshchat leg GATED on `FRESHCHAT_API_KEY` (warn/error beats now surface it) |
| `tl_queue_metrics` | `tlqueue.ts` `jobTlQueueMetrics` | `tl_queue_metrics` via `hbRun` | daily (Kuwait yesterday) |
| `fc_messages` | — | — | **GATED** — B3/WP-53, no port |

## 5. Residual gaps

| # | Gap | Class | Action |
|---|---|---|---|
| 1 | `tlqBuild_` partial port: legacy rebuilds `tlp_shifts`, `tlp_queue_daily` **plus** `tlp_team`, `tlp_area_metrics`, `kpi_ol_cases` (OL deductions) and reads Freshchat/Freshdesk texting pairs, scorecard, leave/hiring, area SLA. Port writes only `tlp_shifts`+`tlp_queue_daily` from Maqsam calls; `touches`/`pairs` are empty arrays; `text_source` hardcoded `'freshchat'` | **MISS (partial)** | → **WP-F2**; oracle coverage under WP-22 |
| 2 | `importOctober2026Shifts` data: 35/124 legacy shift lines; missing Menna Mekawy 10-13→31, all of Ahmed Essam Ismail Ali, Noha Hassan Foaad Qandil, extra Ahmed Naguib 10-01→08 rows | **DIVERGENCE (data)** | → **WP-F3** (mechanical ~89-line verbatim restore, over the ≤30-line scope) |
| 3 | `fc_messages` job + Freshchat daily-report mirror | **GATED** | WP-53/B3 (`FRESHCHAT_API_KEY`); Maqsam leg live |
| 4 | No golden coverage for scheduler/heatmap-engine internals | gap → existing scope | feeds **WP-22** (already "queue golden coverage extension") |
| 5 | `jobTphHourly` 30-min cadence vs legacy 15-min | out of module | noted for **WP-24** |

## 6. Report

**Shipped this audit:** `specs/megaplan/audits/queue.md`; heartbeat instrumentation fix in `src/features/cx-queue/lib/jobs.ts` (+~45 lines net: `hbBeat`/`hbFlush` import, `dqStep_` beats, `daily_report`/`queue_snapshot` beats, `hbFlush` at job boundaries, `dqMarkRun_` exported) and `tlqueue.ts` (`hbRun` + `dqMarkRun_` wrap on `jobTlQueueMetrics`).

**Gates after fix:** `npx tsc --noEmit` 0 errors · `npx vitest run` 817/817 (41 files) · `npx eslint` on touched files 0 errors 0 warnings.

**New follow-ups:** WP-F2 (tlqueue partial port), WP-F3 (October-2026 import fixture).

**Questions for PM:** (1) WP-53/B3 remains the only gate for `fc_messages`/Freshchat mirror — confirm still no key. (2) WP-F3: the fixture is one-off data; confirm verbatim restore is wanted vs the live `schedulerImport` path. (3) `rebuildTlQueueMetricsEntry`/`installTlQueueTrigger` carry no `requireRole` themselves — safe because only the CRON_SECRET/job-caller route reaches them; flag if either should also self-gate for parity with `TlQueue.js:475/489`.
