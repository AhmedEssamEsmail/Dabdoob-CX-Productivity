# Spec index: S07 constraints + indexes
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S07-01 | mini | S07/01-uniques-dedupe.md | supabase-expert | none | #7 dedupe + uniques prod_daily_layers/queue_submissions | 1/3/80/6 |
| S07-02 | mini | S07/02-indexes-prod.md | supabase-expert | S07-01 | #7 indexes group A (6) | 1/6/40/5 |
| S07-03 | mini | S07/03-indexes-tickets.md | supabase-expert | S07-02 | #7 indexes group B (5) | 1/5/35/5 |

All three write the shared migration catalog -> strictly serial.
S10-01 (app_cache table) is chained after S07-03 for the same reason.
