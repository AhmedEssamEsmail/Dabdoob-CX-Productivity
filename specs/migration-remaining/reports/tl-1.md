# tl-1: migration-remaining BUILD report

## Summary
All 22 leaves dispatched and complete; 4 packages done. Integration gates pass.
Remaining work is PM approval-gated (remote applies + live writes) plus one
RESHARD_NEEDED for newly discovered scope.

## Changed files (assignment-local; baseline dirty tree untouched)
- Migrations created: `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql`,
  `20261109130633_dedupe_uniques_people_sched.sql`, `20261109130706_dedupe_uniques_queue_agg.sql`,
  `20261109131136_fc_messages.sql`, `20261109131140_dq_hct_table.sql` (app_all removed
  post-contract to match S08-04 lockdown).
- Edited: `engine.ts` (SPREADSHEETS hct+v1_ops, MODULE_MAPPINGS/TRANSFORMS/DECISIONS),
  `mappings/queue-quality.ts` (11 upsertOn flips + dedupe_key transforms: sched_plan,
  QaAccessLog), `mappings/people-core.ts` (11 flips), `mappings/route-core.ts` (qa_volume),
  `migration/validate.ts` (registries), `specs/megaplan/migration-report.md` (+25).
- Created: `mappings/hct.ts`, `mappings/v1-ops.ts`; gitignored scratch CLIs in
  `migration/`: probe-remaining-tabs, backfill-freshchat-sheet, backfill-fc-messages,
  run-fd-mirror, run-qa-history, run-sc-refresh.
- Docs: `source-inventory.md` (11 stores, final states), `audits/migration-run-2.md`
  (PENDING-APPROVAL live cells), `TRACKER.md`, `results/*.md`, `logs/*.log`.

## Leaf status (all done)
S01-01 inventory (11/11 probed, 0 writes) · S02-01..03 dedupe DDL (23 tables;
dedupe_key fallbacks: qa_access_log, sched_plan) · S02-04..08 all 23 upsertOn
flips · S03-01 dq_hct DDL · S03-02 hct mapping · S04-01 fc_messages DDL ·
S04-02 v1-ops mapping (Tasks→actions, 18 rows dry) · S04-03 freshchat CLI
(dry: 1602) · S04-04 fd check (verdict gap:873) · S04-05 QA hist probe
(voice 4076 / text 1709) · S04-06 sc probe (2026-09→1I29yj) · S04-07 fc_messages
CLI (dry: 82,805) · S05-01 engine wiring · S05-02 validator · S05-03 dry sweep ·
S05-04 report docs.

## Integration gates (round 1)
tsc=0 · vitest 1145/1145 · eslint 0 errors · `migrate-all --dry` exit=0 96/96
(dq_hct 60, actions-v1 18) · validate --md exit=0 · read-only proof clean.
9 pre-existing READ FAILEDs on old core/productivity tabs — unrelated baseline.

## RESHARD_NEEDED (to PM/spec-architect)
S01-01 found datasets no leaf/table holds: v1_ops 17 non-task tabs; oct workbook
{FD_AUX, Transcript, AUXes Exceptions}; daily_report {WA, CTL&Quality};
`New Tickets Daily`×2; Aug-2026 workbook `10rpLZ…` 403 access gap.

## NEEDS_APPROVAL (PM gates, not shard work)
Apply the 5 migration files (dedupe DELETEs are destructive); live
`migrate-all --tables dq_hct,actions`; five `--write` backfills; PLAN #5
targeted re-run expecting 0 new rows. Then refresh PENDING-APPROVAL cells in
migration-run-2.md/source-inventory.md. Caveats in TRACKER "Blocked" section.
