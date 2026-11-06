# WP-24 — jobs/heartbeat/scheduling audit

Audit of every legacy Google Apps Script `job*` / installable trigger against its CX-Hub port:
implementation, route, heartbeat instrumentation (`hbBeat`/`hbRun`/`dqStep_`), legacy cadence
(`Install*.js`/`Triggers.js`/`Setup.js`), current schedule (`vercel.json`, `supabase/migrations/`),
and the D-SCHED target. Deliverables: this matrix + `supabase/migrations/012_pg_cron_schedule.sql`
(**DRAFT — blocked on B5**, not applied).

Sources: `00-gap-review.md` §8 (HB_PLAN), module audits (`queue.md`, `productivity.md`, `hub.md`,
`desk.md`, `people.md`, `quality.md`, `platform.md`, `api-surface.md`), `BLOCKED_TASKS.md` B5,
`vercel.json`, migrations `001–011`, legacy `*_deprecated` trigger installers, `health.ts`,
`jobs/steps.ts`, `stores.ts`, `identity.ts`, all `src/app/api/**/route.ts` cron surfaces.

Timezone note: all legacy `atHour/nearMinute` installers pin `business_tz`/`TRIGGER_TZ` =
**Asia/Kuwait** (UTC+3, no DST — `settings.ts:42`, `PeopleTriggers.js:9`, `Assistant.js:19`;
Productivity uses `inTimezone(tz)` with `business_tz`, Quality likewise). pg_cron expressions are
in the DB timezone (UTC on Supabase): Kuwait time − 3 h. `data_tz`/`Africa/Cairo` only affects
daily-report parsing, not trigger times.

---

## 1. Job matrix — HB_PLAN rows (23)

