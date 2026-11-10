# Spec index: perf-pushdown
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | spec/S01.md | - | none | T0 baseline; #1 | not dispatchable |
| S02 | package | spec/S02.md | - | none | P-01 repo foundation; #2 | not dispatchable |
| S03 | package | spec/S03.md | - | S01-02, S02-01 | T1/P-07 scorecard; #3 | not dispatchable |
| S04 | package | spec/S04.md | - | none | T2/P-06 QE lookups; #3 | not dispatchable |
| S05 | package | spec/S05.md | - | S01-02 | T3/P-08,P-21 identity; #4 | not dispatchable |
| S06 | package | spec/S06.md | - | S02-01, S05-01 | T4/P-02,P-21 route; #3,#4 | not dispatchable |
| S07 | package | spec/S07.md | - | S02-01, S05-01, S01-02 | T5/P-03,P-16; #3,#7 | not dispatchable |
| S08 | package | spec/S08.md | - | S02-01, S04-02 | T6/P-05,P-09; #3,#5 | not dispatchable |
| S09 | package | spec/S09.md | - | S08-12 | T10/P-13; #6 | not dispatchable |
| S10 | package | spec/S10.md | - | S02-01 | T7/P-04,P-15; #2,#3 | not dispatchable |
| S11 | package | spec/S11.md | - | S05-01, S10-01 | T8/P-09,P-10,P-11; #3,#5 | not dispatchable |
| S12 | package | spec/S12.md | - | S01-02, S02-01, S11-02 | T9/P-12,P-01,P-14; #2,#6 | not dispatchable |
| S13 | package | spec/S13.md | - | none | T11/P-18,P-20; #8 | not dispatchable |
| S14 | package | spec/S14.md | - | S01-02 | T12/P-17,P-22; #6,#7 | not dispatchable |
| S15 | package | spec/S15.md | - | none | T13/P-19 profiling; #9 | not dispatchable |
| S16 | package | spec/S16.md | - | all terminal leaves | docs close-out | not dispatchable |

Serial file chains preserved: S04->S08->S09 (`cx-quality/lib/server.ts`); S10-01->S11-01->S11-02->S12 (`stores.ts`, `env.ts`); S02-01->S12-02 (`repo.ts`); S05-01->S06-01 (`route.ts` consumers share `pwDirectory`). Same-file writers are always ordered via Depends.
Ready work: S01-01 (needs approval), S02-01, S04-01, S13-01, S13-02, S14-02, S15-01 — max 4 workers.
NEEDS_USER: (1) approve remote read-only SELECTs for S01-01 (T0) — dashboard max-rows read + 4 SELECTs; (2) PLAN.md says planning only — confirm BUILD may proceed after this spec.
Size gate evidence: manual review vs LIMITS.md — every leaf <=10 files / <=10 actions / <=2000 lines / <=10 min; largest: S06-01 (~250 lines est, 10 min). Run check_shards.py before dispatch.
