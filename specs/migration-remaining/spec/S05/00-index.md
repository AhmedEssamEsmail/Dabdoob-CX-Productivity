# Spec index: S05 wiring/validator/docs
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S05-01 | mini | S05/01-engine-wiring.md | dev | S03-02, S04-02 | #2,#4 | 1/4/40/8 |
| S05-02 | mini | S05/02-validator.md | dev | S05-01 | #6 | 1/4/60/8 |
| S05-03 | mini | S05/03-dry-verify.md | dev | S02-04..08, S05-01, S05-02 | #5,#6,#7 | 1/4/20/10 |
| S05-04 | mini | S05/04-docs-report.md | tech-writer | S05-03 (+ PM gated runs) | #1,#6 | 3/4/250/10 |

Serial: S05-01→02→03→04. PM approval gates between S05-03 and S05-04:
apply the new migration files, then live runs (migrate-all --tables for
dq_hct/actions; the four --write backfills; the PLAN #5 targeted idempotent
re-run expecting 0 new rows). S05-04 records their evidence.
Size gate evidence: all leaves <=10 files/actions, <=250 lines, <=10 min.
