# S08-04: reserved-word-safe onConflict target in the migration engine
Kind: mini
ID: S08-04
Parent: S08
Owner: dev
Depends: none
Criteria: PLAN #5; finding qa-4 (reports/qa-1.md)
Skills: none
Budget: files=2; actions=4; changed_lines=60; minutes=10

## Goal
`mail_log` upserts with `upsertOn: 'sent_at,to,subject'`; `to` is a Postgres
reserved word and PostgREST interpolates onConflict verbatim (likely 42601 at
live upsert). Make the engine pass safely-quoted identifiers to `onConflict`
while the in-memory dedupe seen-map keeps using the unquoted column keys.

## Files
- Edit: `src/features/shared/migration/engine.ts` | upsertOn seen-map + upsert call region ~lines 245-263
- Create: `tests/lib/migration-conflict-target.test.ts` | focused unit test of the new helper only

## Context
- `src/features/shared/migration/engine.ts:245-263` | keys = upsertOn.split(',')
  feeds BOTH the seen-map (`r[k]` lookups need the RAW column names) and
  `onConflict: mapping.upsertOn` (needs quoted identifiers)
- `src/features/shared/migration/mappings/people-core.ts:247` | the mail_log
  mapping carrying the reserved word
- `tests/jobs/mirrors.test.ts:50` | existing upsert-mock test convention

## Contract
Add a small exported pure helper (e.g. `conflictTarget(upsertOn: string)`)
that returns the onConflict string with every identifier double-quoted
(`'sent_at,"to",subject'` -> quoting ALL keys is the uniform-safe form:
`'"sent_at","to","subject"'`). Use it ONLY for the `onConflict` option; the
seen-map split stays on the raw upsertOn keys. Do not change any mapping file.
Out of scope: live PostgREST verification (remains an approval-runbook
caveat); other engine code; mapping files.

## Actions
1. Add the exported `conflictTarget` helper in engine.ts.
2. Switch `onConflict: mapping.upsertOn` to `onConflict: conflictTarget(...)`.
3. Write the focused test: `'sent_at,to,subject'` -> '"sent_at","to","subject"';
   single key -> '"dedupe_key"'; whitespace around commas tolerated.
4. Run the test + tsc.

## Done when
- `npx vitest run tests/lib/migration-conflict-target.test.ts` exit=0.
- `npx tsc --noEmit` exit=0.
- `grep -n "onConflict" src/features/shared/migration/engine.ts` shows the
  helper, never the raw upsertOn.

## Verify
- Run: `npx vitest run tests/lib/migration-conflict-target.test.ts` -> pass
- Run: `npx tsc --noEmit` -> exit=0

## Handoff
mail_log live upsert no longer risks 42601; quoting is uniform so future
reserved-word columns are covered too. Runbook caveat updated to "verify
first batch succeeds" instead of "verify bare `to` resolves".
Write results/S08-04.md (<=10 lines); TL alone updates TRACKER.md.
