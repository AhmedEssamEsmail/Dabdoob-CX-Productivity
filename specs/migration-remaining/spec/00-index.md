# Spec index: migration-remaining
Kind: index
Size gate: PASS

| ID | Kind | Spec/index path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01-01 | mini | 01-source-inventory.md | data-engineer | none | #1 (probe+verdicts) | 2/4/180/10 |
| S02 | package | S02/00-index.md | - | none | #5 | not dispatchable |
| S03 | package | S03/00-index.md | - | S01-01 | #2 | not dispatchable |
| S04 | package | S04/00-index.md | - | S01-01 | #1,#3,#4 | not dispatchable |
| S05 | package | S05/00-index.md | - | S02,S03,S04 | #1,#6,#7 | not dispatchable |
| S06 | package | S06/00-index.md | - | none (S01-01 done) | #1,#3,#4 reshard flags | not dispatchable |
| S07 | package | S07/00-index.md | - | S06 needs-split rows | round-2 reshard rows 1-3 | not dispatchable |

Leaf inventory (40): S01-01 · S02-01..08 · S03-01..02 · S04-01..07 ·
S05-01..04 · S06-01..12 · S07-01..06. S01–S05 done; S06 11/12 done (S06-11
blocked); S07 = the three needs-split rows from reports/tl-2.md.

Ready work (max 4 workers): S07-01, S07-04 (parallel). S06-11 blocked on
NEEDS_USER: share Aug-2026 workbook `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg`
to `migration-reader@cx-kpis-513312.iam.gserviceaccount.com` (Viewer) — plus
the PM approval gates below still open.

Approval gates (PM/owner runs — NOT shards): apply the new migration files
(dq_hct, fc_messages, dedupe uniques, S06-04 NEW tables) to the live project;
live `migrate-all --tables` incl. S06 mappings + S07's `aux_spans,qa_ctls`
(aux_spans only after the S06-04 file lands); `--write` backfills incl.
S06-09 + S07-04's chosen set; productivity_files `2026-08` config +
sc-refresh; the idempotent re-run (PLAN #5, 0 new rows). DDL before upserts.

Shared-file writers serial by dependency; each DB leaf generates its own
`supabase migration new` file; engine.ts's sole writer is now S07-01;
ops-tabs.ts serial S07-02 -> S07-03; validate.ts S07-05's alone;
source-inventory.md is S07-06's alone inside S07 (S06-12 finished S06's).

Size gate evidence: every leaf manually checked vs LIMITS.md — S01–S05 done
(max files=3, actions=10, lines=450, min=10); S06 max 2/5/400/10 (S06-04
bounded either/or); S07 max 2/6/200/10, one outcome each — S07-03/S07-04
bounded either/or (map-or-verdict / import-or-reject).
