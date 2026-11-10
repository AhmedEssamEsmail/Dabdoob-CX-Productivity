# S06-01 — v1_ops 17 non-task tabs: per-tab verdicts (contract for S06-04/05/06/07)

Evidence: `logs/probe-v1-tabs.log` (probe `migration/probe-v1-tabs.ts`, read-only,
exit=0, `probed=17/17`). `colA_rows` includes the header row, so colA=1 means a
header-only (0-data-row) store. Headers below are VERBATIM; `readSheet`
lowercases them, so `sheetToDb` values are written lowercase — same convention
as `mappings/v1-ops.ts` / `queue-quality.ts` (which already ported the identical
Scheduler.js stores from the `core` workbook — transforms referenced below are
that precedent: `schNotePack_`, extra_json packing, `mig-<index>` dedupe_key).

Verdicts: **migrate: 8 · NEW: 1 · rejected: 8.**

## migrate: — scheduling (S06-05)

- `ShiftPlan` (241) -> `sched_plan`, upsertOn `dedupe_key` (minted `mig-<index>`
  by ROW_TRANSFORMS — no natural key holds, S02-03 precedent). sheetToDb:
  `from<-'start'`, `to<-'end'`; verbatim cols `month, date, tl_email<-'tl',
  shift`; `submitted_at<-'savedat'`. TRANSFORM: rebuild `segments_json` from
  role/queueh/peopleh/taskh/tasks (same approximation as core sched_plan);
  wfh/variant land null. FLAG: `tl` holds display names, not emails.
- `ShiftOverrides` (127) -> `sched_overrides`, upsertOn `tl_email,date`.
  sheetToDb: `tl_email<-'tl'`; verbatim `date, shift`. TRANSFORM (schNotePack_):
  `note` = JSON {reason, wfh}; setby/setat -> `submitted_by/submitted_at`.
  FLAG: `tl` = display name.
- `TeamLeads` (6) -> `sched_team`, upsertOn `tl_email`. sheetToDb:
  `tl_email<-'email'` (real emails); verbatim `name`. TRANSFORM: `extra_json` =
  {startDate,endDate,note}; `active`=true when enddate blank (core precedent).
- `TLOffDays` (20) -> `sched_offdays`, upsertOn `tl_email,date`. sheetToDb:
  `tl_email<-'tl'`; `note`. TRANSFORM: `date` = `"<month>:<offDays>"`
  (e.g. `2026-08:5,6` — the port's schLoadOffDays_ format, core precedent);
  setby/setat -> `submitted_by/submitted_at`. FLAG: `tl` = display name.
- `ShiftRequests` (6) -> `sched_requests`, upsertOn `request_id`. sheetToDb:
  `request_id<-'id'`, `from_email<-'tl'`, `to_email<-'withtl'`,
  `date<-'datefrom'`, `their_date<-'dateto'`, `decided_note<-'note'`,
  `decided_by<-'decidedby'`, `decided_at<-'decidedat'`,
  `submitted_at<-'requestedat'`; verbatim `type, status`. TRANSFORM
  (schNotePack_): `note` = JSON {subtype,shift,withShift,reason,peerStatus,
  peerAt}. FLAG: `tl`/`withTl` = display names.

## migrate: — people + misc (S06-06 / S06-07)

- `AgentOneOnOnes` (37) -> `one_on_one_logs`, upsertOn `log_id`. sheetToDb:
  `log_id<-'id'`, `manager_email<-'tl'`, `report_email<-'agentemail'`,
  `held_at<-'date'`, `submitted_at<-'savedat'`. TRANSFORM: `kind`='v1_agent_1on1';
  `summary` = concat of wins/coaching/concerns/challenges/projects/taskReview/
  assignedTasks/nextSteps/rating (table has no per-topic cols for these).
  FLAG: `tl` = display name; `agentName` col unmapped (report_email is the key).
- `OneOnOnes` (9) -> `one_on_one_logs`, upsertOn `log_id`. sheetToDb:
  `log_id<-'id'`, `report_email<-'tl'`, `held_at<-'date'`,
  `submitted_at<-'savedat'`. TRANSFORM: `kind`='v1_tl_1on1'; `manager_email`
  const 'mohamed.nabil@dabdoob.com' (evidence: every setBy/decidedBy col in
  these tabs is him — FLAG for PM confirm); `summary` = concat of
  agenda/morale/wins/prev/obs/coaching/concerns/tlActions/mgrActions/rating/
  challenges/projects/taskReview/assignedTasks. FLAG: `tl` = display name.
- `Settings` (17) -> `sched_config`, upsertOn `key`. sheetToDb: verbatim
  `key, value` (plain strings land as jsonb strings — queue-quality.ts:190).
  Keys seen: admin_email, tl1..tl3 — V1 TL-app config, NOT the live V2
  `config` table (PM gate: package non-goal "changing settings values").

## NEW: (1 table, for S06-04)

- `TaskOccurrences` (353) -> `NEW: v1_task_occurrences`. Occurrence-grain rows
  (`id OC*, taskId K*, dueDate, status, doneAt, note, updatedBy, updatedAt`) —
  no V2 table holds recurring-task instances (actions/action_updates/
  action_planned_milestones are all the wrong grain). Columns:
  `occurrence_id text PRIMARY KEY <- 'id'`; `task_id text <- 'taskid'`
  (joins actions.source_id of the S04-02 Tasks->actions rows);
  `due_date text <- 'duedate'`; `status text <- 'status'`;
  `done_at text <- 'doneat'`; `note text <- 'note'`;
  `updated_by text <- 'updatedby'`; `updated_at timestamptz <- 'updatedat'`.
  upsertOn `occurrence_id`. (+ `submitted_by`, `submitted_at` housekeeping.)

## rejected:

- `IdentityPins` (22) — credential material: headers `kind,key,pin,note`, 21
  data rows; per contract default, secrets never land in DB. No doubt — no flag.
- `RoadmapVisibility` (1) — empty store (header `taskId,tl,sharedBy,sharedAt`,
  0 data rows). Would-be holder: `actions.visibility` live state.
- `HourOverrides` (1) — empty store (header `date,tl,hour,kind,label,setBy,
  setAt`). Would-be holder: `sched_hour_overrides` (core precedent exists).
- `Agents` (1) — empty store (header `email,name,tl`). Would-be holder: `roster`.
- `KPI` (1) — empty store (header `name,tl,prod,qual,overall,adh,added`).
  Would-be holder: `tlp_team` / `kpi_*_log` family.
- `Tickets` (1) — empty store (header `id,cust,ch,tl,days,cat,status,action,
  added`); also ⊆ `tickets` data class.
- `HardCases` (1) — empty store (header `id,tl,ch,sum,pri,dec,stake,logged,
  status,resolvedDate,resolution`). Would-be holder: none (would have been NEW).
- `Standups` (1) — empty store (header `date,savedAt,sd1..sd7`). Would-be
  holder: `meetings` or NEW — moot, nothing to migrate.

## Flags for downstream leaves / PM

1. `tl`, `withTl`, `agentName`, `from`/`to` name fields hold DISPLAY NAMES,
   not emails, into `*_email` columns — same caveat recorded in v1-ops.ts
   DECISIONS; TeamLeads tab is the name->email reference (5 TLs).
2. `OneOnOnes.manager_email` constant is inferred (setBy evidence), confirm w/ PM.
3. `Settings` targets `sched_config`, never live `config`; wiring stays PM-gated.
4. Five of eight migrate: tabs need ROW_TRANSFORMS (noted per line) — all follow
   the established core-workbook precedents, no new mechanics.
