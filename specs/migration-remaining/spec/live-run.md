# Live execution runbook leaves (APPROVED 2026-11-09)

Approval-gated runs from TRACKER "Blocked / needs user". Serial dependency:
LIVE-01 -> LIVE-02 -> LIVE-03 -> LIVE-04 -> LIVE-05. On ANY failure: stop,
report the verbatim error in results/<id>.md; no improvised or destructive
fixes (NEEDS_USER path). S06-11 / productivity_files['2026-08'] stays blocked.

## LIVE-01: apply the 6 pending migration files to the live project
Kind: mini
ID: LIVE-01
Parent: live-run
Owner: supabase-expert
Depends: none
Criteria: TRACKER NEEDS_APPROVAL rows 1 (dedupe x3, fc_messages, dq_hct, s06_new_tables)
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase-postgres-best-practices\SKILL.md
Budget: files=1; actions=5; changed_lines=80; minutes=10

### Goal
All 6 pending migration files applied to the live project via Supabase MCP,
with apply NOTICEs captured and reconciled vs the S08-03 NULL-probe answers.

### Files
- Create: `specs/migration-remaining/logs/live-01-apply.log` | per-file apply output + NOTICEs

### Context
- `supabase/migrations/` | apply in name order: 20261109130415_dedupe_uniques_logs_ops, 20261109130633_dedupe_uniques_people_sched, 20261109130706_dedupe_uniques_queue_agg, 20261109131136_fc_messages, 20261109131140_dq_hct_table, 20261109134359_s06_new_tables
- `specs/migration-remaining/logs/null-key-probes.md` | S08-03: all 14 live probes = 0, so dedupe DO blocks must take the natural-key ELSE branch
- `specs/migration-remaining/results/S09-02.md` | apply versions MUST be the on-disk edited files (pgcrypto sha1 dedupe_key backfill)

### Contract
Apply the file contents exactly as on disk (MCP apply_migration per file).
Expected: the 3 dedupe files' NOTICEs show the natural-key branch (no
NULL/dup probe fired); fc_messages/dq_hct/s06_new_tables create their tables.
Out of scope: editing any migration file, `supabase db push`, any data
upserts, repairing a failed apply (stop + report instead).

### Actions
1. Apply the 3 dedupe files in name order; log NOTICE output per file.
2. Reconcile NOTICEs vs null-key-probes.md (branch taken = ELSE expected).
3. Apply 20261109131136_fc_messages.sql then 20261109131140_dq_hct_table.sql.
4. Apply 20261109134359_s06_new_tables.sql; confirm aux_spans, call_transcripts, v1_task_occurrences + tracker seeds exist.
5. Write the log + results/LIVE-01.md (status per file, branch confirmation).

### Done when
- All 6 applies succeed; log holds per-file NOTICEs.
- Dedupe NOTICE branch matches S08-03 probes (ELSE) or divergence is reported.

### Verify
- Run: `MCP execute_sql: select version from supabase_migrations.schema_migrations where version in ('20261109130415','20261109130633','20261109130706','20261109131136','20261109131140','20261109134359')` -> 6 rows returned.

### Handoff
Green light for LIVE-02/LIVE-03 live upserts (DDL-before-upserts satisfied).
Write results/LIVE-01.md (<=10 lines); TL alone updates TRACKER.md.

## LIVE-02: live migrate-all --tables runs (dq_hct, actions, 13 S06 mappings, aux_spans+qa_ctls)
Kind: mini
ID: LIVE-02
Parent: live-run
Owner: data-engineer
Depends: LIVE-01
Criteria: TRACKER NEEDS_APPROVAL rows (dq_hct,actions; 13 S06 mappings; aux_spans,qa_ctls)
Skills: none
Budget: files=3; actions=6; changed_lines=150; minutes=10

### Goal
The remaining unmapped tables are live-migrated: dq_hct + actions, the 13
S06 mappings, then aux_spans + qa_ctls re-run (agent_email fill).

### Files
- Create: `specs/migration-remaining/logs/live-02a-dqhct-actions.log` | full run output
- Create: `specs/migration-remaining/logs/live-02b-s06.log` | full run output
- Create: `specs/migration-remaining/logs/live-02c-aux-ctls.log` | dry + live output