| # | heartbeat key | legacy handler / installer | legacy cadence | ported impl | route | HB instrumentation | current schedule | status / gap |
|---|---|---|---|---|---|---|---|---|
| 1 | `freshdesk_sync` | `jobDataTick` step — `Setup.js:185` | every 15 min | `cx-queue/lib/jobs.ts:343` → `fdSyncIncremental_` (freshdesk.ts) | `GET/POST /api/cron/job-data-tick`, `POST /api/queue/refresh` | `dqStep_('freshdesk_sync')` jobs.ts:48 | **none** | ported; awaits pg_cron `*/15` (012 draft) |
| 2 | `queue_aggregates` | `jobDataTick` step — `Setup.js:185` | every 15 min | `jobs.ts:350` → `buildQueueAggregates_` | same as above | `dqStep_('queue_aggregates')` | none | ported; pg_cron `*/15` |
| 3 | `inflow` | `jobDataTick` hourly step + `jobNightlyAggregates` step (`Setup.js:185–186`) | hourly inside 15-min tick (55-min `dqLastRun_` gate, verbatim) + nightly rebuild | `jobs.ts:353` (tick), `jobs.ts:381` (nightly) → `buildInflowAggregates_` | `/api/cron/job-data-tick`, `/api/cron/job-nightly-aggregates` | `dqStep_('inflow')` ×2 | none | ported; folded (verbatim); pg_cron `*/15` + `30 6` |
| 4 | `checkin_tick` | `jobDataTick` step — `Setup.js:185` | every 15 min | `jobs.ts:355` → `dqCheckinTick_` (`index.ts`) | `/api/cron/job-data-tick`, `POST /api/queue/refresh` | `dqStep_('checkin_tick')` | none | ported; pg_cron `*/15` |
| 5 | `queue_snapshot` | inside `jobDataTick`'s check-in capture (no separate trigger — legacy comment: "sturdier than four fixed triggers", `PeopleTriggers.js:12`) | 4×/day at `checkin_slots` 09:30/13:00/18:30/22:00 business_tz + `checkin_read_delay_min` | `dqCheckinTick_` capture loop — `jobs.ts:291–334` | via `job-data-tick` | `hbBeat('queue_snapshot', ok|warn)` jobs.ts:311,327 | none | **folded, verbatim** — RESOLVED §6 open item; pg_cron covers it |
| 6 | `daily_report` | read inside `jobDataTick` (Freshchat daily-report tab + Maqsam sheet) | refreshed every 15-min tick (warns stale) | `buildQueueAggregates_`/`buildInflowAggregates_` source reads — `jobs.ts:107–111` (freshchat mirror), `jobs.ts:145,154` (maqsam mirror) | via `job-data-tick` (+ optional `/api/integrations/*` refresh) | `hbBeat('daily_report')` per-source ok/warn/error | none | **folded, verbatim**; Freshchat source GATED B3 (beats warn, never lies) |
| 7 | `agent_aggregates` | `jobNightlyAggregates` step — `Setup.js:186` | daily ~09:30 KW | `jobs.ts:380` → `buildAgentAggregates_` | `/api/cron/job-nightly-aggregates` | `dqStep_('agent_aggregates')` | none | ported; pg_cron `30 6 * * *` UTC |
| 8 | `year_rollover` | `jobNightlyAggregates` step — `Setup.js:186` | daily ~09:30 KW (no-ops when year unchanged) | `jobs.ts:382` → `dqYearRollover_` | same | `dqStep_('year_rollover')` | none | ported; pg_cron `30 6` |
| 9 | `roster_sync` | `jobRosterSync` — `Setup.js:188` | daily ~07:00 KW | `cx-hub/lib/roster.ts:373` (hbBeat + dqLogRun_ + hbFlush_ verbatim) | **none** (admin `POST /api/hub/roster` action=syncRoster exists) | `hbBeat('roster_sync')` + `hbFlush_` | none | **GATED G1 + unrouted — WP-F15**; omitted from 012 draft |
| 10 | `prod_snapshot` | `jobProductivityDaily` — `ProductivityApp.js:615` | daily ~08:30 business_tz | `cx-productivity/jobs/productivity.ts:330` → `prodSnapshotStep_` | `GET/POST /api/cron/job-productivity-daily` | `dqStep_(env,'prod_snapshot')` (steps.ts) | vercel `30 6 * * *` | **deviation:** 06:30 UTC = 09:30 KW vs legacy 08:30 KW (+1 h); see §4-D |
| 11 | `prod_flags` | `jobProductivityDaily` step | daily (in chain) | `productivity.ts:341` → `prodFlagsStep_` | chain + **`/api/cron/flag-detection`** (additive) | `dqStep_(env,'prod_flags')` | vercel `30 6` ×2 (chain + standalone, same minute) | ported; **surplus standalone cron** — additive re-run of yesterday's flags concurrent with the chain; idempotent upserts, but redundant (§4-E) |
| 12 | `productivity` | `jobProductivityDaily` step | daily (in chain) | `productivity.ts:343` → `prodLayersStep_` | chain + **`/api/cron/daily-layers`** (additive) | `dqStep_(env,'productivity')` | vercel `30 6` + `45 6` standalone | ported; **surplus standalone cron** (§4-E) |
| 13 | `scorecard` | `jobScorecardNightly` — `PeopleTriggers.js:65` | daily ~09:30 KW | `cx-people/lib/scorecard-server.ts:508` (`jobScorecardNightly`) | `/api/cron/scorecard-nightly` | `dqStep_(env,'scorecard')` | none | ported; Sheets-source half GATED G2 → honest `Skipped:` beats; pg_cron `30 6` |
| 14 | `missed_1on1_check` | `jobMissedOneOnOneCheck` — `PeopleTriggers.js:17` (`hour:22,minute:30`, after `one_on_one_cutoff` 22:00) | daily ~22:30 KW | `reminders.ts:329` (`jobMissedOneOnOneCheck`) | `/api/cron/missed-1on1-check` | `dqStep_(env,'missed_1on1_check')` | none | ported; pg_cron `30 19 * * *` UTC |
| 15 | `oo_reminders` | `jobOneOnOneReminders` — `OneOnOneReminders.js:113` | **every 1 min** (internal `pwOoNextEmailMs_`/`OO_REM_NEXT_PROP` self-gate) | `one-on-one-reminders.ts:84,142` | `/api/cron/oo-reminders` | `dqStep_(env,'oo_reminders')` | none | ported; **D-SCHED floor → `*/15`** (internal next-due gate preserved, `OO_REM_NEXT_CONFIG`) |
| 16 | `task_reminders` | `jobTaskReminders` — `PeopleTriggers.js:19` | daily ~10:00 KW | `reminders.ts:334` | `/api/cron/task-reminders` | `dqStep_(env,'task_reminders')` | none | ported; pg_cron `0 7 * * *` UTC |
| 17 | `meeting_reminders` | `jobMeetingActionReminders` — `PeopleTriggers.js:21` | daily ~10:30 KW | `reminders.ts:339` | `/api/cron/meeting-reminders` | `dqStep_(env,'meeting_reminders')` | none | ported; pg_cron `30 7 * * *` UTC |
| 18 | `fc_messages` | `jobFreshchatMessages` — `FreshchatSync.js:175` | daily ~05:00 project tz (Cairo) | **NOT PORTED** — gated B3 (`FRESHCHAT_*` creds, API design WP-53/WP-F16) | none | none | none | **GATED** — heartbeat row stays default/down-honest; not in 012 draft |
| 19 | `tl_queue_metrics` | `jobTlQueueMetrics` — `TlQueue.js:495` | **every hour** | `cx-queue/lib/tlqueue.ts:164` (`jobTlQueueMetrics`) | `GET/POST /api/cron/job-tl-queue` (+ `?dates=` rebuild) | `hbRun('tl_queue_metrics', …)` + `dqMarkRun_` | none | ported; pg_cron `15 * * * *` (hourly keeps HB `every:60` green). Gap: port rebuilds `[yesterday]` only vs legacy `[yesterday, today]` — flagged to WP-F2 |
| 20 | `mail_desk` | `jobMailDesk` — `TlPerformance.js:408` | every 10 min | `cx-desk/lib/maildesk.ts:482` (`jobMailDesk`) | `POST /api/desk/job/mail` | `hbRun('mail_desk', …)` + `dqMarkRun_` | none | ported; **D-SCHED floor → `*/15`** (HB_PLAN `every:10` label retained as legacy documentation — desk.md §188). Bearer gate landed WP-F18 (route.ts:6-10,15) — schedule-ready once B5 env exists |
| 21 | `qa_queue_import` | `jobQualityDaily` — `Quality.js:3618` | daily ~10:30 tz | `cx-quality/lib/server.ts:2106` → `qaQueueStep_` | `GET/POST /api/cron/job-qa-engine` | `qaDqStep_('qa_queue_import')` | none | ported; pg_cron `30 7 * * *` UTC |
| 22 | `qa_ctl_reminders` | `jobQualityDaily` step | daily ~10:30 | `server.ts:2123` → `qaCtlStep_` | same route | `hbRun('qa_ctl_reminders', …)` (server.ts) | none | ported; pg_cron `30 7` (consolidated route) |
| 23 | `qa_history_import` | `jobQualityHistory` — `Quality.js:3619` | daily ~11:30 tz | `server.ts:2266` → `qaHistoryStep_` | same route | `qaDqStep_('qa_history_import')` | none | ported; **deviation: runs ~1 h early** — consolidated into the 10:30-KW run since one route runs all three steps (WP-11 explicitly deferred this scheduling call to WP-24; documented §4-F) |

