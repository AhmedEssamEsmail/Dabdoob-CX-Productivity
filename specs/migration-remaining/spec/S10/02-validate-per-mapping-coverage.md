# S10-02: validate.ts — every mapping contributes src/skips (kill byTable last-wins)
Kind: mini
ID: S10-02
Parent: S10
Owner: data-engineer
Depends: none
Criteria: PLAN #6; finding data-2 (reports/data-1.md) — MED
Skills: none
Budget: files=1; actions=5; changed_lines=150; minutes=10

## Goal
`buildInventory` merges mappings into ONE `InventoryEntry` per table
(`byTable`, last-wins `e.mapping`), so dual-source tables validate only the
last mapping: `qa_ctls` shows quality src=87 while daily_report 'CTL & Quality'
(1,788 src) is invisible; same shadowing for AgentOneOnOnes (36),
AUXes Exceptions (58), and core-vs-v1 sched_*/actions mappings. Make every
mapping contribute a visible source/skip accounting.

## Files
- Edit: `migration/validate.ts` | `buildInventory` ~680-729, `applyMapping` ~706-719, the read/analyse loop ~963-997

## Context
- `migration/validate.ts:680-729` | `byTable` map + `ensure`/`applyMapping` —
  `e.mapping` is overwritten/merged per origin, `e.sheet` is single-valued
- `migration/validate.ts:963-997` | read loop: candidates from `e.sheet`/
  `e.sheetGuesses`, transforms via `ctx.rowTransforms[m.sheet]`, then
  `analyzeRows` + `diffAndChecksum`
- `src/features/shared/migration/mappings/ops-tabs.ts` | CTL A..J -> qa_ctls
  mapping (oct_workbook store) — the shadowed source
- `src/features/shared/migration/mappings/v1-ops-people.ts` | AgentOneOnOnes +
  OneOnOnes both -> one_on_one_logs
- `specs/migration-remaining/logs/tl4-dry.log` | per-mapping dry-run src
  counts to sanity-check against

## Contract
- Keep ONE ledger row per table (124-row shape preserved). Extend the entry to
  hold ALL its mappings (e.g. `e.mappings: RawMapping[]`, keep `e.mapping` as
  the primary/first for existing consumers).
- In the read/analyse loop: for EACH mapping of the entry, resolve its own
  storeRef + sheet, read it, run its transform, and accumulate
  `r.sourceRows` = sum over mappings; skip analysis + diff run per mapping's
  own rows (combined per-table result stays valid).
- A table with >1 contributing mapping gets a ledger/notes line
  `… combined from N mappings (table←store/sheet …)` and its row is marked
  multi-source (e.g. `module`/note suffix 'combined') so reviewers see the Δ
  is aggregated.
- No new READ of tabs already covered by guesses beyond what mappings declare;
  route.ts-origin mappings still lose to mappings/-origin on the SAME
  store+sheet pair (existing precedence preserved per mapping).
Out of scope: engine.ts, mapping files, EXPECTED_TABLES content, the md
writer's table shape (may add a 'combined' note column cell only if trivial).

## Actions
1. InventoryEntry: add `mappings: RawMapping[]`; `applyMapping` pushes every
   mapping (dedupe route.ts vs mappings/ duplicates on table+store+sheet);
   keep `e.mapping`/`e.sheet` pointing at the first non-route.ts mapping.
2. Read loop: iterate `e.mappings` — resolve store ids per mapping's storeRef,
   read its declared sheet (fall back to sheetGuesses only when a mapping has
   no sheet), transform + analyse each source's rows, accumulate src/skips.
3. Mark multi-source rows 'combined' + emit per-mapping ledger lines.
4. Sanity-check qa_ctls shows BOTH sources (87 quality + 1,788 CTL&Quality)
   and one_on_one_logs/tracker_records/sched_* show combined counts.
5. Run `--md` and record the new combined rows in results.

## Done when
- `npx tsx migration/validate.ts --md` exit=0; log tail bounded.
- qa_ctls row reports combined src (contains 1,788 + 87 contribution) and is
  flagged multi-source; no mapping emits zero ledger/src contribution.
- Table row count unchanged (124) — aggregation, not row duplication.

## Verify
- Run: `npx tsx migration/validate.ts --md > specs/migration-remaining/logs/s10-validate.log 2>&1` -> exit=0

## Handoff
The combined-source rows become the data-gate's re-check scope.
Write results/S10-02.md (<=10 lines); TL alone updates TRACKER.md.
