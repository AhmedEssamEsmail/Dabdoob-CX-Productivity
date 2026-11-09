# FIX-06: updateRows batched upsert sends key + patch only (lost-update)
Kind: mini
ID: FIX-06
Parent: -
Owner: dev
Depends: none
Criteria: sec-1 finding sec-2 (LOW, blocking per task) — concurrent-writer lost update
Skills: none
Budget: files=2; actions=2; changed_lines=60; minutes=7

## Goal
`updateRows`' batched path upserts only `{[keyField]: key, ...patch}` instead
of the full `current` row merged with the patch — a concurrent change to an
unpatched column between the `select('*').in(...)` and the `upsert` is no
longer silently reverted.

## Files
- Edit: `src/features/shared/platform/repo.ts` | `updateRows` batched upsert payload (~lines 218-247)
- Edit: `tests/platform/repo.test.ts` | `describe('updateRows (batched upsert)')` — one regression case (lines ~166-240)

## Context
- `src/features/shared/platform/repo.ts:218-247` | `mergedByKey` currently feeds BOTH `out` and the upsert
- `reports/sec-1.md` finding sec-2 | exact fix: upsert `{[keyField]: u.key, ...data}`; keep the constraint-error fallback
- `tests/platform/repo.test.ts:166-240` | existing batched-upsert tests + mocked `db()`

## Contract
- Keep `out` unchanged: still the merged row (`{...current, ...data}`) per update.
- Build a separate per-key upsert-payload map: `{[keyField]: u.key, ...data}`
  where repeated updates to the same key accumulate their patches
  (later patch wins per column). `data` already has keyField deleted and
  carries the updated_by/updated_at stamps — keep that order.
- `.upsert([...payloadByKey.values()], { onConflict: keyField })`; keep the
  `/constraint|conflict|42P10/i` fallback to `updateRowsOneByOne` verbatim.
- `updateRowsOneByOne`, `findRow`, guard hook: untouched.
Out of scope: everything else in repo.ts and every other file.

## Actions
1. Add the patch-payload map in `updateRows`; switch the upsert to it.
2. Add a regression test: batched `updateRows` on rows where `current` has
   extra unpatched columns -> assert the mocked `upsert` received key +
   patched columns + stamps only (no unpatched `current` columns).

## Done when
- Upsert body contains only keyField + patch + stamps; `out` still merged rows.
- New regression test fails on the old payload shape; `tests/platform/repo.test.ts` green; `npx tsc --noEmit` -> 0.

## Verify
- Run: `npx vitest run tests/platform/repo.test.ts` -> green.

## Handoff
none. Write results/FIX-06.md (<=10 lines); TL alone updates TRACKER.md.
