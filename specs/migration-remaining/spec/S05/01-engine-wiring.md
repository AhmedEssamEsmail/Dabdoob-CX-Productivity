# S05-01: engine wiring — new stores + mapping modules
Kind: mini
ID: S05-01
Parent: S05
Owner: dev
Depends: S03-02, S04-02
Criteria: PLAN #2,#4 (new mappings reachable by the engine)
Skills: none
Budget: files=1; actions=4; changed_lines=40; minutes=8

## Goal
Single-writer edit of `engine.ts`: add the `hct` and `v1_ops` store keys and
merge the new mapping modules into MODULE_MAPPINGS (and ROW_TRANSFORMS if
S04-02 exported one) so `--dry`/`migrate-all` see them.

## Files
- Edit: `src/features/shared/migration/engine.ts` | SPREADSHEETS record (~line 28-35), import block (~lines 14-16), MODULE_MAPPINGS (~line 85), ROW_TRANSFORMS (~lines 77-79) only

## Context
- `src/features/shared/migration/engine.ts:14-16,28-35,77-86` | exact regions
- `results/S03-02.md` + `results/S04-02.md` | exported symbol names + whether
  v1-ops exports ROW_TRANSFORMS
- `src/features/shared/platform/settings.ts:72` | hct id
  `1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`

## Contract
Add to `SPREADSHEETS`: `hct: '1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw'`
and `v1_ops: '1hul-T8Tc2h1nmk_9wM9bj8HmWM-_2ZeVIu_kOYpicyA'` with trailing
comments naming the sheets. Import `MAPPINGS as HCT_MAPPINGS` from
`./mappings/hct` and the v1-ops exports (`MAPPINGS as V1_MAPPINGS`, plus
`ROW_TRANSFORMS as V1_TRANSFORMS` + `DECISIONS as V1_DECISIONS` ONLY if the
module exports them — check the file, don't assume). Spread into
`MODULE_MAPPINGS`, `ROW_TRANSFORMS`, `MAPPING_DECISIONS` matching the existing
QQ/PC/DO pattern. Conditional imports are forbidden: if v1-ops lacks an
export, don't reference it. No other engine edits.
Out of scope: any other file; new dependencies; changing engine logic.

## Actions
1. Add the two SPREADSHEETS keys.
2. Add imports for hct.ts and v1-ops.ts exports that exist.
3. Spread them into MODULE_MAPPINGS / ROW_TRANSFORMS / MAPPING_DECISIONS.
4. Typecheck.

## Done when
- Both new modules are reachable; engine diffs are additive only.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s05-01-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S05-02 can now see the new mappings through the validator's mappings-dir
import; S05-03's `--dry` will read them. Write `results/S05-01.md`; TL
updates TRACKER.md.
