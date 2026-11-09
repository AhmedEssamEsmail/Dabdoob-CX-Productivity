# FIX-20: Emit case-insensitive status or-terms in `dqTicketsReadOr_` (qa-1)
Kind: mini
ID: FIX-20
Parent: -
Owner: dev
Depends: none
Criteria: qa-3 finding qa-1 (MED): `dqTicketsReadOr_` emits raw/lower/upper `status.in` variants only, but `dqBuildAging_` accepts `st.trim().toLowerCase()` — stored variants like `'Waiting on Customer'`, `'oPen'`, `'Open '` (trailing ws) pass the old in-memory check yet are excluded server-side -> silently dropped from queue aging for the ticket's whole open life
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=8

## Goal
The tickets `.or()` bound matches every stored status string that
`dqBuildAging_` would accept after `trim().toLowerCase()` — any case form or
surrounding whitespace — so no open ticket is dropped server-side.

## Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqTicketsReadOr_` only (~lines 85-110)
- Edit: `tests/jobs/queue-tickets-read.test.ts` | update the perf-2 assertion + cover the case-insensitive terms

## Context
- `src/features/cx-queue/lib/jobs.ts:85-110` | `dqTicketsReadOr_` — currently builds `status.in.("v","lower","UPPER")` + `created_at.gte`/`resolved_at.gte` terms
- `src/features/cx-queue/lib/index.ts:590-600` | `dqBuildAging_` — the consumer; compares `st.trim().toLowerCase()` against configured open statuses
- `tests/jobs/queue-tickets-read.test.ts:85-100` | existing perf-2 assertion recording the `.or` call (update it)
- `specs/perf-remediation/reports/qa-3.md` (qa-1 row) | reviewer's suggested fix

## Contract
- Replace the single `status.in.(...)` or-term with ONE `status.ilike."*<v>*"`
  or-term per configured (trimmed, non-empty, deduped) status `v`. Rationale
  (document in a comment): PostgREST `ilike` covers every case form, and the
  `*` wildcards preserve the old `st.trim()` coverage for padded values
  (`'Open '`); substring over-match is a safe superset — `dqBuildAging_` still
  applies its exact trim/lowercase filter in memory, so nothing extra is
  counted, only extra rows fetched.
- Sanitize `v` before embedding: strip `"`, `*`, `%` (pattern meta chars) and
  skip empty results; quote each term per PostgREST or-rules as the current
  code already does for `in.()`.
- Keep `created_at.gte.<bound>` and `resolved_at.gte.<bound>` terms and the
  empty-statuses guard (`no statuses -> no status terms`) unchanged.
- Update the docstring above `dqTicketsReadOr_` (lines 85-88) to describe the
  ilike approach.
- Update the test: assert the recorded `.or` arg contains `status.ilike.` and
  `*Open*`, `*Pending*`, `*Pending on CX*` terms and NO `status.in.` — it must
  fail on the pre-change query shape.
Out of scope: `dqBuildAging_`/index.ts, the date bound math, any other query,
config defaults.

## Actions
1. Rewrite the status part of `dqTicketsReadOr_` to per-status `ilike.*v*` or-terms (sanitized + quoted + deduped); update the docstring.
2. Update `tests/jobs/queue-tickets-read.test.ts` perf-2 assertion for the ilike shape (still asserts both gte terms).
3. Run the focused vitest file + `npx tsc --noEmit`.

## Done when
- The emitted or-string uses `status.ilike.*v*` per configured status; no `status.in` remains; both gte terms intact.
- The updated test fails on the pre-change code and passes now.
- `npx tsc --noEmit` clean; `npx vitest run tests/jobs/queue-tickets-read.test.ts tests/golden/queue-aggregates.test.ts` green.

## Verify
- Run: `npx vitest run tests/jobs/queue-tickets-read.test.ts tests/golden/queue-aggregates.test.ts` -> all pass; `npx tsc --noEmit` -> 0 errors.

## Handoff
None — self-contained helper; `buildQueueAggregates_` signature unchanged.
Write results/FIX-20.md (<=10 lines); TL alone updates TRACKER.md.
