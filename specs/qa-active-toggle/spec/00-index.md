# Spec index: qa-active-toggle
Kind: index
Size gate: PASS

> Supersedes spec rev 1 (single-package client-side `activeAgents` design).
> New scope: server-side input filtering on BOTH pages; see S01.md header.
> Rev 3 (extension): PLAN extended to /audit-queue -> new package S03.
> S01/S02 are verified in TRACKER.md — reopened nowhere; S03 reuses S01-01 helpers.

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | none | #1-#2, #4-#6 — server `active` arg, input+post filters, wire seam | not dispatchable |
| S02 | package | S02.md | - | S01-05 | #1, #3 — Seg toggles + hash param on both pages | not dispatchable |
| S03 | package | S03.md | - | S01-01 (done) | #1-#3, #5-#6 — audit-queue server filter + Seg | not dispatchable |

Ready work: S01/S02 verified — do not reopen. S03-01 -> S03-02 serialize (S03-02 needs the `P.queuePage(who, active)` contract).
Size gate evidence: manual review vs LIMITS.md — largest leaf S01-01/S01-02: 3/1 files, 4/5 actions, ~100/80 lines, 10 min; S03 leaves: 3/1 files, 6/4 actions, ~35/25 lines, 10/8 min; all leaves <=10 files/actions/minutes, <=5 done checks, <=5 context pointers. `check_shards.py` to run pre-dispatch.
