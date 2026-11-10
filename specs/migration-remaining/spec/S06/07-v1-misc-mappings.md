# S06-07: v1_ops misc tabs -> mappings/v1-ops-misc.ts
Kind: mini
ID: S06-07
Parent: S06
Owner: dev
Depends: S06-01, S06-04
Criteria: PLAN #1, #4 (v1_ops misc tabs land idempotently or are rejected
with reason)
Skills: none
Budget: files=1; actions=5; changed_lines=220; minutes=10

## Goal
Mapping module `mappings/v1-ops-misc.ts` covering this group's tabs with
`migrate:` verdicts in decisions-v1-ops.md — RoadmapVisibility, Settings,
Tickets, IdentityPins, HardCases, TaskOccurrences — into the tables the
decision doc names, each with its upsertOn natural key.

## Files
- Create: `src/features/shared/migration/mappings/v1-ops-misc.ts` | MAPPINGS + DECISIONS (+ ROW_TRANSFORMS only if a column needs synthesis)

## Context
- `specs/migration-remaining/decisions-v1-ops.md` | required: per-tab target,
  upsertOn, verbatim sheetToDb pairs; expected rejections include Tickets
  (⊆ landed tickets) and IdentityPins (credential material) — follow the doc
- `src/features/shared/migration/mappings/v1-ops.ts` | sibling module
  boilerplate; TaskOccurrences relates to its Tasks->actions mapping
  (`id, taskId, dueDate, status, doneAt, note, updatedBy, updatedAt`)
- `supabase/migrations/010_desk.sql:116-169` + `011_remote_reconcile.sql:11-30`
  | actions/action_task_details/options candidates
- `src/features/shared/migration/engine.ts:80-83,152-181` | ROW_TRANSFORMS
  sheet-keyed global namespace + mapRow coercion rules

## Contract
One TableMapping per `migrate:` tab: `spreadsheet: 'v1_ops'`, `sheet` = exact
tab name, `table`/`upsertOn`/`sheetToDb` verbatim from the decision doc,
`require` = upsert key cols. TaskOccurrences: if the doc targets an existing
table map it there; a `NEW:` target maps identically after S06-04.
`rejected:`/`covered:` tabs get a DECISIONS line only — never map a tab the
doc rejected (esp. credential-bearing IdentityPins).
Out of scope: engine.ts (S06-10); sched/people tabs (S06-05/06); runs.

## Actions
1. Read the decision doc entries for the 6 tabs.
2. Create the module: boilerplate + one mapping literal per `migrate:` tab.
3. DECISIONS lines for every tab: mapped target+key, or the verdict reason.
4. ROW_TRANSFORMS only if needed (guarded, sheet-keyed).
5. Typecheck.

## Done when
- Module exports valid MAPPINGS+DECISIONS covering all 6 tabs; `npx tsc
  --noEmit` clean; no rejected tab has a mapping.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s06-07-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S06-10 imports this module's exports — record exact symbol names in results.
Write `results/S06-07.md`; TL updates TRACKER.md.