### 1b. Verbatim step-beats **not** in HB_PLAN (append default-window rows — same as legacy Health.js)

| beat | where | schedule parent |
|---|---|---|
| `prod_flag_analytics`, `prod_tph_touches`, `prod_tph_calls`, `prod_tph_cases_rebuilt` | daily chain steps — `productivity.ts:345–349` | vercel `30 6` via `job-productivity-daily` |
| `mirror_sync` (additive step — legacy read sheets; port refreshes mirrors first) | `productivity.ts` head of `prodDailySteps_` | vercel `30 6` |
| `prod_tph_cases` | `jobTphHourly` — `jobs/tph.ts:20` | vercel `:05`/`:55` (see §4-A) |
| `prod_tph_auto` | `jobTphPastDays` — `jobs/tph.ts:37` | vercel `0 5` (see §4-B) |

### 1c. Legacy triggers/jobs **not ported** or one-off self-reschedulers

| legacy fn | installer evidence | cadence | port status |
|---|---|---|---|
| `jobFreshchatBackfill` | `FreshchatSync.js:159` | `after(60000)` self-rescheduling until done | **not ported** — B3-gated, WP-F16 |
| `backfillFreshchat` | admin editor entry | manual | not ported — WP-F16 |
| `jobQualityBuildRetry` | `Quality.js:3347` | `after(QE_BUILD_RETRY_HOURS×3600s)` ~3 h, max 3 retries | **not ported** — WP-F11 (no retry seam yet) |
| `runFreshdeskFullSync` | `FreshdeskSync.js:293` | `after(60000)` self-rescheduler | ported-lib `freshdesk.ts:322`; no cron route — admin/manual only (job-runner), parity: legacy trigger was also hand-launched |
| `backfillEscalationSightings` | `FreshdeskSync.js` one-off | manual | not ported — WP-F17 |
| `jobWarmMyDay` | `Assistant.js:614` | every 10 min; internal 06:00–22:00 KW skip | ported `cx-hub/lib/myday.ts:713` — **no route + G3** → WP-F15; see §5-3 caller-gate note |
| `jobAssistantMorningDigest` | `Assistant.js:707` | daily ~07:30 `AS_TZ` (KW), gated by `assistant_digest_installed` | ported `myday.ts:817` — **no route + G3** → WP-F15 |
| `importQaQueueNow` | admin hand-run | manual | parity — `POST /api/admin/job-runner` step; beats `qa_queue_import` |
| `importProductivityEmail` | admin step | manual | ported as chain step `prod_snapshot` sub-step (G4 email-gated) |
| `backfillProductivityIntervals`, `redetectProductivityFlags` | admin hand-run | manual | `/api/admin/backfill` actions |
| `syncRosterNow` | admin editor entry | manual | `POST /api/hub/roster` action=syncRoster |

