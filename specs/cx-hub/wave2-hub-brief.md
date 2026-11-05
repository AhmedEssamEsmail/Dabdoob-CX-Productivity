# Wave-2 brief — Hub module (shard 10)

Context for whoever implements Hub. Read `PORTING-GUIDE.md` + `10-hub.md` + this file.

## Already done (committed, `0f0224a`)

- `src/features/cx-people/lib/work-core.ts` — pwRows_/pwRowsAll_/pwTaskContext_/pwTasksOut_/pwNextMeetings_ (WorkCore+PeopleCore read side; per-owner calendar prefetch feeds the pure scorecard math verbatim).
- `src/features/cx-hub/lib/home-cards.ts` — HomeCards.js providers `peopleHomeCards_`/`workHomeCards_`/`planHomeCards_` (+`pwOwnOneOnOneCard_`,`pwTally_`,`pwHoursSince_`), all async.

## getHomePage (`Aggregates.js:568`) — the landing page read; analysis complete

Deps already ported: `requireRole` (identity), `dqBandInfo_`,`dqWithCurrentTl_`,`dqSlotsToday_`,`dqSubmissionsFor_`,`dqOpenAgingFlags_`,`dqBandCounts_`,`dqQueueView_`,`dqSortQueues_`,`dqTodaySnapshots_` (cx-queue/lib), `dqCachedLive`,`dqLastRun` (platform/stores), `normEmail_`,`dqNum_`,`dqHuman_`,`dqDateKey_`,`dqSetting`(settings, async), `ecosystemHealth`/`getEcosystemHealth` (platform/health:530), `pendingPopupsFor` (platform/popups).

Still to write:
- `dqEarliestAt_(subs)` — 4 lines (Aggregates.js:678).
- `getHomePage()` — verbatim from Aggregates.js:568-676; the `perf_` timer is a console.log lap helper (Repo.js:201) — port as trivial no-throw wrapper.
- `getAgentsPage()` — Aggregates.js:535-558 (people `agents` page read; served by hub).
- `refreshQueueNow()` — Aggregates.js:443+ (120 s throttle, script-lock → job-runner lock, calls `fdSyncIncremental_`,`buildQueueAggregates_`,`dqCheckinTick_`,`dqBumpCacheVersion_`,hbFlush). `doPost`/`refreshQueueViaHub` collapses into the same route.
- Jobs (Aggregates.js + Queue.js:39 + FreshdeskSync.js): `jobDataTick` (freshdesk_sync → queue_aggregates → inflow(>55min) → checkin_tick), `jobNightlyAggregates`/`dqNightlySteps_` (productivity rollup if hosted, agent_aggregates, scorecard if hosted, inflow hourly, year_rollover), `buildQueueAggregates_`/`buildInflowAggregates_`/`buildAgentAggregates_`/`dqBuildAging_`/`dqBuildChatQueue_`/`dqCountInflow_`/`dqRollupInflow_`/`dqAgentPerf_`/`dqCheckinTick_`/`dqTickState_`, `fdSyncIncremental_`/`fdSeenEscalations_`/`dqSyncedTo_` (FreshdeskSync.js:312/144/306).
- Store fns missing from `platform/stores.ts`: `dqReadObjects_`,`dqRewrite_`,`dqUpsert_`,`dqReadLean_`,`dqMarkRun_`,`dqBumpCacheVersion_`,`dqOpenStore_`,`dqSheet_` (Stores.js:138-600 — sheet/year-store mechanics; port the Postgres subset faithfully, note year-store semantics `agg_inflow_hourly` per-year → single table with year column or yearly tables — DECIDE and document).
- Oracle tests: `tests/golden/hub-*.test.ts` for dqBuildAging_/dqCountInflow_/dqRollupInflow_/dqAgentPerf_/home cards vs `Aggregates.js`,`HomeCards.js`,`Queue.js`,`QueueCore.js`,`Stores.js`,`FreshdeskSync.js`,`PeopleCore.js`,`WorkCore.js`,`Config.js`,`Repo.js`,`Auth.js`,`Popups.js`,`WorkCalendar.js`,`TlSnapshots.js` fixtures.

## Pages (extract dir `.devin/work/extract/hub/`)

| route | symbol | bytes | notes |
|---|---|---|---|
| overview | Rg | 4.3KB | needs `getHomePage`; sub-widgets: `bg` needs-cards, `_u` oldest-tickets table, `Sg` check-in slots, `Wf` ladder, `Hf` refresh btn (calls refreshQueueNow via `/api`), `mu` admin queue section, `Nf`/`If` cards, `gu()`=ecosystem URL resolver, helpers `Ag`/`Cg`/`Df`/`Yn`/`To`/`Ft` |
| admin | Nm | 1.5KB | tab shell — real content lives in its deps (Dm/Im/Ln/Pf/Tm): roster editor, settings editor, dropdown choices, mail log, jobs/health, connected apps, appearance |
| people-holidays | Ig | 11KB | RosterSync.js API: getRosterAdmin/setPersonV2Fields/setPersonOverrides/addHoliday/removeHoliday/syncRosterNow |
| my-day | Zm | 4.5KB | Assistant.js: getMyDay/getMyDayPart/searchMyMail/markFollowUpDone/createFocusBlock/setAssistantSettings — **Google parts stub behind adapter** (Gmail/Calendar → BLOCKED G3/G4) |
| ecosystem | Zb | 623B | wrapper; scene = Three.js in deps (Jb/Lr/Pr). Port verbatim; `npm i three` (pin ≥7d old) — needs PM/owner approval for dep |

APIs: `src/app/api/hub/{home,agents,queue-refresh,roster,my-day,ecosystem}/route.ts` + cron routes for jobs. Page routes `src/app/{overview,admin,people-holidays,my-day,ecosystem}/page.tsx`. `ecosystem` is admin+tl, hidden (URL-only — the overview links to it via `gu()`/app-url setting; in unified app it lives at `/ecosystem`).

## Tables (`005_hub.sql` reserved)

Live already: tickets, esc_seen, freshchat, maqsam_calls, agg_queue_now, agg_inflow_{daily,weekly,monthly}, health, refresh_log, roster, headcount, days_off, schedule, team_structure, weekly_schedule, view_as, config, prod_*, qa_*, sc_*, kpi_*, md, tlp, tls.
Missing (queue agent may create shared ones in 007 — coordinate): aging_open_tickets, aging_flags, queue_snapshots, queue_status_submissions, agg_inflow_hourly, cache_stamps, follow_up_done (my-day), mail_log?, actions/meetings/one_on_one (people shard owns).

## Watch-outs

- `getHomePage` user object: `requireRole` returns PlatformUser {email,name,role,tlEmail,specialist}; legacy reads `user.specialist`,`user.role`,`user.email`,`user.name`.
- `dqSetting_` → async `dqSetting` (settings.ts) — every read site awaits.
- `dqCachedLive_` → `dqCachedLive` async (stores.ts); missing table → [].
- Home sort: `needs.sort((a,b)=>(b.status==='bad')-(a.status==='bad')||(b.waitedH||0)-(a.waitedH||0))` — JS boolean subtraction, keep verbatim.
- `hbEcosystemHealth_` → `ecosystemHealth()` already ported (never throws).
- Check-in slots 09:30/13:00/18:30/22:00 Kuwait; aging edges setting `aging_bands_h`.
- `pendingPopupsFor` returns {kind,title,link,createdAt} — HomeCards escalations filter `kind==='escalation_1on1'`.