### Context
- `migration/migrate-all.ts:19-21` | `--tables a,b,c` filter, `--dry` flag
- `src/features/shared/migration/mappings/` | table targets: hct.ts (dq_hct), v1-ops.ts (actions), v1-ops-sched/people/misc.ts, ops-tabs.ts (aux_spans, qa_ctls, call_transcripts, tracker_records)
- `specs/migration-remaining/TRACKER.md` gate log | 9 pre-existing tab-name READ FAILEDs are expected, not regressions

### Contract
Run only the listed --tables sets, in order, from project root. qa-7 caveat:
dq_hct output should show ~8 dup-key same-email collapses — eyeball/record
them. qa_ctls runs twice: once inside the S06 set, again with aux_spans
(agent_email via ctl_id upsert). Out of scope: other tables, --write
backfills (LIVE-03), fixing READ FAILEDs, editing any code or config.

### Actions
1. `npx tsx migration/migrate-all.ts --tables dq_hct,actions` -> log 02a; record dq_hct collapse lines.
2. `npx tsx migration/migrate-all.ts --tables sched_plan,sched_overrides,sched_team,sched_offdays,sched_requests,one_on_one_logs,sched_config,v1_task_occurrences,call_transcripts,tracker_records,qa_ctls` -> log 02b.
3. `npx tsx migration/migrate-all.ts --dry --tables aux_spans` -> confirm rows read, append to log 02c.
4. `npx tsx migration/migrate-all.ts --tables aux_spans,qa_ctls` -> append to log 02c.
5. Record per-table written/skipped counts + any non-pre-existing failures.
6. Write results/LIVE-02.md.

### Done when
- All four commands exit=0; counts logged per table.
- Failures limited to the 9 known pre-existing READ FAILEDs, or divergences reported.

### Verify
- Run: `npx tsx migration/validate.ts --md` -> exit=0; migrated tables show db rows > 0.

### Handoff
Per-table live counts for LIVE-05 doc refresh; sched_plan populated for the
LIVE-04 idempotency re-run. Write results/LIVE-02.md (<=10 lines).

## LIVE-03: the six --write backfill scripts
Kind: mini
ID: LIVE-03
Parent: live-run
Owner: data-engineer
Depends: LIVE-01
Criteria: TRACKER NEEDS_APPROVAL rows (S04-03..07, S06-09, S07-04 backfills)
Skills: none
Budget: files=1; actions=9; changed_lines=120; minutes=10

### Goal
Every approved --write backfill runs once against the live DB, each logged.

### Files
- Create: `specs/migration-remaining/logs/live-03-backfills.log` | concatenated per-script output

### Context
- `migration/` script headers | each defaults to dry/probe; `--write` gates the upsert path; `.env.local` SUPABASE vars required (already present for prior runs)
- `specs/migration-remaining/results/S07-04.md` | chosen set = MISSING (`--write`, 13,650 upserts onConflict id); do NOT use `--write=orphan`
- `specs/migration-remaining/results/S06-09.md` | fd-history would_write=495,825 dedupe-keyed

### Contract
Run each command once, in this order, appending output to the log:
`npx tsx migration/backfill-freshchat-sheet.ts --write`;
`npx tsx migration/run-fd-mirror.ts --write`;
`npx tsx migration/run-qa-history.ts --write`;
`npx tsx migration/run-sc-refresh.ts --write` (refreshes configured
productivity_files months only — today 2026-09; never add 2026-08);
`npx tsx migration/backfill-fc-messages.ts --write`;
`npx tsx migration/backfill-fd-history.ts --write`;
`npx tsx migration/backfill-qe-cache-orphans.ts --write`.
Stop the sequence on a non-zero exit; report which script failed + tail.
Out of scope: `--write=orphan`, month/config edits, any other script, re-runs.

### Actions
1. Run `npx tsx migration/backfill-freshchat-sheet.ts --write`, append output to the log.
2. Run `npx tsx migration/run-fd-mirror.ts --write`, append output.
3. Run `npx tsx migration/run-qa-history.ts --write`, append output.
4. Run `npx tsx migration/run-sc-refresh.ts --write`, append output.
5. Run `npx tsx migration/backfill-fc-messages.ts --write`, append output.
6. Run `npx tsx migration/backfill-fd-history.ts --write`, append output.
7. Run `npx tsx migration/backfill-qe-cache-orphans.ts --write` (MISSING set only), append output.
8. Record per-script exit code + written/upserted counts in the log tail.
9. Write results/LIVE-03.md.

