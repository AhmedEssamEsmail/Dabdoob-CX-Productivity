# Spec index: table-center-align
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | none | #1, #2, #4, #5 | not dispatchable |
| S02 | package | S02.md | - | none | #3, #5 | not dispatchable |
| S03 | package | S03.md | - | S01, S02 | #6 | not dispatchable |
| S04 | package | S04.md | - | none | R2 #1-#6 | not dispatchable |

Criteria map: #1→S01-01 · #2→S01-02 · #3→S02-01..S02-12 · #4→S01-01+S01-02 (preserve centered families) · #5→S01+S02 (row labels keep start; verified by S03-01) · #6→S03-01 (gates are PM-run, not shards) · #7→PM commit step.
R2 map: #1→S04-01 · #2+#3→S04-03 · #4→S04-02 · #5→S04-01+S04-04 (guard assertions) · #6→S04-04 · #7→PM commit step.

Ready work: S04-01, S04-02, S04-03 in parallel (distinct files). S04-04 after all three (asserts their outputs). Max 3 workers.
Size gate evidence: manual review vs LIMITS.md — every leaf ≤10 files / ≤10 actions / ≤2000 lines / ≤10 min; largest leaf S02-12 (7 files, 8 actions, ~50 lines). TL must still run `check_shards.py` on each `spec/Sxx.md#id` before dispatch.
No NEEDS_USER.
