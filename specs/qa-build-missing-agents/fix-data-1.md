# fix-data-1 — qa-build-missing-agents

Fixes for blocking finding data-1 in `reports/data-1.md` (data review, round 1).
Bug: `extraTaken` (request/non-ticket `qa_queue` rows this quota week) is keyed
by `qeCanonAgent_(agent_name)` = first+last ('Abdelsamad Mohamed'), while
`weekTaken`/`qeDraw_` join on raw roster names
('Abdelsamad Mohamed Abdelsamad Youssef'). Requests land on a phantom key and
are never subtracted from slots -> agents with requests get over-offered past
the 30-offer week cap. Latent today (0 such rows), so no visible symptom yet.
Chosen fix (report option A): key `extraTaken` by the raw `agent_name` —
exactly the spelling `QE_LOG_COL['Agent']` and pool `agent` already use.
`qa_queue.agent_name` is always the full roster/directory name
(`qaTicketQueueRow_`/`qaNonTicketRow_`/import all store `agent.name`).
LOW data-2 (expired rows counting into weekTaken): DEFERRED by TL — parity
presumed, no expired rows exist to verify legacy intent; changing quota
accounting without evidence is a policy decision, not a fix.
Legacy-parity repo: keep `qe*`/`qa*` names verbatim; parity, not improvement.
No schema changes, no remote DB writes, no deps, no `.env*`, no package.json.

## data1-01: key extraTaken by the raw roster name
Kind: mini
ID: data1-01
Parent: fix-data-1
Owner: dev
Depends: none
Criteria: PLAN #2, #3 (finding data-1)
Skills: none
Budget: files=3; actions=4; changed_lines=90; minutes=9

### Goal
`extraTaken` keys must equal the raw `agent_name` spelling (full roster name)
so `qeDraw_`'s merge into `weekTaken[a].Requested` hits the same key the slot
math reads — request/non-ticket items actually consume weekly offer slots.

### Files
- Edit: `src/features/cx-quality/lib/server.ts` | `qaRequestedTaken_` key line only (~:2210)
- Edit: `src/features/cx-quality/lib/pure.ts` | `qaRequestedTakenFor_` key line only (:328) + its doc comment (:321)
- Create: `tests/quality/qa-requested-taken-key.test.ts` | regression test

### Context
- `specs/qa-build-missing-agents/reports/data-1.md` row data-1 | evidence + approved fix options
- `src/features/cx-quality/lib/engine-live.ts:792-795` | `qeDraw_` merge: `weekTaken[a].Requested += extraTaken[a]` — `a` must match `qePartitionLog_` keys (:719, raw `QE_LOG_COL['Agent']`)
- `src/features/cx-quality/lib/engine.ts:755-758` | `qeCanonAgent_` truncates to first+last — that is the mismatch source; do NOT change it (other callers rely on it)

### Contract
In BOTH functions (`qaRequestedTaken_`, `qaRequestedTakenFor_` — identical
logic, keep them twins) replace `qeCanonAgent_(q.agent_name)` with the raw
agent name: `String(q.agent_name || '').trim()` (trim is the only tolerance;
no canon truncation). Keep every other clause (source/non-ticket filter,
waived/passed skip, weekStart cutoff, `if (k)` guard, `Requested` aggregation)
byte-identical in behaviour. Update the `qaRequestedTakenFor_` doc comment so
it no longer claims qeCanonAgent_ keying. Do not touch `qeDraw_`,
`qePartitionLog_`, `qeCanonAgent_`, or any other function/caller.
New regression test: unit-test `qaRequestedTakenFor_` with `qa_queue`-shaped
rows whose `agent_name` is a full roster name ('First Middle Last Last'),
`source: 'request'` (and one non-ticket row), `queue_date >= weekStart`:
assert the returned key is the FULL name (not 'First Last'), count correct,
and waived/passed/pre-weekStart rows excluded. Fails on old code, passes on fix.

### Actions
1. Change the key expression in `qaRequestedTaken_` (server.ts) as above.
2. Change the key expression identically in `qaRequestedTakenFor_` (pure.ts) + fix its doc comment.
3. Write `tests/quality/qa-requested-taken-key.test.ts` per contract.
4. Run the new test and typecheck.

### Done when
- Both functions key by raw `agent_name`; no other behaviour changed.
- `npx vitest run tests/quality/qa-requested-taken-key.test.ts` passes.
- `npx vitest run tests/quality/` — no new failures vs baseline.
- `npx tsc --noEmit` clean (no new errors).

### Verify
- Run: `npx vitest run tests/quality/` -> all pass (or only pre-existing failures unrelated to this leaf)

### Handoff
None. Write results/data1-01.md (<=10 lines); TL alone updates TRACKER.md.
