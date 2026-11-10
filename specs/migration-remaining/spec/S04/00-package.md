# S04: remaining source backfills (V1 imports + mirror/table fills)
Kind: package
ID: S04
Dispatch: NEVER

## Goal and contract
Land the readable-but-unmigrated stores: PLAN #3 (freshchat mirror from the
Daily-Report 'Freshchat' tab; fd_activities parity/gap-backfill vs the
'Activities' tab), PLAN #4 (V1 ops lead tasks → actions; configured
`productivity_files[month]` workbooks → scRefreshMonth_ tables; QA_HIST
voice+text → qa_audits via the ported import), and the fc_messages raw mirror
(PLAN #1 verdict=migrated, mirror shape per 004). Backfill runners are
gitignored `migration/*.ts` CLIs with a read-only `--probe`/`--dry` default
and an approval-gated `--write` mode — WP-51 precedent. The V1 mapping is a
committed `mappings/v1-ops.ts` module run through `migrate-all --tables`
(gated). Non-goals: vendor API pulls (WP-53), pg_cron, live runs themselves.

## Children
Index: `S04/00-index.md`
- #3 -> S04-03 (freshchat), S04-04 (fd_activities)
- #4 -> S04-02 (v1 ops), S04-05 (qa hist), S04-06 (sc months)
- #1 fc_messages -> S04-01 (DDL) + S04-07 (backfill)

## Completion
Scripts exist with --probe evidence; mapping module wired (S05-01); live
executions are PM approval-gated runs recorded in migration-run-2.md.
Not a developer assignment.
