# S10: data-1 findings fix package (FIX mode)
Kind: package
Parent: root
Depends: S02..S09 complete; findings reports/data-1.md (every row blocking)

## Findings -> leaves
| Finding | Sev | Leaf | Owner | Outcome |
|---|---|---|---|---|
| data-1 | HIGH | S10-01 | data-engineer | refresh_log log_id mint reverted to positional 'mig-'+ctx.index (matches 8,197 live WP-51 rows; DDL uniques log_id, no backfill exists) |
| data-2 | MED | S10-02 | data-engineer | validate.ts: every mapping contributes src/skips — no last-wins shadowing on dual-source tables (qa_ctls, one_on_one_logs, tracker_records, sched_*) |
| data-3 | MED | S10-03 | data-engineer | source-inventory.md §5: 'Form Responses 1' 3,037 -> 4,038 data rows (grid 4,039) |
| data-4 | MED | S10-04 | data-engineer | backfill-fd-history.ts: split in_gap into left/right tails + count future-dated rows before --write |
| data-5 | LOW | S10-05 | data-engineer | migration-run-2.md headline 87/96 + migration-report.md run-2 refresh (124 tables, S06/S07 final states) |
| data-6 | LOW | S10-06 | data-engineer | engine.ts dup-skip counter reconciles read=migrated+skipped; run-2 §4 NULL-key residual note |
| data-7 | LOW | S10-07 | data-engineer | source-inventory.md: Sep-2026 title fix + Freshchat colA-vs-read ±1 note |

Serialisation (shared files): S10-06 Depends S10-05 (migration-run-2.md);
S10-07 Depends S10-03 (source-inventory.md). Everything else is disjoint.
Wave 1: S10-01, S10-02, S10-04, S10-05. Wave 2: S10-03, S10-06. Wave 3: S10-07.
