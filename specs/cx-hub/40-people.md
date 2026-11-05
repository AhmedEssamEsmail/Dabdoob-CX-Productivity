# Shard 40 — People & Performance module (`features/cx-people`)

> Priority 5. Scope XL. Legacy dir: `People_deprecated/` (`CC_APP="people"`).
> Depends on: 02 extraction, shared platform (mail, notify, popups, 1:1 alert shell), productivity engine (agents page input), quality + FCR scorecard inputs, work calendar, TL snapshots.

## Pages (registry: group `people`, tone `team`, default `one-on-ones`)

| Route | Title | Roles | Extra gate | Reqs |
|---|---|---|---|---|
| `agents` | Agent performance | admin, tl | — | 1 |
| `one-on-ones` | 1:1s | admin, tl | — | 3,6,7 |
| `tl-tasks` | TL tasks | admin, tl | — | 2 |
| `meetings` | Meetings & BRs | admin, tl | — | 8 |
| `my-actions` | My actions | admin, tl, agent | — | 3,8 |
| `notes` | Notes | admin | owner only | — |
| `coaching` | Coaching signals | admin, tl, agent | agent only if specialist | 3 |
| `hard-cases` | Hard cases | admin, tl | — | — |
| `kpi-close` | Month-end KPI close | admin | — | — |

## Public server API (verbatim)

- `Aggregates.js` (hub file, ported in shard 10): `getAgentsPage`, `jobNightlyAggregates` — consumed here.
- `OneOnOnes.js`: `oneOnOnesPage`, `oneOnOnesGetLog`, `oneOnOnesProductivity`, `oneOnOnesStart`, `oneOnOnesSubmit`, `oneOnOnesSchedule`, `oneOnOnesReschedule`, `oneOnOnesMarkNotHeld`
- `OneOnOneDelete.js`: `oneOnOnesDeletePreview`, `oneOnOnesDeleteLog`, `oneOnOnesDeleteBooking`, `oneOnOnesRestore` (soft-delete + cascade + restore)
- `Tasks.js`: `tasksPage`, `tasksPreview`, `tasksCreate`, `tasksPostMilestone`, `tasksSetStatus`, `tasksSetDeadline`, `tasksEditDetails`
- `Meetings.js`: `meetingsPage`, `meetingsCreateSeries`, `meetingsOpen`, `meetingsGet`, `meetingsSave`, `meetingsReview`, `meetingsAddActions`, `meetingsLogActions`, `meetingsClose`, `meetingsSendSummary`
- `Actions.js`: `actionsMine`, `actionsCreate`, `actionsSetStatus`, `actionsPostUpdate`, `setupPeopleTables`
- `Notes.js`: `notesPage`, `notesSave`, `notesDelete`
- `Coaching.js`: `coachingPage`, `coachingSignal`
- `Scorecard.js`: `getScorecardPage`, `getScorecardDetail`, `refreshScorecard`, `getScorecardAdmin`, `saveScorecardSource`, `removeScorecardSource`
- `OneOnOneReminders.js`: `jobOneOnOneReminders`, `installOneOnOneReminderTrigger`
- `PeopleTriggers.js`: `jobMissedOneOnOneCheck`, `jobTaskReminders`, `jobMeetingActionReminders`, `jobScorecardNightly`, `installPeopleTriggers`
- `MigrateV1Tasks.js`: `importV1LeadTasks`
- Shared: `KpiPayout.js` (weights prod35/qual35/fcr15/behavior15; bands prod 95/86/80, qual 97/93/90, fcr 90/85/80; probation edges; OL halving; leave window 61/92 days — golden-test every edge), `WorkCore.js` (`pwTasksOut_`, `pwFit_`, `pwNextMeetings_`, `pwActionOut_`, `scAggregate_`, `scDerive_`), `OneOnOneAlerts.js`, `PeopleCore.js`.

## Tables (`008_people.sql`)

`PW_TABLES` (Actions.js:30): `actions`, `action_reviews`, `action_updates`, `action_task_details`, `action_planned_milestones`, `one_on_one_schedule`, `one_on_one_logs`, `one_on_one_topics`, `one_on_one_private_notes`, `meeting_series`, `meeting_series_members`, `meetings`, `meeting_attendees`, `pw_reminder_log`, `people_signals`.
Plus: notes table (Notes.js), hard-cases table (page exists; find its tab during extraction/port), `sc_daily`, `sc_behaviour`, `sc_months` (Scorecard.js:50-53), `kpi_*` scorecard output — reconcile with `003_domain_tables.sql` (partial exists).

## Jobs (D-SCHED: 1-min → 15-min)

| Job | Cadence | Runner |
|---|---|---|
| `oo_reminders` (1:1 reminder emails + in-app alerts) | **15 min** (was 1 min) | pg_cron |
| `missed_1on1_check` | daily 22:30 (after `one_on_one_cutoff` 22:00) | vercel cron |
| `task_reminders` | daily 10:00 | vercel cron |
| `meeting_reminders` | daily 10:30 | vercel cron |
| `agent_aggregates`, `scorecard` | nightly | vercel cron |
| `tl_queue_metrics` | hourly (queue app job) | shard 30 |

## Business rules to port verbatim

- 1:1 lifecycle: schedule → alerts (15-min warn per D-SCHED, start) → log with topic-driven template (`one_on_one_topics` fields_json/answers_json) → actions created → missed check at cutoff → popup reminder until resolved; reschedule/mark-not-held; soft delete w/ cascade restore.
- Working-day arithmetic for deadlines (`getWorkingCalendar_` + holidays + TL shifts + days off per country/`days_off_default`).
- TL tasks: timeline start→deadline, est vs available hours, fit/risk (`pwFit_`), progress updates, milestone tracking, reminder mails.
- Meetings/BRs: series + members, notes + action items, next-meeting review, summary mail.
- Actions: status machine, reviews, updates (percent/rag/next step, Drive file ref — file attach deferred to shard 90), visibility, carry-over into next 1:1/meeting.
- Notes: owner-private scratchpad, tags, promote-to-task.
- Coaching: signal → suggested 1:1 topic to the person's TL (`people_signals`).
- Scorecard: `scAggregate_`/`scDerive_` from prod/quality/fcr/behavior inputs; month-end close: exceptions w/ reason → month locked (`sc_months` status).
- KPI payout: full `KpiPayout.js` port + golden tests incl. every band edge.

## Feature map

```
features/cx-people/lib/{oneonones,tasks,meetings,actions,notes,coaching,hardcases,scorecard,kpipayout,workcore}.ts
app/{agents,one-on-ones,tl-tasks,meetings,my-actions,notes,coaching,hard-cases,kpi-close}/page.tsx
app/api/people/{...}/route.ts
```
