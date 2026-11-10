# S08-05: namespace-prefix v1 one_on_one_logs log_ids
Kind: mini
ID: S08-05
Parent: S08
Owner: dev
Depends: none
Criteria: PLAN #5; finding qa-5 (reports/qa-1.md)
Skills: none
Budget: files=1; actions=3; changed_lines=15; minutes=8

## Goal
Both v1 1:1 tabs map `log_id <- id` unnamespaced into `one_on_one_logs`
(PK log_id, shared with the core workbook mapping). A v1 id equal to a core
log_id — or shared across the two v1 tabs — silently upsert-overwrites an
existing row. Prefix the ids in the existing ROW_TRANSFORMS.

## Files
- Edit: `src/features/shared/migration/mappings/v1-ops-people.ts` | the two transforms + DECISIONS strings

## Context
- `src/features/shared/migration/mappings/v1-ops-people.ts:55-70` | the two
  transforms run on RAW rows before mapRow; `row.id` is the sheet's id cell
  (sheetToDb maps log_id<-id afterwards)
- `src/features/shared/migration/mappings/v1-ops-people.ts:30-52` | the two
  mappings + `require: ['log_id']`
- `reports/qa-1.md` row qa-5 | collision hazard (same class the actions
  `v1-` prefix solved)

## Contract
In `AgentOneOnOnes` transform set `row.id = 'v1-agent-' + <trimmed id>` when
id is non-blank; in `OneOnOnes` set `row.id = 'v1-tl-' + <trimmed id>`
(per-tab prefixes kill BOTH the core collision AND the inter-v1-tab collision;
'v1-' alone would leave the latter). Blank ids stay blank so `require` still
drops the row. kind/subsummary logic untouched.
Out of scope: core one_on_one_logs mapping; any other file; dedupe_key work.

## Actions
1. Add the 'v1-agent-' prefix in the AgentOneOnOnes transform.
2. Add the 'v1-tl-' prefix in the OneOnOnes transform.
3. Update the two DECISIONS strings to record the prefixed log_id scheme.

## Done when
- `grep -n "v1-agent-\|v1-tl-" src/features/shared/migration/mappings/v1-ops-people.ts`
  -> 2 transform sites + DECISIONS mentions.
- `npx tsc --noEmit` exit=0.

## Verify
- Run: `npx tsc --noEmit` -> exit=0
- Run: `grep -n "row.id" src/features/shared/migration/mappings/v1-ops-people.ts`
  -> both prefix assignments present and guarded on non-blank id.

## Handoff
v1 1:1 log_ids are namespaced; live upsert cannot overwrite core or
cross-tab rows.
Write results/S08-05.md (<=10 lines); TL alone updates TRACKER.md.
