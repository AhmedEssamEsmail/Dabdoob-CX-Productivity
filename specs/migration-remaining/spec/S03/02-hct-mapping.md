# S03-02: HCT Sheet1 → dq_hct mapping module
Kind: mini
ID: S03-02
Parent: S03
Owner: dev
Depends: S01-01, S03-01
Criteria: PLAN #2 (HCT mapped into dq_hct)
Skills: none
Budget: files=1; actions=3; changed_lines=60; minutes=8

## Goal
New mapping module `mappings/hct.ts` exporting one TableMapping: HCT Sheet1 →
`dq_hct`, so the engine (once wired by S05-01) imports the roster master
idempotently.

## Files
- Create: `src/features/shared/migration/mappings/hct.ts` | one MAPPINGS export

## Context
- `specs/migration-remaining/source-inventory.md` | verbatim Sheet1 headers
  (S01-01 output — required; do not guess header spellings)
- `src/features/shared/migration/mappings/route-core.ts:36-66` | sheetToDb
  style to copy (db col -> lowercase sheet header)
- `src/features/shared/platform/settings.ts:72` | `roster_hct_ss_id` = the
  HCT id, tab Sheet1
- `src/features/shared/migration/mappings/route-core.ts:1-6` | module boilerplate
  (`import 'server-only'` + TableMapping type)

## Contract
One mapping: `spreadsheet: 'hct'` (key added by S05-01), `sheet: 'Sheet1'`,
`table: 'dq_hct'`, `columns:` = the 12 dq_hct cols (name,email,position,
department,section,manager,status,lwd,hiringDate,fdId,fdName,maqsamName),
`sheetToDb` mapping each camelCase db col to the ACTUAL lowercase sheet header
recorded in the inventory (e.g. hiringDate->'hiring date' style — copy the
headers verbatim, engine already lowercases), `upsertOn: 'email'`,
`require: ['email','name']`. Also export `DECISIONS: string[]` noting the tab
name source (settings.ts roster_hct_ss_id description says Sheet1 — if the
inventory found a different tab name, use IT and record the divergence).
Out of scope: engine.ts edits (S05-01), running anything, other stores.

## Actions
1. Create `mappings/hct.ts` with the header comment + the mapping literal,
   sheetToDb built from the inventory's recorded headers.
2. Add the DECISIONS export (tab-name provenance + any header divergences).
3. Typecheck.

## Done when
- `hct.ts` exports a well-formed MAPPINGS + DECISIONS; headers verbatim from
  the inventory doc.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s03-02-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S05-01 adds `SPREADSHEETS.hct` + imports this module into MODULE_MAPPINGS;
after that `--dry` reads the tab. Write `results/S03-02.md`; TL updates
TRACKER.md.
