# S06-11: Aug-2026 workbook readability + shape probe
Kind: mini
ID: S06-11
Parent: S06
Owner: data-engineer
Depends: NEEDS_USER (workbook share — see index)
Criteria: PLAN #4 (each configured productivity_files[month] workbook —
2026-08 -> `10rpLZ…` per V1 ProductivitySources, today unreachable 403)
Skills: none
Budget: files=1; actions=3; changed_lines=80; minutes=8

## Goal
Once the owner shares `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg`
("Productivity (August-2026)") to the service account, a read-only probe
confirms it carries the tabs `scRefreshMonth_` needs and records the census
so the PM can add `2026-08` to `productivity_files` with confidence.

## Files
- Create: `migration/probe-aug-workbook.ts` | one read-only probe script

## Context
- `migration/probe-remaining-tabs.ts` | auth + probe pattern to reuse
- `src/features/cx-people/lib/scorecard-server.ts:449-508` | scRefreshMonth_
  required tabs: `Productivity Matrix`, `FCR`, `Business Behavior`
  (+ `Stackranking`/`Stack Ranking` behaviour fallback)
- `specs/migration-remaining/source-inventory.md:32` | the 403 finding +
  month->id evidence from V1 ProductivitySources
- `src/features/cx-people/lib/scorecard-server.ts:613-643` | the Admin>Config
  setConfig path the PM will use for productivity_files['2026-08']

## Contract
Probe `spreadsheets.get` (tab list) + `values.get` `A1:AZ3` on the three
required tabs + col-A counts; report per-tab present/missing + row counts +
verdict `ready-for-config` | `blocked:<what's missing>` | `still-403`.
If still 403, do not retry loops — record `still-403` and end (the share is
the blocker, not code). No writes anywhere.
Out of scope: setting productivity_files (PM gate via Admin>Config, then the
existing `migration/run-sc-refresh.ts --write` covers the month); any other
workbook.

## Actions
1. Write the probe (auth pattern; one spreadsheet id; the required tab list).
2. Run -> `specs/migration-remaining/logs/aug-probe.log`; keep `exit=` +
   `tail -c 2000`.
3. Write `results/S06-11.md` (<=10 lines: verdict + tab census + missing
   tabs if any).

## Done when
- Log + results record a verdict with the tab census, or `still-403` as an
  honest blocker.

## Verify
- Run: `npx tsx migration/probe-aug-workbook.ts > specs/migration-remaining/logs/aug-probe.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/aug-probe.log` -> exit=0 with a verdict line.

## Handoff
PM gates: share check, then setConfig `productivity_files['2026-08'] =
10rpLZ…` + `run-sc-refresh.ts --write`. Outcome to migration-run-2.md via
S06-12. Write `results/S06-11.md`; TL updates TRACKER.md.
