# Spec index: qa-all-bases-count
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | - | #1 #2 #3 #4 #5 | not dispatchable |
| S02 | package | S02.md | - | S01 | #4 #5 #6 | not dispatchable |
| S03 | package | S03.md | - | S01 | #3 #7 | not dispatchable |

Dependency notes: S01-01 -> S01-02 -> S01-03 serial (same files / downstream
semantics). Ready work: S01-01 first; after S01-02, S02-01 + S02-02 + S03-01
run in parallel; after S01-03, S02-03 + S03-02 run in parallel (max 3 workers).

Gates (PM-run, not shards): `npm run lint`, `npx tsc --noEmit`,
`npx vitest run tests/quality tests/golden` (log file + bounded tail); data
gate — reconcile Kareem Salah 2026-11 count 43 vs sheet `qa_audits` per
PLAN research notes; UX gate for copy changes.

Wrap-up flag for PM (non-goal per PLAN): quota/coverage (`doneBy`, queue
detail copy) still counts queue slots only — ask the user whether that should
move to all bases too.

Size gate evidence: every leaf declares <=10 files / <=10 actions / <=2000
lines / <=10 min; one outcome each; same-file writers serialized; run
`check_shards.py` on `S01.md#S01-01 S01.md#S01-02 S01.md#S01-03 S02.md#S02-01
S02.md#S02-02 S02.md#S02-03 S03.md#S03-01 S03.md#S03-02` before dispatch.
