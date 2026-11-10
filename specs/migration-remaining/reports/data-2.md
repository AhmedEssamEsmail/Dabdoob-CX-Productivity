# data report - migration-remaining - round 2 (DELTA)

Verdict: PASS        (FAIL if any BLOCKER/HIGH/MED open)
Open: 0/0/0/1

Round-1 findings re-checked against tl-6 fixes — all 7 CLOSED:

| ID | Sev | Verification |
|---|---|---|
| data-1 | HIGH → closed | queue-quality.ts:524-527 mint reverted to `'mig-'+ctx.index`; `upsertOn:'log_id'` (l.168) so re-run keys collide with the 8,197 WP-51 rows; DDL `20261109130415` l.19-31 dedupes+uniques `log_id` and was authored against the positional mint. dedupe-key.test.ts:64-82 asserts positional; 13/13 vitest. |
| data-2 | MED → closed | validate.ts `InventoryEntry.mappings[]` + `mapKey` store+sheet dedupe (l.681-738); per-mapping read/transform/skip accumulation (l.973-1035); `combined` flag + ledger lines. s10-validate.log: 11 combined rows; `qa_ctls [CTL & Quality]: 16 dup ctl_id` now visible (was shadowed). |
| data-3 | MED → closed | source-inventory.md §5 l.102: 4,038 data rows ✓ |
| data-4 | MED → closed | backfill-fd-history.ts `gapSide` + `future` counter (l.72-76, 153-164); s10-fdhist-dry.log emits left/right/future per sheet and TOTAL. |
| data-5 | LOW → closed | migration-run-2.md l.16 headline "87/96 + 9 pre-existing absent-tab READ FAILEDs"; migration-report.md l.380: 124 tables, S06/S07 final states, no stale "17 reshard" line. |
| data-6 | LOW → closed | engine.ts:253-262 `dupSkipped` folded into `skipped` (read=migrated+skipped reconciles); migrate-all.ts prints `dup=`; run-2 §4 NULL-key residual note (l.54). |
| data-7 | LOW → closed | source-inventory.md §3 title Sep-2026 (l.52); §6 colA(1,741)-vs-read=1,742 ±1 note (l.114-116). |

Reconciliation (independent recompute vs cited evidence, tolerance 0):
- s10-fdhist-dry.log: left 187,460+26,428=213,888 ✓; right 192,991+94,094=287,085 ✓; 213,888+287,085=500,973=in_gap ✓; future 187,933+94,053=281,986 ✓; read 595,516 ✓; unique 495,825 unchanged.
- s10-validate vs tl6-dry per-mapping src: qa_ctls 1,788+87=1,875 ✓ · one_on_one_logs 4+36+8=48 ✓ · tracker_records 58+223=281 ✓ · sched_overrides 163+126=289 ✓ · sched_config 2+16=18 ✓ · sched_offdays 8+19=27 ✓ · actions 24+18=42 ✓ · prod_daily_layers 617+1,188=1,805 ✓ · sched_plan/requests/team = v1-only src + per-mapping "unreadable" ledger lines (validate l.221-227) ✓.
- tl6-dry.log: 110 mapping lines, 101 read + 9 READ FAILEDs (all pre-existing absent tabs) = tl-6 claim ✓; refresh_log src 9,053.
- Gates: tl6-vitest.log 60 files/1,161 tests PASS (dedupe-key 13/13); tl6-tsc/eslint empty=PASS; tl6-readonly.log empty = 0 write-call matches.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-8 | LOW | reports/tl-6.md:39-40 | Claims tl6-dry "output identical to tl5-dry PASS" — diff shows 12 count lines drifted (tickets +28, refresh_log 9,044→9,053, aging −10, agg_snapshots_today +16, queue_snapshots +16, popups +4, mail_log +4): all live-sheet append growth; coverage truly identical (101/110 + 9 fails). | Reword to "same coverage; counts drifted with live sheets" (or re-baseline the diff). | data-engineer |

Not verified / assumptions:
- Remote `refresh_log.log_id` values not SELECTed (no MCP; PostgREST counts only) — closure rests on the reverted mint matching WP-51's documented positional convention; the gated targeted re-run remains the proof.
- Positional mint assumes append-only sheet order — same assumption WP-51 ran under (transform indexes raw rows pre-filter, so require-drops can't shift keys).
- data-4 residual: `future=281,986` right-tail rows still write on `--write`; flagged for the approval runbook per tl-6 §residuals.
- `skipped` reconciliation holds only on batch success; batch errors reduce `migrated` without a skip bucket (pre-existing, errors surfaced separately).
- All writes remain PENDING-APPROVAL; review was read-only (0 mutations).