### 1d. Trigger-management functions — N/A by design

`installAllTriggers`, `installDataQueueTriggers`, `installFreshchatTrigger`, `removeTriggers_*`,
`installMyDayWarmTrigger`/`removeMyDayWarmTrigger`, `installAssistantDigestTrigger`,
`installQualityTriggers`, `installTlQueueTrigger` (parity probe: `tlqueue.ts:191`),
`installTriggers`/`installPeopleTriggers`, `installOneOnOneReminderTrigger`,
`installDeskTriggers` (parity note: `tlperformance.ts:639`), `installProductivityTriggers`,
`notBuilt_` — all superseded by `vercel.json` + pg_cron; the digest installer survives as the
`assistant_digest_installed` config flag (`myday.ts:779`). No port needed.

### 1e. Non-trigger cron-callable surface (not in legacy `job*` set)

| endpoint | auth | notes |
|---|---|---|
| `POST /api/integrations/maqsam`, `POST /api/integrations/freshchat` | `cronOk` (Bearer) | optional mirror refresh; mirrors already refreshed daily by `job-productivity-daily`'s `mirror_sync` step. Unscheduled by design — commented examples in 012 draft |
| `POST /api/queue/refresh` | `cronOk` | manual re-tick of `freshdesk_sync`+`queue_aggregates`+`checkin_tick` |
| `POST /api/admin/job-runner`, `/api/admin/backfill` | admin | manual step runner/backfills (verbatim admin fns) |
| `flag-detection`, `daily-layers`, `analytics-aggregation` standalone routes | `cronOk` | surplus schedules in vercel.json — §4-E |

---

## 2. Heartbeat semantics checklist — ported vs `Health.js`/`Stores.js`/`Auth.js`

