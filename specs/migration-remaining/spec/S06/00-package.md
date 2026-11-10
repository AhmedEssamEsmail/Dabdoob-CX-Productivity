# S06: reshard leftovers — uncovered datasets from S01-01's probe
Kind: package
ID: S06
Dispatch: NEVER

## Goal and contract
Close every `reshard:` flag in `specs/migration-remaining/source-inventory.md`
(S01-01 evidence, results/S01-01.md): each uncovered dataset ends migrated /
covered / rejected with evidence, matching PLAN #1. Pattern per dataset:
**decide** (read-only probe + verdict doc naming target table + key, or
reject/covered reason) → **DDL** for the few tables no V2 table can hold →
**migrate** (engine mapping module or one bounded script; live runs are PM
approval gates, not leaf work) → **wire** + **docs**. Sources stay strictly
read-only. Non-goals: touching completed S01–S05 work; applying migrations or
`--write` runs (PM gates); changing settings values (PM gate via Admin>Config).

## Children
Index: `S06/00-index.md`

Coverage map (finding -> leaf ids):
- v1_ops 17 non-task tabs (incl. TaskOccurrences) -> S06-01 decide; S06-04 DDL
  if `NEW:`; S06-05/06/07 migrate; S06-10 wire; S06-12 docs.
- oct_workbook {FD_AUX, Transcript, AUXes Exceptions} + daily_report {WA,
  CTL & Quality} -> S06-02 decide; S06-04 DDL if `NEW:`; S06-08 migrate;
  S06-10 wire; S06-12 docs.
- `New Tickets Daily` x2 (touch_archive, qa_engine_source) -> S06-03 window
  probe; S06-09 backfill-or-reject; S06-12 docs.
- qa_queue `Ticket Detail Cache` parity (owed evidence) -> S06-03; S06-12.
- Aug-2026 workbook `10rpLZ…` (403) -> S06-11 probe, BLOCKED on NEEDS_USER
  share; PM gate adds `2026-08` to productivity_files + runs run-sc-refresh.

## Completion
All child leaves done; every source-inventory `reshard:` line has a final
state with evidence (S06-12); integration = `migrate-all --dry` reads the new
mappings + validator rows present. PM gates: apply S06-04's migration (if
any), `migrate-all --tables` for new mappings, `--write` backfills,
productivity_files config add. This file is planner context, not an
assignment.
