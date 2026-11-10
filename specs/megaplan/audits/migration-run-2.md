# Migration run 2 — post-WP-51 audit ledger (dry-run + CLI evidence; live writes PENDING-APPROVAL)

> **Status: PARTIAL — honest dry-run ledger.** All code/mapping work (S02–S05) is
> done and verified read-only; every remote write is approval-gated and has NOT
> been executed. Columns follow `migration-run.md` §2: **read** = sheet rows
> read · **migrated** = rows written · **skipped** = require-filter/dup drops ·
> **result**. Cells marked `PENDING-APPROVAL` await the PM-gated live run.
>
> Evidence inputs: `specs/migration-remaining/results/S0*-*.md`,
> `specs/migration-remaining/logs/{dry-run-2,fc-dry,fcmsg-dry,fd-check,qa-probe,sc-probe,readonly-proof,validate-2}.log`.

---

## 1. Headline

**87/96 mappings read clean in `--dry` + 9 pre-existing absent-tab `READ FAILED`s (exit=0, `dry-run-2.log`); two new mappings land (`dq_hct` 60 rows, `actions`←v1_ops 18 rows); 5 approval-gated write paths staged with dry counts; 23 insert-only tables flipped to `upsertOn` + 4 dedupe/unique migrations authored — none applied remotely.** PLAN criteria #1/#6 close out as documented; #2–#5 await the gated runs.

| Metric | Value |
|---|---|
| Mappings in engine | 96 (was 94; +hct, +v1_ops) |
| New-mapping dry reads | dq_hct←hct/Sheet1 **60** · actions←v1_ops/Tasks **18** |
| Backfill dry counts | freshchat 1,602 unique · fd_activities gap **873** · qa_audits voice 4,076 + text 1,709 would-import · scRefreshMonth_ 2026-09 (480 rows prior run) · fc_messages **82,805** unique |
| Dedupe/unique migrations authored | 4 (`20261109130415` logs_ops · `…130633` people_sched · `…130706` queue_agg · `…131140` dq_hct) + `…131136` fc_messages — **all NEEDS_APPROVAL, none applied** |
| Insert-only upsertOn flips | 23/23 mappings (S02-04..S02-08), pending apply-time NOTICE re-check |
| Hard failures in dry/CLIs | 0 (9 pre-existing B6 `READ FAILED` on absent tabs — expected) |
| Read-only proof | `readonly-proof.log`: 0 `values.update|append|batchUpdate` matches; only `spreadsheets.readonly` scope |

## 2. New mappings (engine run — `migrate-all.ts --dry` verified)

| Table | read | migrated | skipped | Result |
|---|---|---|---|---|
| dq_hct | 60 | PENDING-APPROVAL | PENDING-APPROVAL | staged — `hct.ts` mapping + `20261109131140_dq_hct_table.sql` (UNIQUE email, RLS deny-all) authored; dry read clean |
| actions (v1_ops) | 18 | PENDING-APPROVAL | PENDING-APPROVAL | staged — `v1-ops.ts` mapping (`action_id='v1-'+id`, source_type='v1'); TaskOccurrences 352 rows excluded by design |

## 3. Backfill CLIs (dry/probe counts; `--write` PENDING-APPROVAL)

| Store → target | read | unique/would-write | skipped | Result |
|---|---|---|---|---|
| daily_report `Freshchat` → `freshchat` | 1,742 | 1,602 | 140 (Map-dedupe) | `backfill-freshchat-sheet.ts --dry` exit=0 (`fc-dry.log`); upsert onConflict `dedupe_key` — write gated |
| fd_activity `Activities` → `fd_activities` | 208,706 | expected unique 208,684 (22 dup tuples collapse) | 0 unparseable | `--check` exit=0: remote 207,811, max ts 2026-11-09T05:49:49Z, **gap=873** (`fd-check.log`); `syncMirror(full:true)` write gated |
| voice `Form Responses 1` → `qa_audits` | 9,230 | 4,076 | 5,154 | `run-qa-history.ts --probe` exit=0 (`qa-probe.log`); resumes at `QE_HIST_*` cursors |
| text `Form Responses 1` → `qa_audits` | 4,038 | 1,709 | 2,329 | same probe run; unmatched=0 both stores |
| oct_workbook → `scRefreshMonth_` | configured months from `productivity_files` | 2026-09 only (prior `sc_months` run: 480 rows, status=ok) | — | `run-sc-refresh.ts --probe` exit=0 (`sc-probe.log`); `--write` loops configured months, never hard-codes |
| fc_messages tabs → `fc_messages` mirror | 82,805 (auto 73,536 + manual 9,269 + Sheet1 empty) | 82,805 | 0 null_ts | `backfill-fc-messages.ts --dry` exit=0 (`fcmsg-dry.log`); sha1 dedupe_key, upsert onConflict `dedupe_key` — write gated |

