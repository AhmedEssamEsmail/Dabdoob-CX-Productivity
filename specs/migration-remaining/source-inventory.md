# S01-01 source inventory — tab census + per-store verdicts

Probe: `migration/probe-remaining-tabs.ts` (read-only; 0 sheet writes) →
`specs/migration-remaining/logs/probe-tabs.log`, exit=0, 2026-11-09.
Counts: `colA_rows` = exact col-A populated rows (incl. header); `grid` = sheet
grid rows (upper bound). One tab FAIL (voice 'Quality ScoreCard', Sheets read
quota) — derived tab, non-blocking. Reference counts: tickets 176,616 ·
qa_audits 6,560 · qe_queue_log 3,887 · qe_fd_cache 11,645 · fd_activities
195,553 · maqsam_calls 112,037 · freshchat 0 (migration-run.md §7).

## 1. hct `1LtUZb…` "Egypt Operations HCT" — **migrated → `dq_hct`** (S03-02)

- `Sheet1` 53 data rows. Headers VERBATIM: `Sr., Code, Employee Name, Arabic
  Name, Hiring Date, Position, Department, Section, Gender, Contact Number,
  Email, Direct Repporter, Batch, Status, LWD, Level, Fresh desk ID, Freshdesk
  Name, Maqsam Name`. Row 2 cols U–W hold a side-table header `User ID, Name,
  Email` — map cols A–S only; roster.ts contract = name,email,position,
  department,section,hct_role,hct_tl_email.
- `Sheet2` same roster, alt layout (`Extension, User #, Reviewed?` extra) — stale
  copy, ignore. `Sheet3` email→`Agent name.` map — supplement for name lookup.

**Final state (S05-04): migrated → `dq_hct`** — dry read 60 rows
(`logs/dry-run-2.log` l.99); mapping `hct.ts` + DDL `20261109131140` staged;
live write PENDING-APPROVAL (`audits/migration-run-2.md` §2).

## 2. v1_ops `1hul-T…` "Dabdoob CX Operations — Database" — **migrated → lead tasks** (S04-02) + 17 tabs resolved (S06-01/05/06/07)

- `Tasks` 18 data rows. Headers VERBATIM: `id, desc, who, pri, due, status,
  notes, assigned, recurrence, lastDoneAt, roadmapId, source, deliveredAt,
  estHours, comments, recurDay`. `TaskOccurrences` 352 rows (`id, taskId,
  dueDate, status, doneAt, note, updatedBy, updatedAt`).
- `ProductivitySources` = V1 `productivity_files` map: `2026-08 → 10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg` ("Productivity (August-2026)"), `2026-09 → 1I29yj…`. **2026-08 workbook NOT shared (403)** — access gap; owner must share to the SA before a 2026-08 scRefreshMonth_. **Final state (S06-12): `blocked: share pending`** — S06-11 is NEEDS_USER on the workbook share; probe not run.
- S06-01 verdicts (`decisions-v1-ops.md`, probe `logs/probe-v1-tabs.log`):
  migrate 8 → `sched_plan`, `sched_overrides`, `sched_team`, `sched_offdays`,
  `sched_requests` (S06-05 `v1-ops-sched.ts`), `one_on_one_logs` ×2 tabs
  (`AgentOneOnOnes`, `OneOnOnes` — S06-06 `v1-ops-people.ts`), `sched_config`
  (`Settings` — S06-07 `v1-ops-misc.ts`); NEW `v1_task_occurrences`
  (`TaskOccurrences`, 353 rows — DDL `20261109134359`, S06-04); rejected 8 —
  `IdentityPins` (credentials), `RoadmapVisibility`, `HourOverrides`, `Agents`,
  `KPI`, `Tickets`, `HardCases`, `Standups` (all header-only/empty stores).
  All wired into engine by S06-10 (`engine.ts`, tsc exit=0).

**Final state (S06-12): migrated (Tasks + 8 mapped tabs) + NEW table +
rejected, all dry/PENDING-APPROVAL** — `Tasks` dry read 18 rows → `actions`
(`v1-ops.ts`, `dry-run-2.log` l.100); live write PENDING-APPROVAL. The 17
non-task tabs are no longer `reshard:`: 9 land via new mappings/`v1_task_
occurrences` (dry counts pending the gated `migrate-all --dry`,
`migration-run-2.md` §7), 8 rejected per `decisions-v1-ops.md`. FLAG carried:
`tl`/`withTl`/`agentName` hold display names, not emails
(`decisions-v1-ops.md` §Flags).

