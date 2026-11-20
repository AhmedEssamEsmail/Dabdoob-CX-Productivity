# Spec index: home-quality-cards
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | none | #1-#5 | not dispatchable |

Children (in `S01.md`): S01-01 quality block in `getHomePage`; S01-02 golden strip + new quality vitest; S01-03 overview-page swap + CSS hook.

Ready work: S01-01 first; S01-02 and S01-03 run in parallel after it (disjoint files; max 2 workers).
Size gate evidence: manual LIMITS.md review — largest leaf S01-02 (2 files / 5 actions / ~260 lines / 10 min, mostly fixture literals); all leaves single-outcome, named files only. No db/deps/docs shards; no NEEDS_USER.