| # | semantic | port location | verdict |
|---|---|---|---|
| 1 | `hbBeat(job,status,note)` — normalize via hbStatus (`ok`/`error`/`failed`/`down`→`error`, else→`warn`); worst-status-wins merge within a request; notes joined `; ` de-duped; never throws | `health.ts:114` | VERBATIM (Health.js:94) |
| 2 | `hbRun(job,fn,noteOf)` — `ok` beat with `note` or `'Skipped: <skipped>'`; `error` beat + rethrow; `hbFlush_` in `finally` | `health.ts:146` | VERBATIM (:111) |
| 3 | `dqStep_(job,fn)` — run → `flushWrites` (env variant) → `hbBeat` ok/`Skipped:` → return r; catch → `dqLogRun_('error')` + `hbBeat` error → **return null, chain continues** | `jobs/steps.ts:8`; queue-local clone `cx-queue/lib/jobs.ts:48` | VERBATIM (Stores.js:600) |
| 4 | `hbFlush` — `HB_MIN_GAP_MIN=10` unchanged-status throttle keyed `hb_last_<job>` = `status|ms` (script cache → in-memory Map stand-in); update-in-place for existing rows; append `hbRowFromPlan` (system/link/label rewrites; `expect_every_min`/`grace_min` never overwritten — owner-editable windows); invalidate `eco_health_v2` cache; swallow all errors | `health.ts:206` | VERBATIM (:159). **WP-17 fix:** appended rows now carry beat fields (legacy wrote the fully materialized row; first port dropped beats on append) — queue.md/quality.md confirmed queue+quality rows now written |
| 5 | `dqMarkRun_` — stamps last-run for `dqLastRun_`/evidence readers | queue: `cachePut('dq_last_run_'+job)` jobs.ts:63; desk: `setConfig('dq_last_'+job)` `jobshared.ts:10` | PORTED-AS (two stores — documented in platform.md; `dqLastRun` reads both: `stores.ts:97` fix reads queue cache stamp after `DQ_LAST_*` config — WP-17 fix) |
| 6 | `dqLastRun_(job)` — `DQ_LAST_<job>` config (case-insensitive) → `dq_last_run_<job>` cache → `health.last_ok_at`; 60 s cache | `stores.ts:97` | VERBATIM (Stores.js:576–584) — incl. jobs.ts:357 55-min inflow gate use |
| 7 | `dqLogRun_(job,ms,status,fields)` — append `refresh_log` | `stores.ts` | VERBATIM |
| 8 | `requireJobCaller_` — no session → allow (cron); else `assertWritable` (View-as writes rejected) + admin | `identity.ts:139` | VERBATIM (Auth.js:98) |
| 9 | `viewAsSystem_(e)` — GAS trigger event object → N/A; Next "no session = system run" covers it | — | N/A documented |
| 10 | `hbEvidence` fallbacks — `DQ_LAST_*` config, `refresh_log`, `agg_snapshots_today`, queue aggregate evidence; `checkin_tick` inherits `queue_aggregates` evidence | `health.ts` (`hbEvidence_`) | VERBATIM |
| 11 | Route auth — `Bearer CRON_SECRET` + `requireJobCaller` | 15 `/api/cron/*` + 2 `/api/integrations/*` + `POST /api/desk/job/mail` | ALL GATED — desk route was the last gap; **WP-F18 landed** (dd8dff2d): `cronOk` verbatim from `job-tl-queue/route.ts` now precedes `requireJobCaller` (`api/desk/job/mail/route.ts:6-10,15`), 401 on wrong Bearer, dev/no-secret still falls through |
| 12 | `skipped` → healthy `ok` beat with `'Skipped: <reason>'` note — honest gating surface (G1/G2/G3/G4 produce skipped/warn, never silent success) | `health.ts:152`, all step sites | VERBATIM |
| 13 | Heartbeat failures never break a job (try/catch at every layer; `dqMarkRun_` guarded `jobshared.ts:13`) | — | VERBATIM |
| 14 | **Regression check:** queue `jobDataTick`/`jobNightlyAggregates` steps beat per-step (WP-05 fix restored missing rows); quality route beats `qa_queue_import`/`qa_ctl_reminders`/`qa_history_import` (WP-11 fix); desk `jobMailDesk` wrapped in `hbRun('mail_desk')` (WP-19 fix) | jobs.ts:339+, server.ts:2106+, maildesk.ts:484 | CONFIRMED |
| 15 | Caller gate nuance — ported `jobWarmMyDay`/`jobAssistantMorningDigest` (`myday.ts:713,817`) dropped `requireAssistantJobCaller_` (owner-or-cron); safe today since **no route reaches them**, but WP-F15 must add the gate when routing | myday.ts | FINDING → WP-F15 |
| 16 | `jobQuarterlyReport` — `env.logRun('quarterly_report')` + flushWrites on success, rethrow on failure; no HB beat (legacy: `dqLogRun_` only, no `hbBeat` — verified ProductivityApp.js) | `jobs/quarterly.ts:134` | VERBATIM (log-only; refresh_log evidence feed) |

---

## 3. Schedule inventory — current state

**vercel.json (PM-owned, NOT modified):**