## 3. oct_workbook `1I29yj…` "Productivity (Sep-2026)" — **migrated → scRefreshMonth_** (S04) + S06 verdicts on 3 raw tabs

Title says Sep and `ProductivitySources` + `productivity_files[2026-09]` map it
to 2026-09; tabs are live (Nov dates). scRefreshMonth_ reads:
`Productivity Matrix` (1,105 data rows; 2 header rows, agents from row 3),
`FCR` (28,446; `Ticket ID, Subject, Agent, Created time, … Agent Email, Team
Lead, …, Month, Date`), `Business Behavior` (1; `Agent Email, Date of Incident,
Case details`); `Stackranking`/`Stack Ranking` = behaviour fallback.
- covered: `Maqsam Calls` (176,955 grid, raw call export — maqsam_calls now
  API-fed; NOT count-parity, same data class, flag window check).
- rejected (⊆ `tickets` dumps): `Tickets History` (102,333), `Data Import
  Tickets` (75,032). rejected (derived/dashboard/scratch): `Productivity
  Computed`, `Quality`, `Quality score weekly`, `Quality Numbers`,
  `Pivot Table 1`, `CX Performance`, `KPIs Payout`, `Agent Summary`,
  `Stackranking`, `Headcount`(⊆dq_hct), `Sheet21`, `Assumptions`,
  `📋 How to Update`, `Gateways`, `Ecxclud Contacts`, `Probabtion period`.
- S06-02 verdicts (`decisions-ops-tabs.md`, probe `logs/probe-ops-tabs.log`):
  `Transcript` → `NEW: call_transcripts`; `AUXes Exceptions` →
  `tracker_records('aux_exceptions')`; `FD_AUX` → migrated `aux_spans`
  (S07-02 mapping; engine `col_e/f/g` fix S07-01 — probe
  `logs/s07-02-fdaux.log` rows=13,064, verbatim A..G populated,
  `dedupe_key` upsert; dry/live PENDING-APPROVAL).
  `qa_ctls` (`CTL & Quality` A..J, §6) maps `agent_email` from the first
  `Agent Email` occurrence (agent block col A); the audit-echo repeat
  (col O) lands as `agent email#2` and stays unmapped (S07-03,
  `specs/migration-remaining/results/S07-03.md`).

**Final state (S06-12): migrated (scRefreshMonth_ path) + covered + rejected +
3 migrated** — `sc_months` last run 2026-09, 480 rows ok; configured
months = `productivity_files` keys (`sc-probe.log`); `--write` PENDING-APPROVAL.
`Maqsam Calls` covered (API-fed). Rejected tabs unchanged. `Transcript` →
`call_transcripts`, `AUXes Exceptions` → `tracker_records` (mappings
`ops-tabs.ts`, S06-08; wired S06-10; dry PENDING-APPROVAL). `FD_AUX` →
migrated `aux_spans` in S07 (`logs/s07-02-fdaux.log`: 13,064 rows,
`col_e/f/g` populated; `dedupe_key` upsert; dry/live PENDING-APPROVAL).

## 4. voice `1bna3…` "Voice QA Form V1 (Responses)" — **migrated → qa_audits** via QA_HIST_SOURCES.voice (S04)

- `Form Responses 1` 9,230 data rows; form cols (`Timestamp, Score, Agent
  Email, Extension Number , Call ID, Call Date, Call Type,` + question cols,
  ~140 wide — import uses chunked read, QA_HIST_CHUNK=1200).