### Done when
- All 7 exit=0 with per-script write counts logged, or the failing script +
  verbatim error is reported and remaining scripts are NOT run.

### Verify
- Run: `npx tsx migration/validate.ts --md` -> exit=0; no new SRC-FAIL rows vs the round-6 baseline.

### Handoff
Per-script live counts for LIVE-05. Write results/LIVE-03.md (<=10 lines).

## LIVE-04: PLAN #5 idempotent targeted re-run (0 new rows)
Kind: mini
ID: LIVE-04
Parent: live-run
Owner: data-engineer
Depends: LIVE-02
Criteria: PLAN #5 (real targeted re-run on one table producing 0 new rows)
Skills: none
Budget: files=1; actions=4; changed_lines=40; minutes=5

### Goal
Prove dedupe-keyed upserts are idempotent live: re-running one migrated
table inserts 0 new rows.

### Files
- Create: `specs/migration-remaining/logs/live-04-idempotent.log` | before/after counts + run output

### Context
- `specs/migration-remaining/logs/live-02b-s06.log` | sched_plan live count from LIVE-02
- `specs/migration-remaining/results/S10-06.md` | dupSkipped reconciliation semantics (read = migrated + skipped)

### Contract
Target table = sched_plan (S09/S10 sha1 dedupe_key path). Re-run must add
no rows. Out of scope: re-running other tables, any --write script,
deleting rows to force a diff.

### Actions
1. Read current sched_plan row count (supabase) -> log.
2. `npx tsx migration/migrate-all.ts --tables sched_plan` -> log output.
3. Re-read row count; diff must be 0 (dup-skips = rows read).
4. Write results/LIVE-04.md.

### Done when
- Row-count delta = 0; exit=0; evidence logged.

### Verify
- Run: `npx tsx migration/migrate-all.ts --tables sched_plan` -> exit=0, 0 new rows.

### Handoff
PLAN #5 satisfied; evidence line for LIVE-05 + tl-7 report.
Write results/LIVE-04.md (<=10 lines).

## LIVE-05: refresh PENDING-APPROVAL cells to post-run state
Kind: mini
ID: LIVE-05
Parent: live-run
Owner: tech-writer
Depends: LIVE-02,LIVE-03,LIVE-04
Criteria: PLAN #6 (run-2 ledger + inventory reflect post-run state)
Skills: none
Budget: files=2; actions=4; changed_lines=80; minutes=10

### Goal
Every PENDING-APPROVAL cell in the run-2 ledger and source inventory is
replaced by the actual live outcome (count or final state).

### Files
- Edit: `specs/megaplan/audits/migration-run-2.md` | PENDING-APPROVAL cells only
- Edit: `specs/migration-remaining/source-inventory.md` | PENDING-APPROVAL cells only

### Context
- `specs/migration-remaining/results/LIVE-0{1,2,3,4}.md` + `specs/migration-remaining/logs/live-0*.log` | the only sources for the new numbers
- `specs/migration-remaining/TRACKER.md` Blocked section | which approvals were pending

### Contract
Replace each PENDING-APPROVAL marker with the live result (applied /
written=N / migrated=N / 0-new-rows) citing the results file. Keep the
S06-11/Aug-2026 blocked state and deferred LOW findings verbatim — they
are NOT resolved by this run. Out of scope: rewriting history sections,
other docs, code, results/ files.

### Actions
1. Grep both files for PENDING-APPROVAL; map each cell to its run.
2. Fill run-2 cells from LIVE-02/03/04 evidence.
3. Fill source-inventory cells (per-store final states) likewise.
4. Write results/LIVE-05.md listing cells touched.

### Done when
- `grep -c PENDING-APPROVAL` = 0 in both files (S06-11 blocked state kept).
- Every filled cell cites a results/log file.

### Verify
- Run: `git diff --stat -- specs/megaplan/audits/migration-run-2.md specs/migration-remaining/source-inventory.md` -> only those 2 files changed.

### Handoff
Post-run ledger state for the tl-7 report + PM review gates.
Write results/LIVE-05.md (<=10 lines).
