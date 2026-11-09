# FIX-09: updateRows batched upsert — heterogeneous patch key-sets
Kind: mini
ID: FIX-09
Parent: -
Owner: dev
Depends: none
Criteria: data report data-1 (BLOCKER) — PostgREST unions keys and fills missing
cols with column DEFAULTS on conflict-update (silently resetting unpatched
columns), or 400s on mismatched keys
Skills: none
Budget: files=2; actions=3; changed_lines=90; minutes=8

## Goal
`updateRows`' batched path never sends upsert rows with differing key-sets in
one request: group `patchByKey` rows by their identical patch-key signature
(sorted column names) and issue one `.upsert()` per group. Live callers send
heterogeneous patches (actions.ts carried {due_date} vs done {status,outcome_note};
one-on-ones-delete {status,...,source_deleted_at} vs {source_deleted_at};
roster.ts per-field diffs). Per-group upserts keep the FIX-06 key+patch-only
contract (no default-fill, no lost-update regression).

## Files
- Edit: `src/features/shared/platform/repo.ts` | `updateRows` upsert block (~lines 239-248)
- Edit: `tests/platform/repo.test.ts` | `describe('updateRows (batched upsert)')` — one regression case

## Context
- `src/features/shared/platform/repo.ts:218-249` | `patchByKey` -> single `.upsert([...])` is the defect site
- `reports/data-1.md` finding data-1 | caller evidence + both PostgREST failure modes
- `tests/platform/repo.test.ts` | mocked `db()` captures upsert bodies; real PostgREST is unverifiable here — assert payload shape

## Contract
- `out`, `mergedByKey`, stamps, guard hook, `updateRowsOneByOne` and the
  `/constraint|conflict|42P10/i` fallback: unchanged. The fallback wraps the
  whole grouped block (any group's upsert error -> per-row fallback, as now).
- Each upsert body row still contains only `{keyField, ...patch}` for its key;
  rows in one request MUST share an identical key-set.
- Signature = sorted list of payload column names per row; group order
  irrelevant; single-signature batches behave exactly as today (one upsert).
Out of scope: every other file, every other function in repo.ts.

## Actions
1. In `updateRows`, group `[...patchByKey.values()]` by signature
   (`Object.keys(p).sort().join('\u0001')` or equivalent); upsert each group
   sequentially with the same `onConflict: keyField` and error handling.
2. Regression test: batched `updateRows` where two updates carry different
   patch key-sets -> assert each captured upsert call's rows share one
   key-set (and no row gains columns it did not patch).
3. Keep the existing FIX-06 payload-shape test green.

## Done when
- No single upsert request mixes rows with different key-sets.
- New regression test fails on the old single-upsert code; repo.test.ts green;
  `npx tsc --noEmit` -> 0 errors.

## Verify
- Run: `npx vitest run tests/platform/repo.test.ts` -> green.

## Handoff
none. Write results/FIX-09.md (<=10 lines); TL alone updates TRACKER.md.
