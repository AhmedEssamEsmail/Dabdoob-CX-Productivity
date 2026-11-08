# Spec index: S04 batched writes
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S04-01 | mini | S04/01-updaterows-batch.md | dev | none | #4 updateRows <=2 calls/batch | 2/4/150/10 |
| S04-02 | mini | S04/02-popups-filtered-resolve.md | dev | none | #3+#4 popups filtered reads; resolve in one update | 1/5/80/8 |

repo.ts is written only by S04-01; S08-01 also touches repo.ts and therefore
depends on S04-01 (serial).