| route | cron | maps to | issue |
|---|---|---|---|
| `/api/cron/job-productivity-daily` | `30 6 * * *` | prod_daily chain (beats #10–12 + 1b steps) | +1 h vs legacy 08:30 KW (§4-D) |
| `/api/cron/flag-detection` | `30 6 * * *` | `prod_flags` re-run | surplus (§4-E) |
| `/api/cron/daily-layers` | `45 6 * * *` | `productivity` layers re-run | surplus (§4-E) |
| `/api/cron/analytics-aggregation` | `0 7 * * *` | `prod_flag_analytics` re-run | surplus (§4-E) |
| `/api/cron/job-tph-hourly` | `5 * * * *` + `55 * * * *` (48 lines = 2×/h uneven: 50 min then 10 min gaps) | `prod_tph_cases` | **§4-A: legacy 15-min** |
| `/api/cron/job-tph-past-days` | `0 5 * * *` | `prod_tph_auto` | **§4-B: legacy hourly** |
| `/api/cron/job-quarterly-report` | `0 6 1 * *` | `quarterly_report` | parity (day-1 06:00 UTC ≈ legacy `onMonthDay(1)`) |

**Migrations:** `007_queue.sql` carries schedule *comments* only; `011_remote_reconcile.sql`
enables `pg_cron`+`pg_net` but installs **no** `cron.schedule` calls. **Zero jobs are scheduled
outside vercel.json** — every ported job not in the table above is currently unscheduled
(`job-data-tick`, `job-nightly-aggregates`, `job-qa-engine`, `job-tl-queue`, all five people
routes, `mail_desk`).

---

## 4. Cadence divergences & findings

- **A. `jobTphHourly` 30-vs-15-min:** legacy `everyMinutes(15)` (`ProductivityApp.js:616`); vercel.json approximates with `5`+`55` entries (uneven 50/10-min gaps, 2×/h) because Vercel cron can't express sub-hourly. D-SCHED: sub-hourly → pg_cron. **Fix:** 012 draft line `*/15 * * * *` (commented until PM removes the vercel entries — double-fire risk).
- **B. `jobTphPastDays` daily-vs-hourly:** legacy `everyHours(1)` (`:617`); vercel `0 5 * * *` (24× less frequent). Hourly rebuilds of past days exist to catch late-arriving TPH emails — daily defeats the purpose. **Fix:** PM changes vercel to `0 * * * *` (≥1 h jobs are Vercel-appropriate per D-SCHED), or enable the commented pg_cron `7 * * * *` line.
- **C. `job-tl-queue` naming:** implemented route is `/api/cron/job-tl-queue`; `BLOCKED_TASKS.md` B5 text says `job-tl-queue-metrics` — stale doc name; 012 draft uses the real route. Also: ported impl rebuilds `[yesterday]` only (legacy `[yesterday, today]`) — intraday-today metrics gap flagged to WP-F2; hourly schedule chosen over B5's daily sketch to keep `every:60` HB window green.
- **D. Productivity chain +1 h:** legacy ~08:30 `business_tz` (Kuwait) = 05:30 UTC; vercel `30 6` = 09:30 KW (the WP-A doc mapped 08:30 *Cairo* → 06:30 UTC). Later run is benign for email-arrival races but shifts all downstream beats; PM call (vercel-owned).
- **E. Three surplus step crons:** `flag-detection` (same minute as the chain — concurrent re-run), `daily-layers`, `analytics-aggregation` re-execute steps the chain already runs; idempotent upserts make them harmless but they produce extra beats/refresh_log noise and weren't in legacy. Recommend PM keeps (cheap ops retry handles) or removes — documented, not changed.
- **F. Quality consolidation:** legacy ran `jobQualityDaily` 10:30 and `jobQualityHistory` 11:30 as separate triggers; the ported `job-qa-engine` route runs all three steps in one call (WP-11 design, scheduling deferred to this WP). 012 draft schedules once at `30 7` (10:30 KW) — history import runs ~1 h early vs legacy; acceptable since steps are independent and idempotent.
- **G. `mail_desk` every:10 label:** HB_PLAN retains `every:10`/`grace:20` (legacy documentation); D-SCHED floors to 15. pg_cron `*/15` will mark the row `warn` (late) between 10–15 min gaps under the current window — owners may bump `expect_every_min` to 15 via the editable health row (commented `UPDATE` in 012 draft); label rows intentionally left legacy-verbatim per §8.
- **H. `oo_reminders` 1-min → 15:** legacy self-gated via `OO_REM_NEXT_PROP` ("not due" fast-exit); port preserves `OO_REM_NEXT_CONFIG` gate + `pwOoNextEmailMs_` next-due computation (`one-on-one-reminders.ts:87,128`), so `*/15` can't miss an email window (gate pushes next due ≥ now+15 min only when nothing sooner is pending — parity check in people.md confirmed).

## 5. Unrouted/gated ported jobs (no schedule possible yet)

1. `roster_sync` (roster.ts:373) — G1 roster source + no cron route → **WP-F15**. Target when routed: `0 4 * * *` (07:00 KW).
2. `jobAssistantMorningDigest` (myday.ts:817) — G3 + no route + `assistant_digest_installed` flag → **WP-F15**. Target `30 4` (07:30 KW). Must re-add caller gate (§2-15).
3. `jobWarmMyDay` (myday.ts:713) — G3 + no route → **WP-F15**. Target `*/15 3-19 * * *` (10-min legacy floored to 15; 06:00–22:00 KW = 03–19 UTC; internal hour-skip preserved).
4. `fc_messages` — B3/WP-53+WP-F16; no impl.
5. `jobQualityBuildRetry` (+3 h one-off, max 3) — WP-F11; needs an error→schedule seam that doesn't exist (pg_cron can't self-arm from a route failure without app code; design belongs to WP-F11).
6. `runFreshdeskFullSync` — ported-lib only; legacy was also hand-launched → parity, stays admin/job-runner.

