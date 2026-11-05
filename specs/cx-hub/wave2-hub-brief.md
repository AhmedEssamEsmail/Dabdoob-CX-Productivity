# Wave-2 brief — Hub module (shard 10)

Context for whoever implements Hub. Read `PORTING-GUIDE.md` + `10-hub.md` + this file.

## Already done (committed, `0f0224a` + agent waves — DO NOT re-port)

- `src/features/cx-people/lib/work-core.ts` — pwRows_/pwRowsAll_/pwTaskContext_/pwTasksOut_/pwNextMeetings_.
- `src/features/cx-hub/lib/home-cards.ts` — HomeCards.js providers (people/work/plan + pwOwnOneOnOneCard_/pwTally_/pwHoursSince_).
- `src/features/cx-queue/lib/jobs.ts` — **jobDataTick, jobNightlyAggregates, dqCheckinTick_, dqRemindMissedCheckins_, buildQueueAggregates_/buildInflowAggregates_/buildAgentAggregates_, refreshQueueNowJob** — reuse; Hub only needs routes that call them if missing (`/api/queue/refresh` already exists).
- `src/features/cx-queue/lib/index.ts` + `pages.ts` — dq* helpers + page builders incl. `dqOpenAgingFlags_`, `dqSubmissionsFor_`, `dqBandCounts_`, `dqQueueView_`, `dqSortQueues_`, `dqTodaySnapshots_`.
- `src/features/cx-people/lib/agents-page.ts` — **getAgentsPage already ported** (agents page lives under people group).
- `src/features/shared/jobs/freshdesk.ts` — fdSyncIncremental_ etc.
- `src/app/api/cron/{job-data-tick,job-nightly-aggregates,job-tl-queue}` — exist.

## getHomePage (`Aggregates.js:568`) — the landing page read; analysis complete

Deps already ported: `requireRole` (identity), `dqBandInfo_`,`dqWithCurrentTl_`,`dqSlotsToday_`,`dqSubmissionsFor_`,`dqOpenAgingFlags_`,`dqBandCounts_`,`dqQueueView_`,`dqSortQueues_`,`dqTodaySnapshots_` (cx-queue/lib), `dqCachedLive`,`dqLastRun` (platform/stores), `normEmail_`,`dqNum_`,`dqHuman_`,`dqDateKey_`,`dqSetting`(settings, async), `ecosystemHealth`/`getEcosystemHealth` (platform/health:530), `pendingPopupsFor` (platform/popups).

Still to write:
- `dqEarliestAt_(subs)` — 4 lines (Aggregates.js:678).
- `getHomePage()` — verbatim from Aggregates.js:568-676 in `src/features/cx-hub/lib/aggregates.ts`; `perf_` = trivial no-throw lap timer. Wires dq* helpers + `homeCards` (already in `cx-hub/lib/home-cards.ts`) + `ecosystemHealth` + `pendingPopupsFor`.
- `refreshQueueNow()` — thin: route → `refreshQueueNowJob` in cx-queue/lib/jobs.ts if the route doesn't exist (`/api/queue/refresh` — check first).
- Admin page server fns from `Admin.js`/`RosterSync.js` in Command_Center dir (roster editor, settings editor, dropdown choices, mail log, jobs/health viewer, connected apps, appearance) — survey the actual files and port the read/write surface.
- `people-holidays` fns — RosterSync.js API: getRosterAdmin/setPersonV2Fields/setPersonOverrides/addHoliday/removeHoliday/syncRosterNow.
- `my-day` — Assistant.js: getMyDay/getMyDayPart/searchMyMail/markFollowUpDone/createFocusBlock/setAssistantSettings; Gmail/Calendar calls go behind a `myday-google.ts` adapter returning `notConfigured` until creds (list for BLOCKED_TASKS).
- `ecosystem` — Three.js scene (closure deps Jb/Lr/Pr) + `ecosystemHealth()` data already ported. Check package.json for `three` — if absent, pin a version ≥7 days old and note the add in the report (PM approves dep adds).
- Store fns missing from `platform/stores.ts` IF getHomePage/admin needs them: `dqReadObjects_`,`dqRewrite_`,`dqUpsert_`,`dqReadLean_`,`dqMarkRun_`,`dqBumpCacheVersion_` (Stores.js:138-600 — ADDITIVE to stores.ts only; year-store semantics already decided: `year` column — follow queue's `queue_snapshots`/`agg_inflow_hourly` precedent).
- Pages: 5 route files + `cx-hub/components/` — VERBATIM from closures (`Rg`,`Nm`,`Ig`,`Zm`,`Zb`) per the guide's HARD RULE; hub classes in `legacy-apps.css` under `[data-app="hub"]` (incl `--qg-*` tokens + `.md-*` my-day + ecosystem styles).
- APIs `src/app/api/hub/{home,admin,roster,my-day,ecosystem}/route.ts` (+ `api/hub/[action]` dispatcher if cleaner — match what each page calls).
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

007/008/009/010 already created: dq_aging_flags, queue_submissions, queue_snapshots, agg_inflow_hourly, cache_stamps?, actions/meetings/one_on_one (people), tracker + mail tables. Live already: tickets, esc_seen, freshchat, maqsam_calls, agg_queue_now, agg_inflow_{daily,weekly,monthly}, health, refresh_log, roster, headcount, days_off, schedule, team_structure, weekly_schedule, view_as, config, prod_*, qa_*, sc_*, kpi_*, md, tlp, tls.
STILL MISSING (yours to add in 005_hub.sql): `options` (platform options.ts — dropdown choices, FLAGGED by desk agent), `follow_up_done` (my-day), mail_log if used, cache_stamps if not already in 007 — CHECK the other migration files first to avoid dupes.

## Watch-outs

- `getHomePage` user object: `requireRole` returns PlatformUser {email,name,role,tlEmail,specialist}; legacy reads `user.specialist`,`user.role`,`user.email`,`user.name`.
- `dqSetting_` → async `dqSetting` (settings.ts) — every read site awaits.
- `dqCachedLive_` → `dqCachedLive` async (stores.ts); missing table → [].
- Home sort: `needs.sort((a,b)=>(b.status==='bad')-(a.status==='bad')||(b.waitedH||0)-(a.waitedH||0))` — JS boolean subtraction, keep verbatim.
- `hbEcosystemHealth_` → `ecosystemHealth()` already ported (never throws).
- Check-in slots 09:30/13:00/18:30/22:00 Kuwait; aging edges setting `aging_bands_h`.
- `pendingPopupsFor` returns {kind,title,link,createdAt} — HomeCards escalations filter `kind==='escalation_1on1'`.
