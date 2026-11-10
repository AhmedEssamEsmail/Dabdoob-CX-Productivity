# tl-8 — live-run wave: LIVE-01 done (PM), LIVE-02 partial-fail -> halted

Mode BUILD, task migration-remaining, APPROVED live run. Serial runbook
spec/live-run.md LIVE-01..05. TRACKER.md holds full row state.

## LIVE-01 (apply 6 migrations) — DONE via PM, not worker
MCP PAT denied all SQL paths (earlier results/LIVE-01.md). PM applied all 6
files via direct pg 2026-11-09: `migration/logs/apply-ddl.log` = 6/6 OK.
NOTICEs show natural-key conflict targets only (ticket_id; queue,kind;
period,channel,country; email,period; date,email; snapshot_key;
date,channel,contact_type) — the ELSE branch, matching S08-03's 14/14 = 0
NULL-probes. refresh_log dedupe tie-break was fixed to ctid in-file before
apply. No dedupe_key conflict-target flips.

## LIVE-02 (migrate-all --tables) — PARTIAL, halted per runbook
Worker `633323ab` (data-engineer) stopped on first non-zero exit, no fixes.

- `logs/live-02a-dqhct-actions.log` exit=0: dq_hct read=60 migrated=51
  skipped=9 dup=2 (~9-11 same-email collapses vs qa-7 ~8 — eyeballed,
  divergence flagged); actions 24+18=42.
- `logs/live-02b-s06.log` exit=1, 7 errors = 3 expected tab-name READ
  FAILEDs (sched_team/sched_requests/sched_plan first maps) + 3 real:
  1. `sched_overrides`: column 'submitted_at' not in schema cache.
     Root cause: mapping v1-ops-sched.ts:62-65 emits submitted_by+submitted_at
     (sheet setBy/setAt); live DDL 007_queue.sql:118-122 has neither column.
  2. `sched_offdays`: column 'note' missing. Mapping (same file, :87-90)
     emits note+submitted_by+submitted_at; live DDL (007:114-117) has none.
  3. `tracker_records` (AUXex 58 + WA 223): submitted_by NOT NULL violation.
     Root cause: transforms set '' (ops-tabs.ts:162,184) but mapRow re-nulls
     '' (engine.ts:191-196) — tracker_records absent from NULL_AS_EMPTY
     (desk-operations.ts:327-359, whose docblock predicts this exactly).
- 02c (`--dry aux_spans`; `--tables aux_spans,qa_ctls`) never ran; validate
  not run. Committed live before halt: dq_hct 51, actions 42, sched_config 18,
  sched_team 5, sched_requests 5, sched_plan 229(+11 dup), one_on_one_logs 48,
  qa_ctls 1863, v1_task_occurrences 349/352, call_transcripts 5606,
  tracker-bf 2098 (all upsert-idempotent).

## Held
LIVE-03 (7 --write backfills), LIVE-04 (sched_plan idempotent re-run),
LIVE-05 (PENDING-APPROVAL doc refresh) — serial order preserved; all deps
met except the halted LIVE-02 remainder.

## NEEDS_USER (decision belongs to PM/owner, not shards)
- (a) sched_overrides/sched_offdays audit columns: new ALTER migration +
  apply approval (keeps setBy/setAt/note sheet data) OR mapping drops the
  columns (loses them). Recommend (i) — data exists in the sheets.
- (b) tracker_records: code fix `NULL_AS_EMPTY['tracker_records']=
  ['submitted_by']` — no DDL; then re-run the 3 tables + aux/ctls steps.
- qa-7: observed collapses slightly above estimate — confirm acceptable.

Leaves: LIVE-01 done; LIVE-02 blocked(partial); LIVE-03/04/05 pending.
S06-11 remains blocked on the Aug-2026 workbook share (unchanged).
No shard ever requested a forbidden reviewer role this round.
