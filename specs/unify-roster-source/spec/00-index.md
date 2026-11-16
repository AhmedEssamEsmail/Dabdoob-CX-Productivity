# Spec index: unify-roster-source
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | - | #1, #4b, #4 (src/tests refs), #2 code-parity | not dispatchable |
| S02 | package | S02.md | - | S01 (merge ordering) | #3, #2 live baseline, #4 tooling refs | not dispatchable |

Coverage notes (requirements -> leaves):
- #1 dqReadHct_ sheet-direct -> S01-01 (require[email,name] + last-wins email dedupe per DECISION).
- #2 identical sync vs baseline -> S01-04 (oracle-vs-port golden parity) + S02-02 (live Sheet1-vs-dq_hct diff, pre-merge).
- #3 nine-table drop -> S02-01. #4 no live dq_hct/headcount refs -> S01-03 (src) + S01-04 (tests) + S02-03 (migration/validate.ts). #4b -> S01-02.
- #5 access semantics: no leaf touches identity/pwDirectory/admin_emails/role code — verified by unchanged files + gates (PM-run). #6 gates are PM-run, not leaves.
- Docs flag resolved: `docs/ARCHITECTURE.md` has no dq_hct/mirror-pipeline mention (grep 2026-11-16) — no docs leaf. `env.ts:318` `headcount` variable stays (DECISION).

Ready work: S01-01 first (unblocks S01-02, S01-03, S02-02); S02-03 independent, dispatchable now. No two leaves share an edit file. Max 4 workers.
Size gate evidence: every leaf manually checked vs LIMITS.md — largest is S01-04 (3 files / 7 actions / ~220 lines / 10 min). Run `python "C:\Users\AHMED\AppData\Roaming\devin\skills\spec-sharding\check_shards.py" specs/unify-roster-source/spec/S01.md specs/unify-roster-source/spec/S02.md` before dispatch.