## 4. Dedupe pass (PLAN #5) — staged, not applied

| Step | Status | Evidence |
|---|---|---|
| Dedupe DELETE + UNIQUE DDL | PENDING-APPROVAL | 4 migrations authored (S02-01/02/03); fallback rule: NULL-key tables get `dedupe_key`+`*_dedupe_key_uidx` per apply-time NOTICE — re-read NOTICEs before trusting natural keys |
| `upsertOn` flips (23 mappings) | code done, live-unverified | queue-quality.ts (S02-04/05), people-core.ts (S02-06/07), route-core.ts qa_volume (S02-08); tsc exit=0 all |
| Targeted re-run (expect 0 new rows) | PENDING-APPROVAL | blocked on DDL apply + approval; `mail_log` upsertOn written unquoted `to` (S02-07 note — PostgREST on_conflict quoting flag for TL) |

Engine note (S10-06): upsertOn dup-collapses now count as `dupSkipped` inside `skipped` (require-drops + dupSkipped), so `read = migrated + skipped` reconciles. NULL-key cells stringify to `'null'` — dedupes within a run but never conflicts remotely: residual dup-per-run risk, currently 0 NULLs in 14/14 probes (`specs/migration-remaining/logs/null-key-probes.md`).

## 5. Read-only proof (PLAN #7)

`git grep -nE "values\.(update|append)|batchUpdate" -- migration/ src/features/shared/migration/` → **0 matches** (`readonly-proof.log`, grep exit=1); only `spreadsheets.readonly` scope strings (8 files). SA keyfile path unchanged.

## 6. Known open items carried forward

- `qa_queue` store rejected as live V1 working store; `Ticket Detail Cache` (25,295 rows) vs `qe_fd_cache` (11,645) parity check still owed before final sign-off.
- `New Tickets Daily` ×2 (`reshard:` tabs in touch_archive + qa_engine_source) need min/max `Performed At` vs `fd_activities` window check.
- Aug-2026 productivity workbook `10rpLZ…` returns 403 — owner must share before any 2026-08 `scRefreshMonth_`.
- 9 pre-existing B6 absent-tab `READ FAILED`s in dry-run — expected, documented.

---

## 7. S06 additions — v1_ops/ops-tabs mappings, NTD backfill, Aug-2026 month

S06 leaves (decisions `decisions-v1-ops.md`, `decisions-ops-tabs.md`,
`decisions-coverage.md`; mappings wired by S06-10, tsc exit=0). All live
writes and dry counts below are **PENDING-APPROVAL** — the gated
`migrate-all --dry`/`--write` runs have not executed.

### 7a. New mapping tables (engine modules `v1-ops-sched.ts`, `v1-ops-people.ts`, `v1-ops-misc.ts`, `ops-tabs.ts`)

| Table | read | migrated | skipped | Result |
|---|---|---|---|---|
| sched_plan ← v1_ops:ShiftPlan | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `dedupe_key` (`mig-<index>`), segments_json transform; colA=241 |
| sched_overrides ← v1_ops:ShiftOverrides | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `tl_email,date`; note JSON {reason,wfh}; colA=127 |
| sched_team ← v1_ops:TeamLeads | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `tl_email`; colA=6 |
| sched_offdays ← v1_ops:TLOffDays | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `tl_email,date`; date `"<month>:<offDays>"`; colA=20 |
| sched_requests ← v1_ops:ShiftRequests | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `request_id`; colA=6 |
| one_on_one_logs ← v1_ops:AgentOneOnOnes + OneOnOnes | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `log_id`; kinds `v1_agent_1on1`/`v1_tl_1on1`; colA=37+9 |
| sched_config ← v1_ops:Settings | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `key`; verbatim key/value; colA=17 |
| v1_task_occurrences ← v1_ops:TaskOccurrences | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `occurrence_id`; DDL `20261109134359` NEEDS_APPROVAL; colA=353 |
| call_transcripts ← oct_workbook:Transcript | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `dedupe_key` sha1(Call ID+Start time); cols A..H verbatim; colA=5,607 |
| aux_spans ← oct_workbook:FD_AUX | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `dedupe_key`; verbatim A..G via `col_e/f/g` (`logs/s07-02-fdaux.log` rows=13,064); dry/live PENDING-APPROVAL; colA=13,065 |
| tracker_records ← daily_report:WA (`wa_parcels`) + oct_workbook:AUXes Exceptions (`aux_exceptions`) | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `(tracker_id, record_id)`; S06-04 seeds trackers/fields; colA=206+59 |
| qa_ctls ← daily_report:`CTL & Quality` A..J | PENDING-APPROVAL | PENDING-APPROVAL | PENDING-APPROVAL | staged — upsertOn `ctl_id='hist-<Call ID>'`; `agent_email` mapped from first `Agent Email` occurrence (col A; `agent email#2` echo unmapped; `specs/migration-remaining/results/S07-03.md`); CTL block N..R rejected ⊆qa_audits; colA=1,789 |

