# WP-13 — cx-people module audit

> Audited 2026-11-06 at HEAD `2ca871a` (+ WP-13 inline fixes, uncommitted). Method per `w1-audits.md` §1–5.
> Legacy dir `People_deprecated/` — 12 module files (Actions, Coaching, Meetings, MigrateV1Tasks, Notes, OneOnOneDelete, OneOnOneReminders, OneOnOnes, PeopleTriggers, Reminders, Scorecard, Tasks); shared files ported under this feature: KpiPayout.js→`lib/kpi/`, WorkCore.js+PeopleCore.js→`lib/work-core.ts`, OneOnOneAlerts.js→`shared/platform/notify.ts` (WP-17 owns), Aggregates.js `getAgentsPage`→`lib/agents-page.ts` (hub file, consumed here).
> Closures: `.devin/work/extract/people/pages/*.closure.js`; route gates: `specs/legacy-parity/data/legacy-route-registry.json` + `pages.json` (people group = 7 built pages only).

## 1. Function surface matrix

Every legacy public function (`function` without trailing `_`) in the 12 module files, plus the shared/hub fns the feature hosts. Roles verified verbatim legacy-vs-port.

| Legacy fn | Legacy file | Port (`src/features/cx-people/`) | API route | Status |
|---|---|---|---|---|
| `actionsMine` | Actions.js:256 | `lib/actions.ts:312` | `GET /api/people/actions` | ported (roles admin/tl/agent ✓) |
| `actionsCreate` | Actions.js:275 | `lib/actions.ts:345` | `POST /api/people/actions` | ported (admin/tl ✓) |
| `actionsSetStatus` | Actions.js:290 | `lib/actions.ts:362` | `POST /api/people/actions/status` | ported (admin/tl/agent ✓) |
| `actionsPostUpdate` | Actions.js:304 | `lib/actions.ts:380` | `POST /api/people/actions/updates` | ported (admin/tl/agent ✓) |
| `setupPeopleTables` | Actions.js:66 | — | — | **DIAG → resolved.** GAS `ensureTable_` installer; superseded by `supabase/migrations/008_people.sql` (all 15 `PW_TABLES` + `my_notes` + `one_on_one_topic_prompts` + `sc_daily/sc_behaviour/sc_months`). No runtime port needed. |
| `coachingPage` | Coaching.js:16 | `lib/coaching.ts:25` | `GET /api/people/coaching` | ported (admin/tl/agent + `pwCanSignal_` specialist check verbatim ✓) |
| `coachingSignal` | Coaching.js:43 | `lib/coaching.ts:74` | `POST /api/people/coaching` | ported (same ✓) |
| `meetingsPage` | Meetings.js:70 | `lib/meetings.ts:105` | `GET /api/people/meetings` | ported (admin/tl ✓) |
| `meetingsCreateSeries` | Meetings.js:102 | `lib/meetings.ts:145` | `POST /api/people/meetings` op=`create_series` | ported ✓ |
| `meetingsOpen` | Meetings.js:138 | `lib/meetings.ts:190` | POST op=`open` | ported ✓ |
| `meetingsGet` | Meetings.js:161 | `lib/meetings.ts:226` | `GET /api/people/meetings?meetingId=` | ported ✓ |
| `meetingsSave` | Meetings.js:202 | `lib/meetings.ts:283` | POST op=`save` | ported ✓ |
| `meetingsReview` | Meetings.js:225 | `lib/meetings.ts:307` | POST op=`review` | ported ✓ |
| `meetingsAddActions` | Meetings.js:246 | `lib/meetings.ts:331` | POST op=`add_actions` | ported ✓ |
| `meetingsLogActions` | Meetings.js:262 | `lib/meetings.ts:352` | POST op=`log_actions` | ported ✓ |
| `meetingsClose` | Meetings.js:314 | `lib/meetings.ts:438` | POST op=`close` | ported ✓ |
| `meetingsSendSummary` | Meetings.js:351 | `lib/meetings.ts:473` | POST op=`send_summary` | ported ✓ |
| `importV1LeadTasks` | MigrateV1Tasks.js:69 | — | — | **GATED G8** → WP-52 (V1 workbook `v1_ops_spreadsheet_id`, Google Sheets read). Spec-documented; no code port until creds. |
| `notesPage` | Notes.js:29 | `lib/notes.ts:44` | `GET /api/people/notes` | ported (owner-only `notesOwner_` verbatim ✓) |
| `notesSave` | Notes.js:36 | `lib/notes.ts:56` | `POST /api/people/notes` | ported ✓ |
| `notesDelete` | Notes.js:61 | `lib/notes.ts:88` | `DELETE /api/people/notes?id=` | ported ✓ |
| `oneOnOnesDeletePreview` | OneOnOneDelete.js:84 | `lib/one-on-ones-delete.ts:133` | `POST /api/people/one-on-ones/delete` op=`preview` | ported (admin ✓) |
| `oneOnOnesDeleteLog` | OneOnOneDelete.js:108 | `lib/one-on-ones-delete.ts:183` | POST op=`log` | ported ✓ |
| `oneOnOnesDeleteBooking` | OneOnOneDelete.js:168 | `lib/one-on-ones-delete.ts:299` | POST op=`booking` | ported ✓ |
| `oneOnOnesRestore` | OneOnOneDelete.js:200 | `lib/one-on-ones-delete.ts:348` | `POST /api/people/one-on-ones/restore` | ported ✓ |
| `jobOneOnOneReminders` | OneOnOneReminders.js:102 | `lib/one-on-one-reminders.ts:142` | `GET /api/cron/oo-reminders` | **PORTED-AS — resolved this audit** (see §6) |
| `installOneOnOneReminderTrigger` | OneOnOneReminders.js:108 | — | — | **DIAG → resolved.** GAS `ScriptApp` trigger installer; superseded by the cron route + WP-50 pg_cron scheduling. |
| `oneOnOnesPage` | OneOnOnes.js:280 | `lib/one-on-ones-page.ts:94` | `GET /api/people/one-on-ones` | ported (admin/tl ✓) |
| `oneOnOnesGetLog` | OneOnOnes.js:339 | `lib/one-on-ones-page.ts:171` | `GET /api/people/one-on-ones/log?logId=` | ported (admin/tl/agent ✓) |
| `oneOnOnesProductivity` | OneOnOnes.js:497 | `lib/one-on-ones-page.ts:357` | `GET /api/people/one-on-ones/productivity` | ported (admin/tl ✓) |
| `oneOnOnesStart` | OneOnOnes.js:727 | `lib/one-on-ones-page.ts:688` | `GET /api/people/one-on-ones/start` | ported (admin/tl ✓) |
| `oneOnOnesSubmit` | OneOnOnes.js:823 | `lib/one-on-ones-page.ts:824` | `POST /api/people/one-on-ones` | ported (admin/tl ✓) |
| `oneOnOnesSchedule` | OneOnOnes.js:1146 | `lib/one-on-ones.ts:460` | `POST /api/people/one-on-ones/schedule` op=`book` | ported (admin/tl ✓) |
| `oneOnOnesReschedule` | OneOnOnes.js:1175 | `lib/one-on-ones.ts:513` | POST op=`reschedule` | ported ✓ |
| `oneOnOnesMarkNotHeld` | OneOnOnes.js:1194 | `lib/one-on-ones.ts:540` | POST op=`not_held` | ported ✓ |
| `installTriggers` | PeopleTriggers.js:25 | — | — | **DIAG → resolved** (same as installer above) |
| `jobMissedOneOnOneCheck` | PeopleTriggers.js:48 | `lib/reminders.ts:329` | `GET /api/cron/missed-1on1-check` | **PORTED-AS — resolved** (§6) |
| `jobTaskReminders` | PeopleTriggers.js:50 | `lib/reminders.ts:334` | `GET /api/cron/task-reminders` | **PORTED-AS — resolved** (§6) |
| `jobMeetingActionReminders` | PeopleTriggers.js:52 | `lib/reminders.ts:339` | `GET /api/cron/meeting-reminders` | **PORTED-AS — resolved** (§6) |
| `installPeopleTriggers` | PeopleTriggers.js:58 | — | — | **DIAG → resolved** (installer; also deletes+reinstalls `jobScorecardNightly` trigger — N/A in Next) |
| `jobScorecardNightly` | PeopleTriggers.js:71 | `lib/scorecard-server.ts:508` | `GET /api/cron/scorecard-nightly` | **PORTED-AS — resolved** (§6); Sheets read GATED honestly (`{configured:false,skipped}` without SA creds) |
| `getScorecardPage` | Scorecard.js:381 | `lib/scorecard-server.ts:301` | `GET /api/people/scorecard?view=page` | ported (admin/tl/agent ✓) |
| `getScorecardDetail` | Scorecard.js:395 | `lib/scorecard-server.ts:319` | `GET …?view=detail` | ported (admin/tl/agent ✓) |
| `refreshScorecard` | Scorecard.js:409 | `lib/scorecard-server.ts:524` | `POST /api/people/scorecard` op=`refresh` | ported (admin/tl ✓) |
| `getScorecardAdmin` | Scorecard.js:430 | `lib/scorecard-server.ts:552` | `GET …?view=admin` | ported (admin ✓) |
| `saveScorecardSource` | Scorecard.js:471 | `lib/scorecard-server.ts:594` | POST op=`save_source` | ported (admin ✓) |
| `removeScorecardSource` | Scorecard.js:486 | `lib/scorecard-server.ts:615` | POST op=`remove_source` | ported (admin ✓) |
| `tasksPage` | Tasks.js:64 | `lib/tasks.ts:121` | `GET /api/people/tasks` | ported (admin/tl ✓) |
| `tasksPreview` | Tasks.js:154 | `lib/tasks.ts:237` | `POST /api/people/tasks/preview` | ported ✓ |
| `tasksCreate` | Tasks.js:172 | `lib/tasks.ts:256` | `POST /api/people/tasks` | ported ✓ |
| `tasksPostMilestone` | Tasks.js:261 | `lib/tasks.ts:366` | `POST /api/people/tasks/milestone` | ported ✓ (`pwSaveTaskFile_` Drive seam → honest refusal, shard-90) |
| `tasksSetStatus` | Tasks.js:295 | `lib/tasks.ts:414` | `POST /api/people/tasks/status` | ported ✓ |
| `tasksSetDeadline` | Tasks.js:338 | `lib/tasks.ts:462` | `POST /api/people/tasks/deadline` | ported ✓ |
| `tasksEditDetails` | Tasks.js:376 | `lib/tasks.ts:506` | `POST /api/people/tasks/details` | ported ✓ |
| `runOneOnOneReminders_` | OneOnOneReminders.js:57 (private) | `lib/one-on-one-reminders.ts:84` | (called by cron + `jobOneOnOneReminders`) | verbatim name incl. `_` |
| `runMissedOneOnOneCheck_` | Reminders.js:55 | `lib/reminders.ts:62` | same | verbatim |
| `runTaskReminders_` | Reminders.js:187 | `lib/reminders.ts:233` | same | verbatim |
| `runMeetingActionReminders_` | Reminders.js:213 | `lib/reminders.ts:260` | same | verbatim |
| `scNightly_` | Scorecard.js (private) | `lib/scorecard-server.ts:491` | same | verbatim |
| `getAgentsPage` | Aggregates.js (hub) | `lib/agents-page.ts:12` | `GET /api/people/agents` | ported; hub-file fn hosted here per shard 40 — consumer is hub-side (WP-10). No people page calls it (agents page = scorecard). |
| `oneOnOneAlerts` / `oneOnOneAlertsSeen` | OneOnOneAlerts.js:88/113 (shared) | `shared/platform/notify.ts:229/261` | `/api/alerts/one-on-one` | ported (WP-17 surface; verified present) |
| `kpiPayout_` + `kpi*` readers | KpiPayout.js (shared) | `lib/kpi/{index,server}.ts` | (desk kpi-logs consume `kpiLog*`/`olCase*`/`leaveInput`/`behaviourInput` — WP-15 surface, hosted here per D-SHARE) | ported; `fcrDailyInput` → `/api/fcr/daily` (D-FCR) |