## 6. Mail/notify policy verification (per WP-24 open item — `Mailer.js`/`Notify.js`)

Re-checked `platform.md` + code — all VERBATIM, no action needed:
- `mail_dry_run` defaults **true** (`settings.ts`); no SMTP adapter configured → all sends are dry-run/log-only (`sendMail` returns logged status).
- `mailAllowed`: `qa_*` mail kinds always allowed; non-`qa_*` requires **every** recipient ∈ `admin_emails` — matches legacy `Mailer.js` qa-only blast gate.
- `notify`/`notifyHtml` — legacy popup+email fallback, escaped HTML & fact-table builder preserved.
- `mail_approval_dry_run` default true (desk approvals) — desk.md.

## 7. `012_pg_cron_schedule.sql` summary

**DRAFT-BLOCKED-B5** — placeholders `{{APP_URL}}`/`{{CRON_SECRET}}`, not applied. Active lines (idempotent `cron.unschedule` guard + `cron.schedule` + `net.http_get/post` with `Authorization: Bearer` header):

`*/15`: `job-data-tick`, `oo-reminders`, `mail-desk` (POST). `30 6`: `job-nightly-aggregates`, `scorecard-nightly`. `30 7`: `job-qa-engine`, `meeting-reminders`. `0 7`: `task-reminders`. `30 19`: `missed-1on1-check`. `15 * * * *`: `job-tl-queue`.
Commented/blocked lines: `job-tph-hourly` `*/15` (needs vercel de-dup), `job-tph-past-days` hourly (vercel alternative), `roster-sync`/`assistant-digest`/`warm-my-day`/`fc-messages` (routes missing — WP-F15/B3), optional `/api/integrations/*` refreshers, optional `expect_every_min` fix for `mail_desk`.

---

## 8. What shipped / stubbed / gates / questions

**Shipped:** this audit; `012_pg_cron_schedule.sql` draft; full 23-row × 7-column matrix; all legacy installer cadences pinned to file:line.
**Stubbed/blocked:** every pg_cron line (B5: `CRON_SECRET` + canonical URL); 3 unrouted ported jobs (WP-F15); `fc_messages` (B3); `jobQualityBuildRetry` (WP-F11); vercel.json divergences (PM-owned — §4 A/B/D/E). `mail_desk` Bearer check no longer blocks (WP-F18 done).
**Gates:** heartbeat semantics 16/16 verified; no job writes beats under wrong keys; skipped→ok honest gating everywhere.
**Questions for orchestrator:** (1) confirm `30 6` vs `30 5` UTC for the productivity chain (Kuwait-vs-Cairo mapping, §4-D); (2) keep or retire the 3 surplus step crons (§4-E); (3) hourly `job-tl-queue` rebuilds `[yesterday]` — accept WP-F2 gap or add today back; (4) approve `*/15` mail_desk + health-window bump to 15 (§4-G); (5) apply 012 only after B5 lands (WP-F18 already merged — desk route is Bearer-gated).
