# S06-08: oct + daily_report tabs -> mappings/ops-tabs.ts
Kind: mini
ID: S06-08
Parent: S06
Owner: dev
Depends: S06-02, S06-04
Criteria: PLAN #1 (oct FD_AUX/Transcript/AUXes Exceptions + daily_report
WA/CTL&Quality land idempotently or are rejected with reason)
Skills: none
Budget: files=1; actions=5; changed_lines=220; minutes=10

## Goal
Mapping module `mappings/ops-tabs.ts` covering the <=5 ops tabs with
`migrate:` verdicts in decisions-ops-tabs.md — oct_workbook tabs use
`spreadsheet: 'oct_workbook'`, daily_report tabs `spreadsheet: 'daily_report'`
(store keys added by S06-10), each into the table + upsertOn the doc names.

## Files
- Create: `src/features/shared/migration/mappings/ops-tabs.ts` | MAPPINGS + DECISIONS (+ ROW_TRANSFORMS only if a column needs synthesis)

## Context
- `specs/migration-remaining/decisions-ops-tabs.md` | required: per-tab
  target, upsertOn, verbatim sheetToDb pairs; CTL & Quality may split —
  map only its migrate portion, DECISIONS line covers the ⊆qa_audits part
- `src/features/shared/migration/mappings/v1-ops.ts` | sibling module
  boilerplate + DECISIONS pattern
- `src/features/shared/migration/engine.ts:30-39,80-83` | SPREADSHEETS keys
  (oct_workbook/daily_report pending S06-10 — use the key names verbatim)
  + ROW_TRANSFORMS global namespace
- `supabase/migrations/006_quality.sql:104-160` + `004_mirror_tables.sql` |
  qa_ctls and mirror-table target shapes

## Contract
One TableMapping per `migrate:` tab/portion: `sheet` = exact tab name
(`CTL & Quality` verbatim incl. ampersand), `table`/`upsertOn`/`sheetToDb`
verbatim from the decision doc, `require` = upsert key cols. `NEW:`-target
tabs map identically (S06-04 DDL, PM-gated apply). `rejected:`/`covered:`
verdicts get DECISIONS lines only. Export MAPPINGS + DECISIONS always;
ROW_TRANSFORMS only if needed (sheet-keyed, guarded).
Out of scope: engine.ts (S06-10); v1_ops tabs (S06-05..07); runs.

## Actions
1. Read the decision doc entries for the 5 tabs.
2. Create the module: boilerplate + one mapping literal per `migrate:` entry.
3. DECISIONS lines for every tab incl. any split-verdict detail.
4. ROW_TRANSFORMS only if needed.
5. Typecheck (SPREADSHEETS keys land later — the module only uses the string
   keys, so it compiles standalone).

## Done when
- Module exports valid MAPPINGS+DECISIONS covering all 5 tabs; `npx tsc
  --noEmit` clean; no rejected tab/portion has a mapping.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s06-08-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S06-10 imports this module + adds the oct_workbook/daily_report store keys —
record exact exported symbol names in results. Write `results/S06-08.md`;
TL updates TRACKER.md.