- rejected (derived): `Sheet6`, `Voice Quality ScoreCard`,
  `Quality ScoreCard` (probe FAIL read-quota), `HCT` (#REF scratch).

**Final state (S05-04): migrated → `qa_audits`** — `run-qa-history.ts --probe`:
9,230 rows, would-import 4,076, skipped 5,154, unmatched 0 (`qa-probe.log`);
`--write` resumes at `QE_HIST_*` cursors — PENDING-APPROVAL.

## 5. text `1BNzinv…` "Texting QA Form V1 (Responses)" — **migrated → qa_audits** via QA_HIST_SOURCES.text (S04)

- `Form Responses 1` 4,038 data rows (`Timestamp, Score, Agent Name, Agent
  Email, Chat ID, Chat Date, Chat Time, Modality, Channel,` + question cols).
- rejected (derived): `Quality ScoreCard`.

**Final state (S05-04): migrated → `qa_audits`** — probe: 4,038 rows read,
would-import 1,709, skipped 2,329, unmatched 0 (`qa-probe.log`); `--write`
PENDING-APPROVAL.

## 6. daily_report `1Ll5Bx…` "New Daily Report" — **migrated → `freshchat` mirror** (S04 backfill) + S06 verdicts on 2 tabs

- `Freshchat` 1,741 data rows (`, Status, Interaction Id, Updated at,
  Resolved At, Channel, Conversation id, …` — col A empty; mirror ts from
  `Updated at`/epoch suffix per mirrors.ts; 1,741 = col-A populated count vs
  backfill `read=1,742` raw extent incl. trailing col-A-empty row, ±1
  unreconciled). Remote freshchat=0 → backfill.
- covered: `Maqsam` 15,411 (maqsam_calls API feeds same call data).
- rejected (⊆ tickets): `Freshdesk` (56,615), `Tickets` (API-shaped dump).
  rejected (dashboards/scratch): `Normal Queues`, `Critical Queues`,
  `Maqsam Dashboard`, `WA Monitoring`, `Country Code`, `Sheet36`, `Avaya`
  (#REF!/1899-date broken export).
- S06-02 verdicts (`decisions-ops-tabs.md`): `WA` → `migrate:
  tracker_records('wa_parcels')` (record_id=`Parcel ID`, values B..M);
  `CTL & Quality` SPLIT — block A..J → `migrate: qa_ctls`
  (upsertOn `ctl_id='hist-<Call ID>'`), block N..R → `rejected: ⊆ qa_audits`.

**Final state (S06-12): migrated → `freshchat` mirror + covered + rejected +
2 migrated** — `backfill-freshchat-sheet.ts --dry`: read 1,742,
unique 1,602, would_write 1,602 (`fc-dry.log`); `--write` upsert
onConflict `dedupe_key` PENDING-APPROVAL. `Maqsam` covered (API-fed);
rejected unchanged. `WA` → `tracker_records('wa_parcels')` and `CTL &
Quality` A..J → `qa_ctls` via `ops-tabs.ts` (S06-08, wired S06-10; dry
PENDING-APPROVAL); CTL block N..R rejected ⊆ `qa_audits`.

## 7. fd_activity `1Fc6VC…` "FD Status Activity Log" — **covered → `fd_activities`** (gap-backfill S04)

- `Activities` 208,679 rows (`Performed At, Ticket ID, Performer Name,
  Performer Type, Activity Type, Field Changed, New Value, Source, Group,
  Date`) vs remote 195,553 → ~13k gap → gap-check/backfill (PLAN #3).
- rejected (report-runner scratch): `Report`, `Missing Tickets`, `Blad2`.

**Final state (S05-04): covered → `fd_activities`, gap-backfill staged** —
`run-fd-mirror.ts --check`: sheet_rows 208,706, expected unique 208,684,
remote 207,811, **gap=873** (`fd-check.log`); `--write`
(`syncMirror(full:true)`) PENDING-APPROVAL.

## 8. fc_messages `1ZxDxS…` "Freshchat Detailed Msgs" — **migrated → FC message mirror** (S04-07)

- `Freshchat Messages (auto)` 73,536 rows (`_day, _key, conversation_id,
  conversation_url, interaction_raw_id, message_id, message_type,
  message_parts, created_time, …, channel_name, detailed_message_type,
  customer_id`). `Freshchat Messages` 9,269 rows (same shape minus `_day,_key`
  — manual export; dedupe on `message_id`). `Sheet1` empty.

**Final state (S05-04): migrated → `fc_messages` mirror** —
`backfill-fc-messages.ts --dry`: (auto) 73,536 + manual 9,269 read,
TOTAL unique 82,805, would_write 82,805, null_ts 0 (`fcmsg-dry.log`);
sha1 `dedupe_key`, upsert onConflict `dedupe_key` — `--write`
PENDING-APPROVAL; DDL `20261109131136` authored, not applied.

## 9. touch_archive `1qch1v…` "Archive of FD Database May-2026" — **rejected** + `New Tickets Daily` gap-backfill (S06-09)

- rejected (⊆ landed tables): `Freshdesk Current State` (65,444-grid FD dump ⊆
  tickets), `Users List` (81 ⊆ roster), `Sheet2` (#REF scratch).
- S06-03 probe verdict (`decisions-coverage.md`, `logs/coverage-gaps.log`):
  **gap** — `Performed At` window 2026-01-05..2028-07-08 breaches
  `fd_activities` [2026-07-02..2026-11-09] on both sides. S06-09 built
  `migration/backfill-fd-history.ts` (mirrors.ts verbatim mapping, sha1
  dedupe, 500-batches).

**Final state (S06-12): rejected (⊆ landed tables) + `New Tickets Daily`
migrated via gap-backfill (write gated)** — `--dry` (`logs/fdhist-dry.log`,
exit=0, writes=0): read 430,055, in_gap 380,451, outside 49,604;
TOTAL unique 495,825 would_write across both tabs (5,148 dupes collapsed);
`--write` PENDING-APPROVAL.

## 10. qa_engine_source `1VtBT8…` "FD Database May-2026" — **rejected** + `New Tickets Daily` gap-backfill (S06-09)

- rejected: `Freshdesk Current State` (90,858-grid ⊆ tickets), `Users List`,
  `Sheet3` (empty).
- `New Tickets Daily` (165,461-grid, same FD-activity shape as §9 —
  S06-03 probe verdict: **gap**, window 2026-01-09..2028-07-10, dual-sided
  breach vs fd_activities; covered by the same `backfill-fd-history.ts`).

**Final state (S06-12): rejected + `New Tickets Daily` migrated via
gap-backfill (write gated)** — `--dry`: read 165,461, in_gap 120,522,
outside 44,939, skipped 0 (`logs/fdhist-dry.log`); combined with §9,
495,825 unique would_write; `--write` PENDING-APPROVAL.

## 11. qa_queue `1ArWBr…` "Quality Queue Data" — **rejected (live V1 QE working store)**

`Scores - Meta` ranAt `2026-11-09 11:03`, `Build Log` daily trigger — still
written by the V1 engine, but every tab is a working mirror/derivation:
`Queue Log` (3,613 ~ qe_queue_log), `Ticket Detail Cache` (25,295 — larger
than qe_fd_cache 11,645; S07-04 found 13,650 ids absent from qe_fd_cache),
`Scores - Audits` (5,785 ~ qa_audits), `Scores -{ByDay,ByWeek,Pillars,Weak Points,Questions,
Contact Types,Segments,Auditors,Agents}` + `Catalogue`(213) all derived.
The store stays rejected; the cache is NOT fully duplicated — S07-04 found
real unique ticket-detail rows (final state below).

**Final state (S07-04): rejected (live V1 QE working store); `Ticket Detail
Cache` orphans -> `qe_fd_cache` import (`--write` PENDING-APPROVAL)** —
S07-04 dry run (`specs/migration-remaining/results/S07-04.md`,
`logs/s07-04-qe-orphans.log`) recomputed MISSING=13,650 and ORPHAN=1,523
with zero drift vs §3; both sets carry real ticket-detail rows, so the
13,650-row import set (incl. the 1,523 orphans) upserts into `qe_fd_cache`
on `id`.

## Summary (post-run state, S06-12)

Every store now has a final state with evidence (`audits/migration-run-2.md`,
`logs/`, `decisions-*.md`, `results/S06-*.md`): migrated hct→dq_hct, v1_ops
Tasks→actions, oct_workbook→scRefreshMonth_, voice/text→qa_audits,
daily_report Freshchat→freshchat, fc_messages→fc_messages mirror — all live
writes PENDING-APPROVAL · covered fd_activity (gap 873, backfill staged) ·
rejected qa_queue + FD dumps ⊆tickets. S06 resolved the former `reshard:`
flags: v1_ops 17 tabs → 9 migrated (sched_plan/overrides/team/offdays/
requests, one_on_one_logs ×2, sched_config, v1_task_occurrences) + 8
rejected; oct {Transcript→call_transcripts, AUXes Exceptions→
tracker_records}; daily_report {WA→tracker_records('wa_parcels'), CTL&
Quality A..J→qa_ctls}; NTD ×2 → gap-backfill `backfill-fd-history.ts`
(495,825 unique would_write, `--write` PENDING-APPROVAL). S07 closed the
remaining S07-scope flags: `FD_AUX`→`aux_spans` migrated (`dedupe_key`
upsert, verbatim A..G via `col_e/f/g`; `logs/s07-02-fdaux.log` rows=13,064;
dry/live PENDING-APPROVAL); `qa_ctls.agent_email` mapped from the first
`Agent Email` occurrence (`specs/migration-remaining/results/S07-03.md`);
`Ticket Detail Cache` orphans → `qe_fd_cache` import set
(`specs/migration-remaining/results/S07-04.md`,
`logs/s07-04-qe-orphans.log`; `--write` PENDING-APPROVAL); validator
round-2 caveat lifted — transforms executed, `oct_workbook` registered
(`results/S07-05.md`, `logs/s07-05-validate.log`). Retained flag:
Aug-2026 workbook `10rpLZ…` = **`blocked: share pending`** (S06-11
NEEDS_USER — owner must share to the SA before any 2026-08
scRefreshMonth_).
