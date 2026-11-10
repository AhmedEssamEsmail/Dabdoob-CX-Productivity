# Spec index: S04 source backfills
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S04-01 | mini | S04/01-fc-messages-ddl.md | supabase-expert | none | #1 fc_messages | 1/4/70/8 |
| S04-02 | mini | S04/02-v1-ops-mapping.md | dev | S01-01 | #4 V1 lead tasks | 1/4/140/10 |
| S04-03 | mini | S04/03-freshchat-backfill.md | data-engineer | none | #3 freshchat | 1/5/180/10 |
| S04-04 | mini | S04/04-fd-activities.md | data-engineer | none | #3 fd_activities | 1/5/140/10 |
| S04-05 | mini | S04/05-qa-history.md | data-engineer | none | #4 QA hist | 1/5/140/10 |
| S04-06 | mini | S04/06-sc-refresh.md | data-engineer | none | #4 sc months | 1/5/140/10 |
| S04-07 | mini | S04/07-fc-messages-backfill.md | data-engineer | S01-01, S04-01 | #1 fc_messages | 1/5/160/10 |

Ready: S04-01/03/04/05/06 immediately; S04-02/07 after S01-01.
Each leaf writes its own scratch script or generated migration — no shared
edit files. Live `--write` executions are PM approval gates, not leaf work.
Size gate evidence: all leaves <=10 files/actions, <=180 lines, <=10 min.
