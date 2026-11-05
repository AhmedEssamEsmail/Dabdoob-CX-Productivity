# Shard 30 — Queue & Workforce module (`features/cx-queue`)

> Priority 4 (after Quality; FCR skipped). Scope XL. Legacy dir: `Queue_deprecated/` (`CC_APP="queue"`).
> Depends on: 02 extraction, shared platform, hub aggregates (queue snapshots feed `queue`/`checkins`), Freshdesk vendor adapter.

## Pages (registry: group `queue`, tone `work`, default `queue`)

| Route | Title | Roles | Extra gate | Reqs |
|---|---|---|---|---|
| `queue` | Queue health | admin, tl | — | 5 |
| `aging` | Aging cases | admin, tl, agent | not specialist | 11 |
| `checkins` | Check-ins | admin, tl | — | 9 |
| `analytics` | Analytics | admin, tl | — | 15 |
| `heatmap` | Heatmap | admin, tl | — | 4 |
| `scheduler` | TL scheduler | admin, tl | — | 10 |

## Public server API (verbatim)

- `QueuePages.js`: `refreshQueueViaHub`, `getAgingPage`, `getAnalyticsPage`, `getCheckinsPage`, `submitCheckin`
- `QueueCore.js` (shared, port here or keep shared): `getQueueHealthPage`, `dqCheckpoints_`, `dqSlotState_`, aging-band logic, group-name matching
- `AgingHelp.js`: `agingFlagTicket`, `agingResolveFlag`
- `Heatmap.js`: `getHeatmapPage`, `saveHeatmapInput`, `parseHeatmapUpload`, `buildHeatmapFromSource`, `runPriorHeatmapRegression`, `getHeatmapInput`, `saveHeatmapAssumptions`, `setHeatmapCountries`
- `Scheduler.js`: `schedulerPlan`, `schedulerSave`, `schedulerSettings`, `schedulerSaveSettings`, `schedulerSaveTeamDates`, `schedulerOffDays`, `schedulerSaveOffDays`, `schedulerSetOverride`, `schedulerSetHourOverride`, `schedulerRequests`, `schedulerSubmitRequest`, `schedulerRespondToSwap`, `schedulerDecide`, `schedulerImport`, `setupSchedulerTables`, `importOctober2026Shifts`
- `TlQueue.js`: `jobTlQueueMetrics`, `rebuildTlQueueMetrics`, `installTlQueueTrigger`
- `Aggregates.js`/`Queue.js`/`FreshdeskSync.js`/`FreshchatSync.js` (hub-owned files; queue pipeline): `refreshQueueNow`, `jobDataTick`, `jobNightlyAggregates`, checkin tick, snapshot writer

## Tables (`007_queue.sql`)

- Already-known headers: `tickets` (`FD_TICKET_HEADERS`, 12+ cols), `esc_seen`, `aging_open_tickets`, `aging_flags`, `queue_status_submissions`, `queue_snapshots`, `agg_queue_now`, `agg_inflow_{daily,weekly,monthly,hourly}`, `agg_agent_perf`, `agg_agent_daily`, `agg_snapshots_today`, `refresh_log` — share with hub migration; keep single ownership in `005_hub.sql` (queue reads them).
- `SCH_TABLES` (Scheduler.js:35): `sched_config`, `sched_team`, `sched_offdays`, `sched_overrides`, `sched_hour_overrides`, `sched_requests`, `sched_plan` (+ `SCH_INPUT_TABLES` in Stores.js).
- `HM_*` (Heatmap.js:23): `HeatmapInputs`, `HeatmapAssumptionSets`.

## Jobs

| Job | Cadence | Runner |
|---|---|---|
| `freshdesk_sync` | ~15–20 min | pg_cron → internal endpoint (Freshdesk API creds — vendor/http adapter exists) |
| `queue_aggregates` | ~15–20 min | pg_cron |
| `checkin_tick` | ~15–20 min | pg_cron |
| `queue_snapshot` | 4×/day | vercel cron |
| `inflow` | hourly | vercel cron |
| `daily_report` (Freshchat/Maqsam) | 2 h | vercel cron — vendor mirrors in progress (`maqsam` live, `freshchat` blocked on key — see git log) |
| `tl_queue_metrics` | hourly | vercel cron |
| `fc_messages` | daily ~05:00 | vercel cron |
| missed-checkin reminder mails | with tick | mail engine (`checkin_owner_emails` setting) |

## Business rules to port verbatim

- `DQ_SETTINGS` (Stores.js:33): slots 09:30/13:00/18:30/22:00 Kuwait + slot names; read delay 20 min; open-before 15 min, due-after 30 min; `aging_bands_h` 12 edges → `--cx-age-0..6`; excluded groups/text; `queue_map`; our-queue ordering; open vs actionable statuses; `chat_open_max_age_h` 48; stale-after 90 min; `chat_country_map`; escalation channel/statuses; `inflow_lookback_days` 35.
- Check-in state machine (`dqSlotState_`): open/due/missed/submitted; submission stores snapshot key + queues_json.
- Aging flags: TL flags a ticket with note; resolve flow.
- Scheduler: shift defaults (AM 09:30–18:30, PM 13:00–22:00, 9 h), primary/secondary cover splits (queue 7/1/1 vs 3/3/3), `people_source` calendar|reserve, off-days, hour overrides, swap/time-off requests + peer + decide flow, month plan table.
- Heatmap: inputs (interval data, window_json), assumption sets (editable), Erlang-style headcount per interval/shift by country, prior-regression runner, upload parsing.

## Feature map

```
features/cx-queue/lib/{queue,aging,checkins,analytics,heatmap,scheduler,tlqueue,sync}.ts
app/{queue,aging,checkins,analytics,heatmap,scheduler}/page.tsx
app/api/queue/{health,aging,checkins,analytics,heatmap,scheduler,...}/route.ts
```
Replaces today's stubs `/api/queue/{health,aging-flags,checkins}`.
