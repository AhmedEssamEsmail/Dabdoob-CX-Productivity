# Spec index: headcount-access-split
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | - | #2 #3 | not dispatchable |
| S02 | package | S02.md | - | S01, S03-01 | #3 #4 #5 | not dispatchable |
| S03 | package | S03.md | - | - | #5 #6 | not dispatchable |
| S04 | package | S04.md | - | S03-01 | #5 #6 | not dispatchable |
| S05 | package | S05.md | - | S04 | #1 | not dispatchable |
| S06 | package | S06.md | - | S02-02 | #4 #5 | not dispatchable |
| S07 | package | S07.md | - | S01, S02-01 | #2 #3 | not dispatchable |
| S08 | package | S08.md | - | S02, S04 | #7 | not dispatchable |
| S09 | package | S09.md | - | - | #5 #6 #7 (RESHARD r1: tl-1 unmapped test drift) | not dispatchable |
| S10 | package | S10.md | - | - | EXTEND E1–E3 (PLAN "EXTEND 2026-11-12") | not dispatchable |

Ready work: S01-01, S01-02, S03-01 immediately (3 workers); EXTEND leaves S10-01 + S10-02 (disjoint files, parallel-safe). Same-file serial chains: roster.ts S02-01→S02-02; pure.ts/server.ts S04-01→S04-02→S05-01; people-holidays-page.tsx S06-01→S06-02.
Note: S07-01's real (non-dry-run) run writes to the remote DB — needs explicit user approval before executing.
Size gate evidence: every leaf declares <=10 files / <=10 actions / <=2000 lines / <=10 min; file-grant, action and dependency check done by hand review of this tree.
