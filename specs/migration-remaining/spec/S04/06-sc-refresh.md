# S04-06: scRefreshMonth_ backfill CLI (configured month workbooks)
Kind: mini
ID: S04-06
Parent: S04
Owner: data-engineer
Depends: none
Criteria: PLAN #4 (each productivity_files[month] workbook → scRefreshMonth_
tables)
Skills: none
Budget: files=1; actions=5; changed_lines=140; minutes=10

## Goal
Scratch CLI `migration/run-sc-refresh.ts`: `--probe` (default, read-only)
lists the configured `productivity_files` months + resolved workbook ids and
current `sc_months` status per month; `--write` calls `scRefreshMonth_` per
month — the ported V1-workbook path — approval-gated, PM runs it.

## Files
- Create: `migration/run-sc-refresh.ts` | one CLI script

## Context
- `src/features/cx-people/lib/scorecard-server.ts:448-508` | scRefreshMonth_
  contract (never wipes a month; writes sc_daily/sc_behaviour/sc_months)
- `src/features/cx-people/lib/scorecard/index.ts:490-502` | scSources_/
  scWorkbookFor_ — month→workbook resolution incl. productivity_fallback_id
- `src/features/shared/platform/settings.ts:69-70` | productivity_files /
  productivity_fallback_id config keys
- `migration/migrate-all.ts:15-32` | env + client pattern

## Contract
`--probe`: `configAll()` → months = keys of `dqSetting_(cfg,'productivity_files')`
(today expect `2026-09 → 1I29yj…`); per month print `scWorkbookFor_` result
(id + fallback flag) + that month's `sc_months` row status if any; do not call
scRefreshMonth_. `--write`: per month, `scRefreshMonth_(month,'migration:run-2')`,
print status/error/title/rows per month, continue on per-month failure (the fn
already records errors into sc_months). Months are resolved from config at run
time — never hard-code the month list.
Out of scope: editing scorecard files; adding months to config; live
`--write` (PM gate); maqsam/other month-workbook tabs.

## Actions
1. Create the script: env bootstrap, flag parse, supabase client.
2. `--probe` path: productivity_files keys + scWorkbookFor_ + sc_months read.
3. `--write` path: loop scRefreshMonth_ with per-month result lines.
4. Run `--probe` → `specs/migration-remaining/logs/sc-probe.log`; record
   exit + resolved months in results.
5. Note honestly if productivity_files is empty (then the fallback covers
   only the current month — record that as the finding).

## Done when
- `--probe` prints the resolved month→workbook map from live config.
- `--write` path exists behind the flag (not executed by the leaf).

## Verify
- Run: `npx tsx migration/run-sc-refresh.ts --probe > specs/migration-remaining/logs/sc-probe.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/sc-probe.log` -> exit=0, month map printed.

## Handoff
PM gate: `--write` refreshes each configured month (expect 2026-09 → the Oct
workbook). Outcomes to migration-run-2.md. Write `results/S04-06.md`; TL
updates TRACKER.md.
