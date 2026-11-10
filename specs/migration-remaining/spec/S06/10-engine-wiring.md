# S06-10: engine wiring — ops store keys + S06 mapping modules
Kind: mini
ID: S06-10
Parent: S06
Owner: dev
Depends: S06-05, S06-06, S06-07, S06-08
Criteria: PLAN #1, #4 (new mappings reachable by migrate-all --dry/--tables)
Skills: none
Budget: files=1; actions=5; changed_lines=70; minutes=8

## Goal
Single-writer edit of `engine.ts`: add the `oct_workbook` + `daily_report`
SPREADSHEETS keys and merge the S06 mapping modules into MODULE_MAPPINGS /
ROW_TRANSFORMS / MAPPING_DECISIONS so `--dry` and the gated live run see them.

## Files
- Edit: `src/features/shared/migration/engine.ts` | SPREADSHEETS record (~lines 30-39), import block (~lines 14-18), ROW_TRANSFORMS (~lines 81-83), MODULE_MAPPINGS + MAPPING_DECISIONS (~lines 89-90) only

## Context
- `src/features/shared/migration/engine.ts:14-18,30-39,81-90` | exact regions
- `results/S06-05.md` … `results/S06-08.md` | exported symbol names + whether
  each module exports ROW_TRANSFORMS — check files, don't assume
- `src/features/shared/migration/mappings/ops-tabs.ts` | the spreadsheet key
  strings the module expects
- `src/features/shared/platform/settings.ts:68-69` | daily_report_ss_id +
  oct workbook id confirm

## Contract
Add to SPREADSHEETS: `oct_workbook: '1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI'`
and `daily_report: '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4'` with
trailing comment names. Import each S06 module's exports that EXIST
(`v1-ops-sched`, `v1-ops-people`, `v1-ops-misc`, `ops-tabs` — MAPPINGS +
DECISIONS always; ROW_TRANSFORMS only where exported), spread into
MODULE_MAPPINGS / ROW_TRANSFORMS / MAPPING_DECISIONS matching the V1_/HCT_
pattern. Conditional imports forbidden: absent export = no reference. No
other engine edits.
Out of scope: any other file; new dependencies; engine logic changes.

## Actions
1. Check each S06 module's exports (files, not results files alone).
2. Add the two SPREADSHEETS keys.
3. Add the import lines for existing exports.
4. Spread into the three merge points.
5. Typecheck.

## Done when
- All S06 modules are engine-reachable; the diff is additive only;
  `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s06-10-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
PM gate: `migrate-all --dry` then `--tables` for the new tables. Validator
row coverage is S06-12's evidence note. Write `results/S06-10.md`; TL
updates TRACKER.md.
