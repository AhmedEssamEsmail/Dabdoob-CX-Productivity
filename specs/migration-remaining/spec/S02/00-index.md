# Spec index: S02 dedupe hardening
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S02-01 | mini | S02/01-dedupe-queue-agg.md | supabase-expert | none | #5 agg/queue (8 tbl) | 1/9/350/10 |
| S02-02 | mini | S02/02-dedupe-logs-ops.md | supabase-expert | none | #5 logs/ops (8 tbl) | 1/10/380/10 |
| S02-03 | mini | S02/03-dedupe-people-sched.md | supabase-expert | none | #5 people/sched (7 tbl) | 1/8/300/10 |
| S02-04 | mini | S02/04-flips-queue-quality-a.md | dev | S02-01 | #5 7 flips | 1/7/120/8 |
| S02-05 | mini | S02/05-flips-queue-quality-b.md | dev | S02-02,S02-03,S02-04 | #5 4 flips+transforms | 1/7/140/8 |
| S02-06 | mini | S02/06-flips-people-core-a.md | dev | S02-03 | #5 6 flips | 1/6/110/8 |
| S02-07 | mini | S02/07-flips-people-core-b.md | dev | S02-02,S02-06 | #5 5 flips | 1/5/100/8 |
| S02-08 | mini | S02/08-flip-route-core.md | dev | S02-01 | #5 1 flip | 1/2/20/5 |

Ready: S02-01/02/03 in parallel (separate generated migration files).
Flip leaves are serial per edited file: S02-04->S02-05 (queue-quality.ts),
S02-06->S02-07 (people-core.ts). S02-08 independent (route-core.ts).
Size gate evidence: all leaves <=10 files/actions, <=450 lines, <=10 min.
