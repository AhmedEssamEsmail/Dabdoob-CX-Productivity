# Spec index: S01 — fetchJson extraction
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01-01 | mini | S01/01-fetch-json-module.md | dev | none | #1 shared module | 1/1/15/5 |
| S01-02 | mini | S01/02-desk-consumers-a.md | dev | S01-01 | #1 kb-tracker, kpi-logs, mail-desk | 3/3/6/5 |
| S01-03 | mini | S01/03-consumers-b.md | dev | S01-01 | #1 tl-performance, trackers, tph-grid | 3/3/8/5 |
| S01-04 | mini | S01/04-page-consumers.md | dev | S01-01 | #1 status-validation, my-status, analytics | 3/3/9/8 |
| S01-05 | mini | S01/05-pv-shared-drop.md | dev | S01-02, S01-03, S01-04 | #1 pv-shared stops exporting | 1/1/8/5 |

Ready work: S01-01 first, then S01-02..04 in parallel, then S01-05.
Size gate evidence: all leaves ≤3 files / ≤3 actions / ≤15 authored lines.
