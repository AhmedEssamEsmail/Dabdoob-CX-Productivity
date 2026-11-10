# S07-05: validate.ts parity — transform execution + S06 store keys
Kind: mini
ID: S07-05
Parent: S07
Owner: dev
Depends: S07-01
Criteria: reshard row 3; PLAN #6 (validator covers the new mappings without false artifacts)
Skills: none
Budget: files=1; actions=6; changed_lines=140; minutes=10

## Goal
Make migration/validate.ts report transform-keyed and new-store mappings
faithfully: collect sibling ROW_TRANSFORMS and run them before mapRow
(mirroring engine.ts:212-213), register `oct_workbook` (+ EXPECTED rows
for the three S06 tables) so call_transcripts resolves its real store
instead of `core`, and mirror S07-01's key scheme in valuesToObjects.

## Files
- Edit: `migration/validate.ts` | KNOWN_STORES + EXPECTED_TABLES additions, loadSiblingMappings transform collection, the rowsForAnalysis transform pass, valuesToObjects key scheme

## Context
- `migration/validate.ts:90-104,141-272` | KNOWN_STORES + EXPECTED_TABLES — add oct_workbook and the three S06 table rows here
- `migration/validate.ts:615-637,931-958` | sibling loader + the rowsForAnalysis construction site in validateTable
- `migration/validate.ts:771-782` | valuesToObjects — same blank/dup loss as the old readSheet
- `src/features/shared/migration/engine.ts:86-89,141-156,212-213` | transform registry semantics + S07-01's key scheme to mirror
- `src/features/shared/migration/mappings/ops-tabs.ts:103-172` | a sheet-keyed ROW_TRANSFORMS export (shape + guard contract to consume)

## Contract
Four bounded mechanisms in the named regions:
1. KNOWN_STORES += `oct_workbook: { id:
   '1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI', note: 'shared, verified
   sheet-access.md' }`; EXPECTED_TABLES += `aux_spans`,
   `call_transcripts` (module `vendor`, store `oct_workbook`) and
   `v1_task_occurrences` (module `people`, store `v1_ops`).
2. loadSiblingMappings also collects each module's `ROW_TRANSFORMS`
   export (duck-typed Record<string,(row,ctx)=>void>) into a sheet-keyed
   registry (sorted-file order, later wins — engine spread precedence);
   modules lacking the export are ignored, never fatal.
3. In validateTable, when `e.mapped && e.mapping` and rowsForAnalysis is
   built, look up `tf = TR[m.sheet] || TR[m.table]` and run
   `rowsForAnalysis.forEach((r,i)=>tf?.(r,{spreadsheet: m.spreadsheet,
   table: e.table, index: i}))` ONCE before analyzeRows/diffAndChecksum —
   the same order the engine applies.
4. valuesToObjects headers get the S07-01 scheme: blank -> `col_<a1>`,
   repeat -> `h#N` (comment cross-references engine.ts headerKeys).
Out of scope: engine.ts; diff/checksum math; the ''->null coercion in
valuesToObjects (existing validator semantic); output formatting.

## Actions
1. Add the oct_workbook KNOWN_STORES entry + the three EXPECTED_TABLES rows per contract.
2. Extend loadSiblingMappings to also return the collected transform registry; update its caller plumbing.
3. Apply the transform pass at the rowsForAnalysis site per contract.
4. Update valuesToObjects header handling to the unique-key scheme.
5. `npx tsc --noEmit`.
6. Run the Verify command; record store labels + skip columns for the four tables.

## Done when
- `npx tsc --noEmit` exits 0; targeted run shows call_transcripts with store=oct_workbook and a real src count (no core-fallback SRC-FAIL).
- qa_ctls/actions/refresh_log skip(req) counts reflect transform-populated keys — mass false skips gone, ledger lines real.

## Verify
- Run: `npx tsx migration/validate.ts --md --tables=call_transcripts,qa_ctls,actions,refresh_log > specs/migration-remaining/logs/s07-05-validate.log 2>&1; echo "exit=$?"; tail -c 2500 specs/migration-remaining/logs/s07-05-validate.log` -> exit=0; call_transcripts row shows oct_workbook store

## Handoff
PM/TL: re-run the full `--md` at the next integration gate — the round-2
caveat lifts; only honest artifacts remain. Write results/S07-05.md; TL
updates TRACKER.md.
