# S06-05: v1_ops scheduling tabs -> mappings/v1-ops-sched.ts
Kind: mini
ID: S06-05
Parent: S06
Owner: dev
Depends: S06-01, S06-04
Criteria: PLAN #1, #4 (v1_ops sched tabs land idempotently)
Skills: none
Budget: files=1; actions=5; changed_lines=180; minutes=10

## Goal
Mapping module `mappings/v1-ops-sched.ts` covering this group's tabs with
`migrate:` verdicts in decisions-v1-ops.md — ShiftPlan, ShiftOverrides,
TLOffDays, ShiftRequests, HourOverrides — into the sched_* tables the
decision doc names, each with its upsertOn natural key.

## Files
- Create: `src/features/shared/migration/mappings/v1-ops-sched.ts` | MAPPINGS + DECISIONS (+ ROW_TRANSFORMS only if a column needs synthesis)

## Context
- `specs/migration-remaining/decisions-v1-ops.md` | required: per-tab target,
  upsertOn, verbatim sheetToDb pairs — do NOT guess headers
- `src/features/shared/migration/mappings/v1-ops.ts` | sibling module
  boilerplate + DECISIONS pattern
- `supabase/migrations/007_queue.sql:106-144` | sched_* target columns
- `src/features/shared/migration/engine.ts:80-83,152-181` | ROW_TRANSFORMS
  keyed by sheet name (global namespace) + mapRow coercion rules

## Contract
One TableMapping per `migrate:` tab: `spreadsheet: 'v1_ops'` (key exists),
`sheet` = exact tab name, `table`/`upsertOn`/`sheetToDb` verbatim from the
decision doc, `require` = the upsert key cols. Tabs whose verdict is
`NEW:` table from S06-04 map identically (table lands via PM-gated apply).
Tabs with `rejected:`/`covered:` verdicts get a DECISIONS line, no mapping.
Export MAPPINGS + DECISIONS always; ROW_TRANSFORMS only if the decision doc
requires a synthesized col — sheet-keyed fns, and skip any transform whose
sheet name could collide with another workbook's same-named tab (note the
choice in DECISIONS).
Out of scope: engine.ts (S06-10); other v1_ops tabs (S06-06/07); runs.

## Actions
1. Read the decision doc entries for the 5 tabs.
2. Create the module: boilerplate + one mapping literal per `migrate:` tab.
3. DECISIONS lines for every tab: mapped target+key, or the verdict reason.
4. ROW_TRANSFORMS only if needed (guarded, sheet-keyed).
5. Typecheck.

## Done when
- Module exports valid MAPPINGS+DECISIONS covering all 5 tabs (mapping or
  documented non-migrate verdict); `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s06-05-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S06-10 imports this module's exports into engine.ts — record exact exported
symbol names in results. Write `results/S06-05.md`; TL updates TRACKER.md.
