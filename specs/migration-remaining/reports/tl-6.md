# tl report - migration-remaining - round 6 (FIX: reports/data-1.md)

Verdict: all 7 blocking findings fixed; round-6 integration gates PASS.

## Dispatch
Created fix package `spec/S10/` (00-index + 7 mini leaves, preflight
check_shards.py PASS x7). All owners = data-engineer per the report's Owner
column. Waves (max 4, shared-file writers serial):
- W1: S10-01, S10-02, S10-04, S10-05 (disjoint files)
- W2: S10-03, S10-06 (S10-06 after S10-05 — shared migration-run-2.md)
- W3: S10-07 (after S10-03 — shared source-inventory.md)

## Findings -> evidence
| ID | Leaf | Status | Evidence |
|---|---|---|---|
| data-1 HIGH | S10-01 | done | queue-quality.ts:524-527 refresh_log mint reverted to `'mig-'+ctx.index`; comment explains 8,197 live WP-51 rows + no DDL backfill; `dedupeKey_` kept only for sched_plan/QaAccessLog; test describe asserts positional; 13/13 tests, tsc=0 |
| data-2 MED | S10-02 | done | validate.ts `InventoryEntry.mappings[]`, per-mapping store/sheet read + transform + src/skip accumulation; `combined` flag + per-mapping ledger lines; qa_ctls src=1875 (1,788+87), one_on_one_logs 3-way 48; 11 tables combined; --md exit=0, still 124 rows |
| data-3 MED | S10-03 | done | source-inventory.md §5 l.102: 3,037 -> 4,038 data rows |
| data-4 MED | S10-04 | done | backfill-fd-history.ts `gapSide`; logs/s10-fdhist-dry.log: in_gap 500,973 = left 213,888 + right 287,085; **future=281,986** (right-tail rows ts > FD_MAX+1d, to 2028-07-10) — counted, still written; unique/would_write 495,825 unchanged |
| data-5 LOW | S10-05 | done | migration-run-2.md l.16 headline -> "87/96 + 9 pre-existing absent-tab READ FAILEDs"; migration-report.md -> 124 tables + S06/S07 final tab states (9 mapped, 8 rejected; Aug-2026 share-blocked) |
| data-6 LOW | S10-06 | done | engine.ts `TableResult.dupSkipped`, `skipped` = require-drops + dupSkipped (read=migrated+skipped reconciles); migrate-all `dup=` prints; run-2 §4 NULL-key upsert residual note |
| data-7 LOW | S10-07 | done | source-inventory.md §3 title -> Sep-2026 (sc-probe.log), §6 colA(1,741)-vs-`read=1,742` ±1 note |

## Changed files (reviewer DELTA scope)
- `src/features/shared/migration/mappings/queue-quality.ts` (refresh_log
  revert; sched_plan/qa_access_log sha1 mints untouched)
- `src/features/shared/migration/engine.ts` (dupSkipped counter)
- `tests/lib/migration-dedupe-key.test.ts` (refresh_log positional asserts)
- `migration/validate.ts`, `migration/migrate-all.ts`,
  `migration/backfill-fd-history.ts` (gitignored scratch)
- `specs/migration-remaining/source-inventory.md` (§3, §5, §6)
- `specs/megaplan/audits/migration-run-2.md` (§1 headline, §4 note)
- `specs/megaplan/migration-report.md` (run-2 block)

## Integration gates (round 6)
- `npx tsc --noEmit` PASS exit=0 (logs/tl6-tsc.log)
- `npx vitest run` PASS 60 files / 1161 tests (logs/tl6-vitest.log)
- `npx eslint <3 touched code files>` PASS exit=0 (logs/tl6-eslint.log)
- `npx tsx migration/migrate-all.ts --dry` PASS by evidence — 101/110 read +
  9 pre-existing absent-tab READ FAILEDs, output identical to tl5-dry PASS
  (114 lines). NOTE: node process lingered ~6 min on teardown after the last
  line (supabase/google client socket drain; dry path returns before the
  mapping loop) — killed post-output; not a code regression.
  (logs/tl6-dry.log)
- `npx tsx migration/validate.ts --md` PASS exit=0 — s10-validate.log reused
  (post-S10-02; nothing validate-relevant changed since). 124 tables, 11
  'combined' multi-source rows.
- readonly proof: 0 `values.update|append|batchUpdate` matches
  (logs/tl6-readonly.log)

## Residuals for the data-gate re-check
- data-1: gated re-run now mints positional keys matching the 8,197 live rows;
  refresh_log src count observed 9,053 in tl6-dry (finding's ~9,046 figure).
- data-4: `future=281,986` is the quantified right-tail answer — flag for the
  approval runbook before `backfill-fd-history.ts --write`.
- All --write/apply/live runs remain NEEDS_APPROVAL (unchanged).
