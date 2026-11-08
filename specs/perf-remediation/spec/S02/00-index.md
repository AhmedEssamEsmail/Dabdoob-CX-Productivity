# Spec index: S02 job env lazy loads
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S02-01 | mini | S02/01-env-lazy-tables.md | dev | none | #2 env core: drop eager preload, roster opt-out, interval window in prefetch | 1/4/120/8 |
| S02-02 | mini | S02/02-productivity-prefetch.md | dev | S02-01 | #2 prod step fns declare table lists | 1/4/40/6 |
| S02-03 | mini | S02/03-tph-prefetch.md | dev | S02-01 | #2 tph jobs declare lists; hourly <=3 tables | 3/4/40/6 |
| S02-04 | mini | S02/04-backfill-prefetch.md | dev | S02-01 | #2 backfill declares its union list | 1/3/30/5 |
| S02-05 | mini | S02/05-quarterly-prefetch.md | dev | S02-01 | #2 quarterly declares prod_flag_analytics | 1/2/15/4 |
| S02-06 | mini | S02/06-nonprod-env-audit.md | dev | S02-01 | #2 audit non-prod env users; patch only if needed | 6/6/40/8 |

env.ts is written only by S02-01. jobs/tph.ts + the tph cron routes are
shared with S09-02 — S09-02 depends on S02-03 (serial).
