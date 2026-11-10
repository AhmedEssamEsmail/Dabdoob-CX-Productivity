# S07-01: engine readSheet — positional + duplicate header keys
Kind: mini
ID: S07-01
Parent: S07
Owner: dev
Depends: none
Criteria: reshard row 1 (unlabeled-column + duplicate-header support)
Skills: none
Budget: files=1; actions=4; changed_lines=60; minutes=8

## Goal
`readSheet` emits a stable key for EVERY physical column so header-less
cells and repeated headers stop being dropped/overwritten: blank header at
index i -> `col_<a1-letter>` (index 4 -> `col_e`); a repeated header `h`
keeps `h` on first use, later occurrences become `h#2`, `h#3`, … One
exported pure helper plus its use inside readSheet.

## Files
- Edit: `src/features/shared/migration/engine.ts` | readSheet block (~lines 141-156) plus the new exported helper beside it

## Context
- `src/features/shared/migration/engine.ts:141-156` | current readSheet — `obj[header]` drops blank headers and last-wins on duplicates
- `specs/migration-remaining/results/S06-08.md` | the two blockers this unlocks (FD_AUX E..G; 'Agent Email' duplicate)
- `src/features/shared/migration/mappings/ops-tabs.ts:107-172` | transform style the synthetic keys must serve

## Contract
New export `headerKeys(rawHeader: unknown[]): string[]`: trim+lowercase
each cell; blank -> `col_` + the A1 letter(s) of its index (0->a … 25->z,
26->aa); a per-name counter turns repeats into `h#2`,`h#3`. readSheet
builds `const keys = headerKeys(rows[0])` then assigns
`obj[keys[i]] = row[i]` — verbatim cells (`''` included) and the existing
comment stay untouched; no other engine logic changes.
Docblock invariant: every previously-meaningful key keeps its meaning
EXCEPT a duplicated header, which now resolves to the FIRST occurrence
(previously last) — mapping authors needing a later occurrence must name
`h#N`; FD_AUX-style unlabeled cells are reachable only via `col_<letter>`.
Out of scope: mapping edits (S07-02/03); validate.ts (S07-05);
readSheetRaw/migrateTable/backfillTrackerRecords; deps or .env edits.

## Actions
1. Add exported pure `headerKeys` helper implementing the scheme + docblock contract above (no I/O).
2. Rewire readSheet's header map to `headerKeys(rows[0])` and key row objects off it; keep the verbatim-cell comment.
3. `npx tsc --noEmit`.
4. Run the Verify probe; confirm positional + duplicate keys print as expected.

## Done when
- `npx tsc --noEmit` exits 0; the readSheet diff is limited to the key-scheme change + helper.
- Probe output contains `"col_e","col_f","col_g"` for trailing blanks and `"a","a#2","a#3"` for repeats.

## Verify
- Run: `npx tsx -e "import('./src/features/shared/migration/engine').then(m=>console.log(JSON.stringify(m.headerKeys(['Agent name','Status name','Start time','End time','','',''])),JSON.stringify(m.headerKeys(['a','a','a']))))" > specs/migration-remaining/logs/s07-01-keys.log 2>&1; echo "exit=$?"; type specs\migration-remaining\logs\s07-01-keys.log` -> exit=0 and both expected key lists in the log

## Handoff
`col_<letter>` and `h#N` are the contract S07-02 (FD_AUX cols E..G) and
S07-03 (first-occurrence 'agent email') consume; S07-05 mirrors the scheme
in validate.ts valuesToObjects. Write results/S07-01.md (<=10 lines); TL
updates TRACKER.md.
