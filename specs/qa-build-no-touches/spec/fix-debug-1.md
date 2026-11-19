# fix-debug-1 — qa-build-no-touches (debug-1 report, all rows blocking)

Source: `reports/debug-1.md`. Two chained defects, both must land:
manual roster rows are skipped by `dqSyncRoster_` (fd identity columns never
populate) and `qeReadAgentRoster_` never indexes `freshdesk_name`.

## debug1-01: Patch FD identity fields onto manual roster rows during roster sync
Kind: mini
ID: debug1-01
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #1 (performer resolution works — roster fd columns populate)
Skills: none
Budget: files=2; actions=2; changed_lines=120; minutes=10

### Goal
When `dqSyncRoster_` encounters an existing roster row whose `source` is not
`'hct'` (e.g. `'manual'` sheet-migrated rows), it must still write the
HCT-owned identity fields (`freshdesk_id`, `freshdesk_name`, `maqsam_name`)
when they differ — while keeping `source`, role/TL/overrides and all other
manual-managed fields untouched. Currently `roster.ts:367` returns early so
the fd columns stay empty forever.

### Files
- Edit: `src/features/cx-hub/lib/roster.ts` | inside `dqSyncRoster_`, `res.rows.forEach` loop lines ~359-393, the `if (cur.source && cur.source !== 'hct') return` at ~line 367
- Edit: `tests/platform/dq-hct-snapshot.test.ts` | add ONE focused test in the existing `dqSyncRoster_` describe block reusing `install()`/`sheetRows()` fakes

### Context
- `src/features/cx-hub/lib/roster.ts:352-393` | the existing-row patch loop;
  `fields` already includes `freshdesk_id`/`freshdesk_name`/`maqsam_name` via
  `DQ_ROSTER_EXTRA`.
- `src/features/cx-hub/lib/roster.ts:234-251` | `row` carries
  `freshdesk_id`/`freshdesk_name`/`maqsam_name` from the HCT sheet.
- `tests/platform/dq-hct-snapshot.test.ts:44-80` | `install()` seeds
  `hubDb.tables.roster`; the sheet fixture header already includes
  'Fresh desk ID'/'Freshdesk Name'/'Maqsam Name' (currently empty strings).
- `specs/qa-build-no-touches/reports/debug-1.md` | dbg-1 row + Siblings note:
  do NOT flip `source` to 'hct' (activates `dqRosterPeople_` and changes
  productivity/aging behaviour).

### Contract
After sync, an existing `source !== 'hct'` row that matches an in-scope HCT
row by email has `freshdesk_id`, `freshdesk_name`, `maqsam_name` set from the
HCT row (only when they differ) and `synced_at` stamped; `source`, `role`,
`tl_email`, `role_override`, `tl_override`, `position` and every other field
stay exactly as the manual row had them. `source === 'hct'` and new-row
paths are unchanged. The update is pushed through the existing `updates`
array (`updateRows`) — no new write path.
Out of scope: `dqRosterPeople_`, `migration/migrate.ts`, any `source` value
changes, schema/migrations, backfill SQL, writer side (`fdActivityToCells_`).

### Actions
1. In `roster.ts`, replace the bare early return
   `if (cur.source && cur.source !== 'hct') return` so that before returning
   it still diffs `freshdesk_id`, `freshdesk_name`, `maqsam_name` between
   `row` and `cur`; when any differ it pushes
   `{ key: String(cur.email), patch }` (plus `synced_at: now`) onto `updates`
   and then returns — `source` and all manual fields untouched, no entry in
   `changes` needed (or a minimal one; keep the `changes` shape intact).
2. Add one test in `tests/platform/dq-hct-snapshot.test.ts`: seed a roster
   row `source: 'manual'` for an in-scope email with empty fd columns, give
   that person fdId/fdName in the sheet rows, run `dqSyncRoster_`, assert the
   roster row gained `freshdesk_id`/`freshdesk_name` and kept
   `source === 'manual'` and its manual `role`.

### Done when
- `dqSyncRoster_` patches the three fd/maqsam identity fields onto a manual
  row without flipping `source`.
- Existing `source === 'hct'` sync behaviour and the append path unchanged.
- New focused test passes; existing tests in the file still pass.

### Verify
- Run: `npx vitest run tests/platform/dq-hct-snapshot.test.ts` -> all pass.

### Handoff
Roster rows gain `freshdesk_id`/`freshdesk_name` on the next admin sync —
the data debug1-02's reader fix needs. Write results/debug1-01.md (<=10
lines); TL alone updates TRACKER.md.

## debug1-02: Index freshdesk_name in qeReadAgentRoster_ byName
Kind: mini
ID: debug1-02
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #1, #3 (resolution + regression test already committed)
Skills: none
Budget: files=1; actions=1; changed_lines=15; minutes=10

### Goal
`qeReadAgentRoster_` (engine-live.ts:117-140) builds `byName` only from
`r.fd_name || r.name`; the `fd_name` column does not exist in the roster
schema — the stored FD display name column is `freshdesk_name`, which the
fd_activities writer stores verbatim. Index each roster record under its
`freshdesk_name` too so freshly-mirrored `performer_name` values resolve.

### Files
- Edit: `src/features/cx-quality/lib/engine-live.ts` | `qeReadAgentRoster_` loop body, lines ~123-136

### Context
- `src/features/cx-quality/lib/engine-live.ts:117-140` | the whole function;
  `name` stays `r.fd_name || r.name` so resolved agents return the canonical
  roster `name` downstream.
- `src/features/cx-quality/lib/engine-live.ts:82-96` | `qeResolvePerformer_`
  does exact `byName[s]` lookups.
- `specs/qa-build-no-touches/reports/debug-1.md` | dbg-2 row; writer stores
  `freshdesk_name` (`vendor-apis.ts:189`).

### Contract
`byName` gains a second key: `const fdName = String(r.freshdesk_name || r.fd_name || '').trim(); if (fdName && !byName[fdName]) byName[fdName] = rec`.
`rec.name` remains the roster `name` (canonical join key); first-writer-wins
on key collision; excluded rows are still indexed and rejected downstream by
`qeResolvePerformer_` (unchanged semantics). No other logic changes.
Out of scope: `qeResolvePerformer_`, writer files, roster.ts, the test file.

### Actions
1. In `qeReadAgentRoster_`, after `byName[name] = rec`, add the fdName alias
   indexing exactly per Contract.

### Done when
- A roster row whose `freshdesk_name` differs from `name` resolves via
  `byName[freshdesk_name]`.
- `tests/quality/qe-performer-resolution.test.ts` (debugger-authored
  regression, already in tree) passes fully — including the
  `resolves freshdesk_name ...` case that fails today.

### Verify
- Run: `npx vitest run tests/quality/qe-performer-resolution.test.ts` -> all
  3 cases pass.

### Handoff
None — completes the reader side. Write results/debug1-02.md (<=10 lines);
TL alone updates TRACKER.md.
