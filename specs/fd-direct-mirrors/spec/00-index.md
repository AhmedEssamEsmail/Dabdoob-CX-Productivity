# Spec index: fd-direct-mirrors
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S00 | package | S00.md | - | - | #6 | not dispatchable |
| S01 | package | S01.md | - | - | #3 | not dispatchable |
| S02 | package | S02.md | - | - | #2 | not dispatchable |
| S03 | package | S03.md | - | - | #1 #2 | not dispatchable |
| S04 | package | S04.md | - | S03, S05-02 | #2 | not dispatchable |
| S05 | package | S05.md | - | - | #5 #2 #4 | not dispatchable |

Ready work: S00-01, S01-01, S02-01, S02-02, S03-01, S05-01(dry-run) immediately (max 4 workers). Same-file serial chains: S03-01→S03-02→S03-03; S04-01→S04-02→S05-03→S05-04; S05-01→S05-02.
Required chain: S03 writers dual-write → S05-01 purge → S05-02 backfill → S04 reader cutover → S05-03 writers stop emitting cols → S05-04 drop cols.
NEEDS_APPROVAL: S05-01/S05-02 real `--write` runs (remote DB purge/backfill) and S05-04 apply — workers build + dry-run only; PM obtains explicit user approval before remote writes.
Size gate evidence: check_shards.py PASS on S00–S05 (2026-11-12); every leaf declares <=10 files / <=10 actions / <=2000 lines / <=10 min per spec `## Children` tables.