**Coverage:** 54 public fns across the 12 module files = 44 page/lifecycle fns ported verbatim (name, roles, semantics) + 5 `job*` trigger entries now verbatim-named (§6) + 4 installer/DIAG fns resolved by supersession + 1 GATED (`importV1LeadTasks`). No `MISS`.

## 2. Per-page checklist

Compared each `components/<page>-page.tsx` against its `*.closure.js`: class vocabulary (closure-class ⊆ port-class, no `cx-*`-invention where legacy uses `pw-*`/`nt-*`/`oo-*`), copy strings verbatim (incl. empty states, placeholders, aria-labels, toast/error text), element order, attribute wiring, and `I.*`/`Ke.*`/`me.*` call coverage → `fetchJson` routes. Full reads: notes, coaching, my-actions. Structural sampling + complete copy/class/label diff: agents, one-on-ones, tl-tasks, meetings.

| Page | Closure | Port | Shell | Server calls (closure → port) | Verdict |
|---|---|---|---|---|---|
| `agents` | agents.closure.js (1142) | `agents-page.tsx` (786) | `cxp dq-page`+`Kt`→`Head` ✓ | `me.{page,detail,refresh,admin,saveSource,removeSource}` → `GET/POST /api/people/scorecard` (`view=page|detail|admin`, ops `refresh|save_source|remove_source`) — 6/6 | **parity** |
| `one-on-ones` | one-on-ones.closure.js (4146) | `one-on-ones-page.tsx` (2735) | `rt`→`PwShell` ✓ | `I.oneOnOnes*`×11 → `/api/people/one-on-ones{,/start,/log,/productivity,/schedule,/delete,/restore}`; `I.tasks{Create,SetStatus,EditDetails,PostMilestone}` → `/api/people/tasks{,/status,/details,/milestone}` — 16/16 | **parity** |
| `tl-tasks` | tl-tasks.closure.js (1861) | `tl-tasks-page.tsx` (1008) | `rt`→`PwShell` ✓ | `I.tasks{Page,Create,Preview,PostMilestone,SetStatus,SetDeadline}` → `/api/people/tasks{,/preview,/milestone,/status,/deadline}` — 6/6 (`tasksEditDetails` not called by this page in legacy — correct it's absent) | **parity** |
| `meetings` | meetings.closure.js (1645) | `meetings-page.tsx` (993) | `rt`→`PwShell` ✓ | `I.meetings*`×10 → `/api/people/meetings` GET+op-dispatch; `I.actionsPostUpdate` → `/api/people/actions/updates` — 11/11 | **parity** |
| `my-actions` | my-actions.closure.js (555) | `my-actions-page.tsx` (168) | `cxp dq-page`+`Kt`→`Head` ✓ | `I.actions{Mine,PostUpdate,SetStatus}` → `/api/people/actions{,/updates,/status}` — 3/3 | **parity** (line-read: `ka`/`_a` verbatim) |
| `notes` | notes.closure.js (626) | `notes-page.tsx` (323) | `rt`→`PwShell` narrow ✓ | `Ke.{page,save,remove}` → `GET/POST/DELETE /api/people/notes` — 3/3 | **parity** (line-read: `Ca`/`Ta`/`$a` verbatim, incl. make-task `#/tl-tasks` hand-off via `taskDraft`=`be`) |
| `coaching` | coaching.closure.js (541) | `coaching-page.tsx` (159) | `cxp dq-page`+`Kt`→`Head` ✓ | `I.coaching{Page,Signal}` → `GET/POST /api/people/coaching` — 2/2 | **parity** (line-read: `xa` verbatim) |
| `hard-cases` | — | catch-all → `UnbuiltPage` | `page`+`pending` | — | **parity placeholder.** `pages.json` has no component (unbuilt in legacy); `hs()` "Not built yet." verbatim in `StateScreen.tsx:19-48` |
| `kpi-close` | — | catch-all → `UnbuiltPage` | same | — | **parity placeholder** (same) |

Notes on checks: closure→port class diffs are clean (only bundled-dep and route-name false positives; `is-in`/`is-done` confirmed applied via `useEnterAnim`/`st()` classList in both). Shared chrome mapping verified: `Kt`→`Head` (`dq-head`), `Me`→`LoadError` (`cx-note bad`), `fn`/`Oe`→`Skeleton`/`LinesSkeleton` (`cc-skel` shapes with identical `CHART_HEIGHTS`/`ROW_WIDTHS`), `rt`→`PwShell`, `es`→`PwDialog`, `Ne`→`PwCombo` (`/api/options/<listKey>`), `lt`→`useSe`, `be`→`taskDraft`.

## 3. Gate matrix

| Route | Registry roles/reqs (verbatim from `legacy-route-registry.json`) | Page gate | API gate (lib `requireRole`) | Extra gate | View-as write refusal |
|---|---|---|---|---|---|
| `agents` | admin,tl / reqs 1 | `pageAllowed` roles ✓ | `getScorecardPage` `[admin,tl,agent]` (page gate stricter — legacy identical) | — | n/a (read); `refreshScorecard`/`save/removeScorecardSource` `assertWritable` ✓ |
| `one-on-ones` | admin,tl / reqs 3,6,7 | roles ✓ | `[admin,tl]` all fns except `oneOnOnesGetLog` `[admin,tl,agent]` — verbatim | — | `assertWritable` on submit/schedule/reschedule/not-held/delete/restore ✓ |
| `tl-tasks` | admin,tl / reqs 2 | roles ✓ | `[admin,tl]` ×7 verbatim | — | `assertWritable` ×7 call sites ✓ |
| `meetings` | admin,tl / reqs 8 | roles ✓ | `[admin,tl]` ×10 verbatim | — | `assertWritable` on all writes ✓ |
| `my-actions` | admin,tl,agent / reqs 3,8 | roles ✓ | `actionsMine/SetStatus/PostUpdate` `[admin,tl,agent]` verbatim | — | `assertWritable` ✓ |
| `notes` | admin / reqs — | roles + **`isOwner`** extra gate (`pageAllowed` case `notes` → `Ma`/`isOwner` — verbatim vs bundle `ds()`) | `notesOwner_` real-email vs `assistant_owner_email` verbatim | **owner-only enforced** ✓ | `assertWritable` on save/delete ✓ |
| `coaching` | admin,tl,agent / reqs 3 | roles + **specialist** (`agent` ⇒ `specialist` — verbatim) | `pwCanSignal_` (admin/tl/specialist) verbatim | specialist enforced at API too ✓ | `assertWritable` on signal ✓ |
| `hard-cases` | admin,tl / — | placeholder (gated page renders only if allowed; unbuilt → `hs()`) | — | — | — |
| `kpi-close` | admin / — | placeholder | — | — | — |

Gate fn parity: `shared/shell/gates.ts pageAllowed` is a verbatim port of bundle `ds()` — the people cases (`my-day`/`notes`→owner, `coaching`→agent-requires-specialist) match `extract/people/app.pretty.js:8703-8726` exactly.

## 4. Jobs

| HB_PLAN key | Legacy entry → impl | Port impl | Cron route | `dqStep_`/`hbBeat_` name | Scheduled |
|---|---|---|---|---|---|
| `oo_reminders` | `jobOneOnOneReminders` → `runOneOnOneReminders_` | `lib/one-on-one-reminders.ts:84` | `/api/cron/oo-reminders` | `'oo_reminders'` ✓ | no (B5/WP-50; 15-min cadence per D-SCHED — legacy 1-min tick + `pwOoNextEmailMs_` gate preserved) |
| `missed_1on1_check` | `jobMissedOneOnOneCheck` → `runMissedOneOnOneCheck_` | `lib/reminders.ts:62` | `/api/cron/missed-1on1-check` | `'missed_1on1_check'` ✓ | no (daily ~22:30) |
| `task_reminders` | `jobTaskReminders` → `runTaskReminders_` | `lib/reminders.ts:233` | `/api/cron/task-reminders` | `'task_reminders'` ✓ | no (daily ~10:00) |
| `meeting_reminders` | `jobMeetingActionReminders` → `runMeetingActionReminders_` | `lib/reminders.ts:260` | `/api/cron/meeting-reminders` | `'meeting_reminders'` ✓ | no (daily ~10:30) |
| `scorecard` | `jobScorecardNightly` → `scNightly_` | `lib/scorecard-server.ts:491` | `/api/cron/scorecard-nightly` | `'scorecard'` ✓ | no (nightly ~09:30); Sheets-cred gate `{configured:false,skipped}` — GATED G-family honest degradation |

All 5 routes: `Bearer CRON_SECRET` 401 → `requireJobCaller()` → `buildJobEnv()` → `dqStep_(env,'<key>',…)` → `env.hbFlush()`. Heartbeat keys match HB_PLAN verbatim; `dqStep_` (`shared/jobs/steps.ts:8`) writes `hbBeat(job,'ok'|'error')` = legacy `hbRun_`.

## 5. Residual gaps

| Gap | Class | Disposition |
|---|---|---|
| `importV1LeadTasks` (MigrateV1Tasks.js) | GATED G8 | Tracked: WP-52 + BLOCKED_TASKS B2. No port (Google V1 workbook). |
| `setupPeopleTables` + 3 installers (`installTriggers`/`installPeopleTriggers`/`installOneOnOneReminderTrigger`) | DIAG | Resolved by supersession: `008_people.sql` migrations; cron routes + WP-50 pg_cron replace `ScriptApp` triggers. Documented; no code needed. |
| `job*` name deviation | PORTED-AS | **Fixed this audit** — verbatim `job*` entries exported (§6). Mapping documented in §1/§4. |
| KPI-payout band edges | coverage | `tests/golden/kpi.test.ts`: `kpiBandPay_` edges (95/86/80/94.999/79.999) + probation bounds + 61/92-day leave hand-edges + 250 `kpiPayout_` vectors + OL-halving/ineligible/missing hand cases. **Gap for WP-23:** no per-metric configured-band edges through `kpiPayout_` (prod 95/86/80, qual 97/93/90, fcr 90/85/80 exact-boundary vectors), probationMonth ≥4 path, `behaviorCases` deduction curve edges, `fcr` absent-in-probation strictness. → feeds WP-23 (already pending; scope noted). |
| `pwSaveTaskFile_` (Drive attach) | GATED shard-90 | Honest refusal verbatim (`files_folder_id` unset error preserved); milestone file-kind records metadata without upload — correct per spec. |
| People jobs unscheduled in `vercel.json` | B5 | WP-24 (schedules) + WP-50 (apply). Routes exist and are correct. |
| `/api/people/agents` consumer | note | `getAgentsPage` (hub Aggregates.js) hosted here; the people `agents` page calls scorecard only — consumer is hub-side (WP-10/WP-18 confirm no dead route). |
| `listInstalledTriggers_` (private, admin-page feed) | note | Legacy listed GAS triggers for the admin page; Next exposes health/heartbeat state instead — WP-40 admin-UI sweep. |

No new `WP-F` rows required: every residual is already tracked (WP-23, WP-24, WP-50, WP-52) or resolved by documentation.

## 6. Fixes applied this audit

**`job*` verbatim entry points — all 5** (the §5.5 "name deviation" residual — decided: aliases *are* needed for verbatim surface + sibling convention `jobDataTick`/`jobMailDesk`/`jobTlQueueMetrics`):

- `lib/reminders.ts` — `jobMissedOneOnOneCheck`/`jobTaskReminders`/`jobMeetingActionReminders` (each `requireJobCaller()` + `dqStep_(env,'<job>', run*_)` = `requireJobCaller_`+`hbRun_`; +27 lines incl. imports).
- `lib/one-on-one-reminders.ts` — `jobOneOnOneReminders` (same shape; +15 lines).
- `lib/scorecard-server.ts` — `jobScorecardNightly` (verbatim entry incl. the Sheets-cred honest-degradation gate moved from the route into the fn body; +26 lines).

Routes unchanged — they invoke the identical `dqStep_+run*_` chain inline; the exports are the verbatim-named public surface for callers holding a `JobEnv` (68 added / 4 removed lines, all inside `src/features/cx-people/`).

## 7. Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** (incl. the 3 edited files) |
| `npx vitest run` | **817 passed / 41 files / 0 failed** (incl. `people.test.ts` 8, `scorecard.test.ts` 7, `kpi.test.ts` 6, `api-fragments/kpi` 8) |
| `npx eslint` (3 edited files) | clean |

## 8. Questions for the orchestrator

1. WP-23 scope confirm: add per-metric configured-band-edge vectors (prod/qual/fcr exact edges through `kpiPayout_`), probationMonth ≥4, behaviorCases curve edges — as listed in §5.
2. WP-24/50: `oo_reminders` schedule — D-SCHED says 15 min (legacy was 1-min tick + property gate). The internal `pwOoNextEmailMs_` deferral is preserved, so a 15-min cron is parity-safe (may fire while `next` is still >now; tick returns `{emailed:0,next}`).
3. `/api/people/agents` — confirm on the WP-18 pass that some consumer exists or mark intentional extra surface (hub scoreboard host).

— wave1-agent (WP-13)
