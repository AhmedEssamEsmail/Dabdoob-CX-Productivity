# Spec index: S03 filtered reads
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S03-01 | mini | S03/01-tph-store-window.md | dev | S02-01 | #3 tphLoadStore_ date window + db() swap | 3/5/80/8 |
| S03-02 | mini | S03/02-tph-store-routes.md | dev | S03-01 | #3 remaining tph routes pass their date param | 6/6/20/5 |
| S03-03 | mini | S03/03-queue-jobs-filters.md | dev | S02-01 | #3 jobs.ts: freshchat/maqsam/inflow/submissions filters | 1/4/60/8 |
| S03-04 | mini | S03/04-queue-pages-filters.md | dev | S02-01 | #3 readStoreFiltered + pages/server filtered reads | 3/6/90/9 |
| S03-05a | mini | S03/05a-qa-audit-lookups.md | dev | none | #3 qa_audits/qa_queue single-row lookups | 1/7/60/8 |
| S03-05b | mini | S03/05b-qa-other-lookups.md | dev | S03-05a | #3 ctl/dispute/calibration/gap lookups (same file — serial) | 1/9/60/9 |

S03-05a and S03-05b both write cx-quality/lib/server.ts — strictly serial.
The popups-table filter is in S04-02 (popups.ts, criterion #3+#4).
