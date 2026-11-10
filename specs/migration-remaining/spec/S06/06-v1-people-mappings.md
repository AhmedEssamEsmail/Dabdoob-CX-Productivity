# S06-06: v1_ops people tabs -> mappings/v1-ops-people.ts
Kind: mini
ID: S06-06
Parent: S06
Owner: dev
Depends: S06-01, S06-04
Criteria: PLAN #1, #4 (v1_ops people tabs land idempotently)
Skills: none
Budget: files=1; actions=5; changed_lines=220; minutes=10

## Goal
Mapping module `mappings/v1-ops-people.ts` covering this group's tabs with
`migrate:` verdicts in decisions-v1-ops.md — TeamLeads, Agents,
AgentOneOnOnes, OneOnOnes, KPI, Standups — into the tables the decision doc
names (one_on_one_*, kpi_*_log, sched_team, or `NEW:` tables), each with its
upsertOn natural key.

## Files
- Create: `src/features/shared/migration/mappings/v1-ops-people.ts` | MAPPINGS + DECISIONS (+ ROW_TRANSFORMS only if a column needs synthesis)

## Context
- `specs/migration-remaining/decisions-v1-ops.md` | required: per-tab target,
  upsertOn, verbatim sheetToDb pairs — do NOT guess headers
- `src/features/shared/migration/mappings/v1-ops.ts` | sibling module
  boilerplate + DECISIONS pattern
- `supabase/migrations/008_people.sql:134-186` +
  `011_remote_reconcile.sql:83-113` | one_on_one_*/kpi_*_log/tlp_team targets
- `src/features/shared/migration/engine.ts:80-83,152-181` | ROW_TRANSFORMS
  sheet-keyed global namespace + mapRow coercion rules

## Contract
One TableMapping per `migrate:` tab: `spreadsheet: 'v1_ops'`, `sheet` = exact
tab name, `table`/`upsertOn`/`sheetToDb` verbatim from the decision doc,
`require` = upsert key cols. `NEW:`-target tabs map identically (S06-04 DDL,
PM-gated apply). `rejected:`/`covered:` tabs get a DECISIONS line only.
Export MAPPINGS + DECISIONS always; ROW_TRANSFORMS only if needed —
sheet-keyed, collision-aware (generic names like 'KPI' or 'Agents' may exist
in other workbooks: if the transform is shape-specific that's fine, note it;
if ambiguous prefer pure sheetToDb).
Out of scope: engine.ts (S06-10); sched/misc tabs (S06-05/07); runs.

## Actions
1. Read the decision doc entries for the 6 tabs.
2. Create the module: boilerplate + one mapping literal per `migrate:` tab.
3. DECISIONS lines for every tab: mapped target+key, or the verdict reason.
4. ROW_TRANSFORMS only if needed (guarded, sheet-keyed).
5. Typecheck.

## Done when
- Module exports valid MAPPINGS+DECISIONS covering all 6 tabs; `npx tsc
  --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s06-06-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S06-10 imports this module's exports — record exact symbol names in results.
Write `results/S06-06.md`; TL updates TRACKER.md.
