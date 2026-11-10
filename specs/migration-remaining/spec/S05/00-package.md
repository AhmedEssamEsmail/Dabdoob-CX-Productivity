# S05: engine wiring + validator + verification + report
Kind: package
ID: S05
Dispatch: NEVER

## Goal and contract
Close the loop: wire the new mapping modules into the engine (SPREADSHEETS
keys + MODULE_MAPPINGS/ROW_TRANSFORMS merges — engine.ts has exactly ONE
writer, this leaf), extend `migration/validate.ts` inventory for the new
tables/stores, run the read-only verification (`migrate-all --dry`, validator
`--md`, the PLAN #7 read-only proof grep), then write the final docs
(`migration-run-2.md`, `migration-report.md` update, `source-inventory.md`
final states). Live apply/runs stay PM approval gates between S05-03 and
S05-04. Non-goal: running any write path.

## Children
Index: `S05/00-index.md`
- wiring -> S05-01 (depends S03-02, S04-02)
- validator -> S05-02 (depends S05-01)
- verification -> S05-03 (depends S05-02 + all flip/mapping leaves)
- docs -> S05-04 (last; depends S05-03 + PM approval-gated runs)

## Completion
`--dry` reads every new mapping, validator covers them, read-only proof grep
is clean, docs record post-run state. Not a developer assignment.
