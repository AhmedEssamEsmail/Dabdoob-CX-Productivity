# Shard 10 — Hub module (`features/cx-hub`)

> Priority 1. Scope XL. Legacy dir: `Command_Center_V2_deprecated/` (`CC_APP="hub"`).
> Depends on: 00 (layout), 01 (shell ctx — done), 02 (extraction).

## Pages (registry: group `hub`, tone `work`, default `overview`)

| Route | Title | Roles | Gate |
|---|---|---|---|
| `overview` | Home | admin, tl, agent | — |
| `admin` | Admin | admin | — |
| `people-holidays` | People & holidays | admin | — |
| `my-day` | My day | admin | owner only (`isOwner`) |
| `ecosystem` | Ecosystem (hidden, URL-only) | admin, tl | not in rail |

## Public server API (verbatim surface to port)

- `Aggregates.js`: `getHomePage`, `getAgentsPage`, `jobDataTick`, `refreshQueueNow`, `jobNightlyAggregates`, `doPost`
- `Assistant.js` (My day): `getMyDay`, `getMyDayPart`, `searchMyMail`, `markFollowUpDone`, `createFocusBlock`, `setAssistantSettings`, `jobWarmMyDay`, `jobAssistantMorningDigest`, `debugMyDay` — **Google-dependent parts → shard 90**
- `RosterSync.js`: `getRosterAdmin`, `setPersonOverrides`, `setPersonV2Fields`, `addHoliday`, `removeHoliday`, `syncRosterNow`, `runRosterSync`, `jobRosterSync`
- `HomeCards.js`: home card data for overview
- `Queue.js`: queue snapshots (`DQ_SNAPSHOT_HEADERS`), `checkinTick` helpers
- `Setup.js`: `setupV2`, `applyExcludedGroups`, `diagnoseAging`, `installDataQueueTriggers`
- `Health.js`: `getEcosystemHealth`, `setupHealth` (heartbeat table, `HB_PLAN` 23 jobs)
- `FreshdeskSync.js`/`FreshchatSync.js`: `runFreshdeskFullSync`, `jobFreshchatMessages`, `backfillFreshchat`, `jobFreshchatBackfill`, `backfillEscalationSightings`
- Shared core already ported in WP-B: `Code.js` (getBootstrap/dropdowns/config), `Apps.js` (setAppUrl — keep read-only under unified app), `Auth`/`ViewAs`/`Popups`/`Options`/`Notify`/`Mailer`/`WorkCalendar`/`PeopleCore`/`QueueCore`/`ProdCore`/`TlSnapshots`/`KpiPayout`/`OneOnOneAlerts`

## Tables (supabase migration `005_hub.sql`)

- `holidays` (exists in 003?), `FollowUpDone` (`AS_FOLLOWUP_HEADERS`), `refresh_log`, `cache_stamps`, `queue_snapshots`, `agg_queue_now`, `agg_inflow_daily/weekly/monthly/hourly`, `agg_agent_perf`, `agg_agent_daily`, `agg_snapshots_today`, `aging_open_tickets`, `tickets`, `esc_seen`, `queue_status_submissions`, `aging_flags`, `Health` — headers all in `Aggregates.js`/`Queue.js`/`QueueCore.js`/`FreshdeskSync.js`/`Assistant.js`/`Health.js`.
- Admin page also needs: roster V2 fields/overrides (RosterSync), mail log view, jobs/health view, dropdown options editor — several exist from WP-B migrations; reconcile first.

## Jobs (HB_PLAN hub/system + shared)

| Job | Cadence | Runner |
|---|---|---|
| `roster_sync` | daily | vercel cron — **HCT sheet read → shard 90** |
| `year_rollover` | nightly | vercel cron |
| `queue_snapshot` | 4×/day | vercel cron |
| `freshdesk_sync` | ~15–20 min | pg_cron — Freshdesk API creds (non-Google; vendor adapter exists) |
| `daily_report`, `inflow`, `queue_aggregates`, `checkin_tick`, `fc_messages` | 15 min–2 h | pg_cron/vercel — ingestion sources flagged per job |
| `jobWarmMyDay`, `jobAssistantMorningDigest` | 15 min / morning | **shard 90** (Gmail/Calendar) |

## Feature map

```
features/cx-hub/lib/{home,admin,people-holidays,myday,ecosystem,roster,aggregates,health}.ts
features/cx-hub/components/{HomeCards,AdminTabs,EcosystemScene,...}
app/{overview,admin,people-holidays,my-day,ecosystem}/page.tsx
app/api/hub/{home,admin,roster,health,ecosystem}/route.ts (+ queue refresh passthrough)
```

## Notes

- **Ecosystem**: the hub bundle embeds a full Three.js scene — desert terrain, day/night cycle, per-system obelisks colored by health state, camels walking link paths between nodes, hover/click tags. Port the component verbatim (extract the scene module; keep Three.js — add as dependency, pinned ≥7 days old).
- **Admin** is the largest single page (roster editor, settings editor w/ typed validation, dropdown choices, email log, scheduled jobs/health, connected apps read-only, appearance).
- `?page=`/`?tab=` links and hub brand already work via shard 01.
- `getAgentsPage` belongs to people group but is served by `Aggregates.js` — port here; consumed by shard 40.
