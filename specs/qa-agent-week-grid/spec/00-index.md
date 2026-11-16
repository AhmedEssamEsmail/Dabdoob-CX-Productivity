# Spec index: qa-agent-week-grid
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | - | #1-#7 | not dispatchable |

Root index lists the single package; leaf rows live in `S01.md` `## Children`.
Ready work: S01-01 first — it publishes the `columns.agentWeeks` payload
contract; S01-02 consumes it (serial, one leaf at a time; max 1 worker).
Size gate evidence: manual review vs LIMITS.md — largest leaf is S01-02 at
1 file / 5 actions / ~170 lines / 10 min; all leaves under hard caps.
Preflight: `python "C:\Users\AHMED\AppData\Roaming\devin\skills\spec-sharding\check_shards.py" spec/S01.md#S01-01 spec/S01.md#S01-02`
