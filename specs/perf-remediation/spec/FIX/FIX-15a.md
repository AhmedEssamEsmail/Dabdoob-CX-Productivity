# FIX-15a: Server-side predicates for eq-shape `qa_audits` reads (perf-1, part 1)
Kind: mini
ID: FIX-15a
Parent: -
Owner: dev
Depends: none
Criteria: perf-1 finding perf-1 (MED): whole-table `qaRows_('qa_audits')` on hot paths (pg_stat ~170ms mean, unbounded growth)
Skills: none
Budget: files=1; actions=4; changed_lines=80; minutes=8

## Goal
Add a filtered-read helper `qaRowsWhere_` and convert the THREE equality-shape
`qaRows_('qa_audits')` call sites (qaTicketClash_, my-audits, calibrations page)
so Postgres narrows rows instead of shipping the whole table. Result sets and
error behaviour stay byte-identical.

## Files
- Edit: `src/features/cx-quality/lib/server.ts` | new helper beside qaRows_ + the 3 cited call sites only

## Context
- `src/features/cx-quality/lib/server.ts:83-105` | `qaRows_`/`qaRowBy_` seam — mirror the same missingOk semantics (42P01/404 -> `[]`, other errors throw)
- `src/features/cx-quality/lib/server.ts:898-906` | site 1: `qaTicketClash_` — `.filter(a => String(a.ticket_id) === ticket && a.kind !== 'calibration')`
- `src/features/cx-quality/lib/server.ts:1000-1011` | site 2: my-audits — `.filter(a => a.kind === 'audit' && normEmail(a.agent_email) === user.email)` then sort/slice(0,80)
- `src/features/cx-quality/lib/server.ts:1428-1433` | site 3: calibrations — `forEach` keeping only `a.kind === 'calibration'` in auditsBy
- `src/features/shared/platform/stores.ts:37-70` | `StoreFilter` {eq,in,is} shape (read-only reference — do NOT edit stores.ts)

## Contract
- Add private `async function qaRowsWhere_(name: string, filter: { eq?: Record<string, unknown>; in?: Record<string, unknown[]>; is?: Record<string, null>; gte?: Record<string, unknown> }): Promise<Row[]>` next to `qaRows_`. It builds `db().from(name).select('*')`, applies each `eq` key, each `in` key (EMPTY value list -> return `[]` WITHOUT querying), each `is` key as `.is(k, null)`, and each `gte` key. Error handling identical to `qaRows_` (catch: 42P01/404 -> `[]`, rethrow otherwise).
- Site 1 (`qaTicketClash_`, ~line 900): `qaRowsWhere_('qa_audits', { eq: { ticket_id: ticket } })`; keep `a.kind !== 'calibration'` and the rest of the filter in memory.
- Site 2 (my-audits, ~line 1008): `qaRowsWhere_('qa_audits', { eq: { kind: 'audit', agent_email: user.email } })`; KEEP the existing `.filter(...)` conjuncts in memory unchanged (eq on raw `user.email` + retained `normEmail` check = provably identical output regardless of stored-case).
- Site 3 (calibrations, ~line 1431): `qaRowsWhere_('qa_audits', { eq: { kind: 'calibration' } })`; the retained `a.kind === 'calibration'` check stays as-is.
- No other call site, table, function or file changes. `qaRows_` itself is untouched.
Out of scope: sites at ~621/1109/1163/1281 (FIX-15b), all other `qaRows_` reads (qa_ctls, qa_disputes, qa_forms, ...), any schema/index work.

## Actions
1. Add `qaRowsWhere_` helper beside `qaRows_` with the contract semantics.
2. Convert `qaTicketClash_` audit read to `eq ticket_id`.
3. Convert my-audits audit read to `eq kind + agent_email`.
4. Convert calibrations audit read to `eq kind`.

## Done when
- The 3 sites call `qaRowsWhere_` with the specified predicates; no unfiltered `qaRows_('qa_audits')` remains at those sites.
- In-memory conjuncts retained => identical visible results.
- `npx tsc --noEmit` clean; `npx vitest run tests/golden/quality.test.ts` green.

## Verify
- Run: `npx tsc --noEmit` -> 0 errors; `npx vitest run tests/golden/quality.test.ts` -> all pass.

## Handoff
FIX-15b reuses `qaRowsWhere_` (incl. `in`/`gte` paths) for the join-shaped and date-window sites.
Write results/FIX-15a.md (<=10 lines); TL alone updates TRACKER.md.
