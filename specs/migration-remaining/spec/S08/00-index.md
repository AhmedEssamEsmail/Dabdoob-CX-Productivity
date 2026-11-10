# S08: qa-1 findings fix package (FIX mode)
Kind: package
Parent: root
Depends: S02..S07 complete; findings reports/qa-1.md

## Findings -> leaves
| Finding | Sev | Leaf | Owner | Outcome |
|---|---|---|---|---|
| qa-1 | HIGH | S08-01 | dev | v1 sched_plan dedupe_key namespace -> 'v1-mig-' |
| qa-2 | HIGH | S08-02 | supabase-expert | seed trackers/tracker_fields for aux_exceptions + wa_parcels |
| qa-3 | MED | S08-03 | supabase-expert | run 14 NULL-key/dup probes on remote, record verdicts |
| qa-4 | MED | S08-04 | dev | quote onConflict identifiers; seen-map unquoted |
| qa-5 | MED | S08-05 | dev | v1 log_id prefixes for both 1:1 tabs |
| qa-6 | LOW | deferred | - | stray root results/ dir; cosmetic |
| qa-7 | LOW | deferred | - | runbook note for dq_hct dup-email approval |

All leaves are independent; disjoint files.
