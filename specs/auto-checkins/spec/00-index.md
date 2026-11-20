# Spec index: auto-checkins
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| AC-01 | mini | leaves.md#AC-01 | dev | none | #1-6 auto-submit on snapshot capture | 2/6/350/10 |

Ready work: AC-01 (single leaf; results -> `specs/auto-checkins/results/`).
Size gate evidence: manual review vs LIMITS.md — 1 leaf, 2 named files, 6 atomic
actions, ~350 est. changed lines, 10 est. minutes; PM/TL run check_shards.py on
`spec/leaves.md#AC-01` before dispatch.
Gates (PM-run, not shards): QA always; Data review after AC-01; typecheck/lint/unit
per PLAN gate commands.
