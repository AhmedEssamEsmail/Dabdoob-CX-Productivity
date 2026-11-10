# S04-02: V1 ops workbook → actions mapping module
Kind: mini
ID: S04-02
Parent: S04
Owner: dev
Depends: S01-01
Criteria: PLAN #4 (V1 ops workbook → lead tasks)
Skills: none
Budget: files=1; actions=4; changed_lines=140; minutes=10

## Goal
New mapping module `mappings/v1-ops.ts` mapping the V1 ops workbook's
lead-task tab(s) (`1hul-T8…`) into `actions` so `migrate-all --tables actions`
lands them idempotently. This is the `importV1LeadTasks` substitute — the
legacy fn was never ported and its source file is absent, so the engine
mapping is the sanctioned path.

## Files
- Create: `src/features/shared/migration/mappings/v1-ops.ts` | MAPPINGS + DECISIONS (+ ROW_TRANSFORMS export only if action_id synthesis is needed)

## Context
- `specs/migration-remaining/source-inventory.md` | verbatim v1_ops tab names
  + headers (S01-01 — required; do not guess)
- `supabase/migrations/008_people.sql:10-36` | actions DDL — PK action_id,
  NOT NULL DEFAULT '' cols (title/description/owner_email/assigned_by/
  source_type/source_id/series_id/topic/status/outcome_note/closed_by/
  visibility), due_date DATE, track_as_task boolean
- `src/features/shared/migration/mappings/route-core.ts:1-10,36-66` | module
  boilerplate + sheetToDb style
- `specs/megaplan/audits/people.md:30` | importV1LeadTasks = GATED G8 context

## Contract
Mapping(s): `spreadsheet: 'v1_ops'` (key added by S05-01), `table: 'actions'`,
one entry per task-shaped tab recorded in the inventory. Map the actions cols
the tab carries via `columns` + `sheetToDb` (headers verbatim from the
inventory). Hard requirements: `action_id` — from the tab's id column when
present, else a `ROW_TRANSFORMS` export with a sheet-keyed fn synthesizing
`row.action_id = 'v1-' + ctx.index` (guarded); `source_type = 'v1'` via the
same transform or a constant column; `require: ['action_id','title']`;
`upsertOn: 'action_id'`. status normalized to the open/closed vocab via
transform only if the inventory shows free-text statuses — record the mapping
used in DECISIONS. If NO task-shaped tab exists, export an empty MAPPINGS and
a DECISIONS entry 'v1_ops: no task tab found — rejected' (bounded either/or).
Out of scope: engine.ts (S05-01), other V1 tabs, runs.

## Actions
1. Read inventory §v1_ops; pick task-shaped tab(s); create `v1-ops.ts` with
   boilerplate + mapping literal(s) (columns/sheetToDb verbatim headers).
2. Add ROW_TRANSFORMS export only if action_id/source_type/status synthesis
   is needed (sheet-keyed, guarded).
3. DECISIONS lines: tab chosen, id source, status vocab mapping, or the
   'no task tab' rejection.
4. Typecheck.

## Done when
- `v1-ops.ts` exports valid MAPPINGS+DECISIONS (±ROW_TRANSFORMS) or the
  documented empty-rejection.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s04-02-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S05-01 adds `SPREADSHEETS.v1_ops` + merges MAPPINGS (and ROW_TRANSFORMS if
exported) — engine merge must be referenced in results. Write
`results/S04-02.md`; TL updates TRACKER.md.