v1_ops rejected tabs (no table): `IdentityPins` (credentials),
`RoadmapVisibility`, `HourOverrides`, `Agents`, `KPI`, `Tickets`, `HardCases`,
`Standups` — all header-only/empty (`decisions-v1-ops.md`).

### 7b. Backfill CLI — NTD gap fill

| Store → target | read | unique/would-write | skipped | Result |
|---|---|---|---|---|
| touch_archive `New Tickets Daily` + qa_engine_source `New Tickets Daily` → `fd_activities` | 430,055 + 165,461 | 495,825 (5,148 dupes collapsed) | 0 unparseable | `backfill-fd-history.ts --dry` exit=0, writes=0 (`logs/fdhist-dry.log`); both tabs `gap` dual-sided vs fd_activities window (decisions-coverage.md); `--write` upsert PENDING-APPROVAL |

### 7c. scRefreshMonth_ month add — 2026-08

| Month → workbook | read | migrated | skipped | Result |
|---|---|---|---|---|
| 2026-08 → `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg` | blocked | blocked | — | **`blocked: share pending`** — S06-11 NEEDS_USER (workbook 403 to SA); after share, `probe-aug-workbook.ts` verdict gates `productivity_files['2026-08']` setConfig + `run-sc-refresh.ts --write` |

### 7d. S07 closeout — reshard flags resolved

| Item | Final state | Evidence |
|---|---|---|
| oct_workbook:`FD_AUX` -> `aux_spans` | migrated mapping staged; `dedupe_key` upsert; verbatim A..G via `col_e/f/g`; dry/live PENDING-APPROVAL | `specs/migration-remaining/logs/s07-02-fdaux.log` (rows=13,064) |
| daily_report:`CTL & Quality` -> `qa_ctls.agent_email` | mapped from first `Agent Email` occurrence (col A); audit-echo `agent email#2` unmapped | `specs/migration-remaining/results/S07-03.md` |
| qa_queue `Ticket Detail Cache` -> `qe_fd_cache` | store stays rejected; 13,650-row import set incl. 1,523 orphans upserts on `id`; `--write` PENDING-APPROVAL (supersedes §6 carried-forward caveat) | `specs/migration-remaining/results/S07-04.md`, `specs/migration-remaining/logs/s07-04-qe-orphans.log` |
| migration validator | round-2 caveat lifted: sibling transforms executed once, `oct_workbook` registered; targeted `--md` verify exit=0 | `results/S07-05.md`, `specs/migration-remaining/logs/s07-05-validate.log` |

## §8 — Live run outcome (2026-11-09/10, PM-executed, APPROVED)

All pending DDL applied via direct Postgres (`aws-1-eu-central-1.pooler.supabase.com`; MCP lacked DB scope): dedupe_uniques ×3, fc_messages, dq_hct, s06_new_tables — recorded in `schema_migrations`; natural-key NOTICEs only. `refresh_log` dedupe tie-break fixed to `ctid` in-file (table has no `id` col).

Live rows landed (all upsert-idempotent where marked): dq_hct 51 (2 same-email job-stint collapses, last-wins kept latest-status) · actions 42 · one_on_one_logs 48 · sched_plan 229 · sched_overrides 286 · sched_offdays 27 · sched_team 5 · sched_requests 5 · sched_config 18 · qa_ctls 1,863 · aux_spans 13,086 · call_transcripts 5,606 · v1_task_occurrences 349 · tracker_records 2,376 · fc_messages 84,707 · freshchat 1,753 · fd_activities 705,968 (fd-mirror 210k + fd-history 495.8k upserts) · qe_fd_cache 25,295 (missing 13,650 + orphan 1,523 resolved) · qa_audits 12,344 (qa-history 5,785 imported) · sc_* refreshed (sc_daily 1,153).

Owner decisions applied: sched_overrides/offdays audit cols DROPPED from mappings (setBy/setAt/note not migrated); manager_email mohamed.nabil@dabdoob.com confirmed. Fixes during run: NULL_AS_EMPTY tracker_records; qe-orphans batchGet BATCH 500→150 (URL limit) + 429 pacing/retry.

Idempotent re-run proof (PLAN #5): sched_offdays 27 → re-ran 19 upserts → 27 (0 net new). PASS.

**Still open:** Aug-2026 workbook `10rpLZ…` share to SA (S06-11) → then productivity_files['2026-08'] config + sc-refresh. Gmail/Calendar/Drive → WP-52. Freshchat API → WP-53.
