# Spec index: S06 reshard leftovers
Kind: index
Size gate: PASS

|| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
|| S06-01 | mini | S06/01-decide-v1-tabs.md | data-engineer | none | v1_ops 17 tabs | 2/5/220/10 |
|| S06-02 | mini | S06/02-decide-ops-tabs.md | data-engineer | none | oct 3 + daily_report 2 tabs | 2/5/220/10 |
|| S06-03 | mini | S06/03-probe-coverage.md | data-engineer | none | NTD x2 + qe cache parity | 2/4/180/10 |
|| S06-04 | mini | S06/04-new-tables-ddl.md | supabase-expert | S06-01, S06-02 | `NEW:` tables only | 1/6/400/10 |
|| S06-05 | mini | S06/05-v1-sched-mappings.md | dev | S06-01, S06-04 | v1_ops sched 5 tabs | 1/5/180/10 |
|| S06-06 | mini | S06/06-v1-people-mappings.md | dev | S06-01, S06-04 | v1_ops people 6 tabs | 1/5/220/10 |
|| S06-07 | mini | S06/07-v1-misc-mappings.md | dev | S06-01, S06-04 | v1_ops misc 6 tabs | 1/5/220/10 |
|| S06-08 | mini | S06/08-ops-tab-mappings.md | dev | S06-02, S06-04 | ops tabs <=5 | 1/5/220/10 |
|| S06-09 | mini | S06/09-fd-history-backfill.md | data-engineer | S06-03 | NTD gap-or-subset | 1/5/180/10 |
|| S06-10 | mini | S06/10-engine-wiring.md | dev | S06-05..08 | wiring | 1/5/70/8 |
|| S06-11 | mini | S06/11-aug-workbook-probe.md | data-engineer | NEEDS_USER share | Aug-2026 403 | 1/3/80/8 |
|| S06-12 | mini | S06/12-docs-closeout.md | tech-writer | S06-03,05..11 | PLAN #1,#6 | 2/4/220/10 |

Ready: S06-01, S06-02, S06-03 (parallel, disjoint files). S06-11 blocked on
NEEDS_USER: share Aug-2026 workbook `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg`
to `migration-reader@cx-kpis-513312.iam.gserviceaccount.com` (Viewer).
Serial: decides -> S06-04 -> migrates -> S06-10 (sole engine.ts writer) ->
S06-12. PM gates: apply S06-04 migration, live `migrate-all --tables` for new
mappings, S06-09 `--write`, productivity_files `2026-08` config + sc-refresh.
Size gate evidence: all leaves <=2 files, <=6 actions, <=400 lines, <=10 min;
one outcome each; S06-04/S06-09 are bounded either/or contracts.
