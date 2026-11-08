# S03-05a: qaRowBy_ helper + qa_audits/qa_queue single-row lookups filtered
Kind: mini
ID: S03-05a
Parent: S03
Owner: dev
Depends: none
Criteria: PLAN #3 (qa_audits whole-table reads — 241 calls/41s baseline)
Skills: none
Budget: files=1; actions=10; changed_lines=60; minutes=8

## Goal
`src/features/cx-quality/lib/server.ts` gains `qaRowBy_(name, col, value)` —
a `db()` `.eq(col, value).limit(1)` lookup returning one row or null — and
the `qa_audits`-by-`audit_id` plus `qa_queue`-by-`queue_id` single-row
`.filter(...)[0]` sites use it instead of pulling the whole table.

## Files
- Edit: `src/features/cx-quality/lib/server.ts` | add `qaRowBy_` beside `qaRows_` (:83-90) and rewire the listed sites

## Context
- `src/features/cx-quality/lib/server.ts:83-90` | `qaRows_` — missingOk [] convention the helper mirrors (null on error, not throw)
- qa_audits `audit_id` single-row sites (this leaf, FIVE only): ~L791, L1042, L1054, L1331, L1592 — the ~L1537 'other'-audit lookup belongs to S03-05b
- qa_queue `queue_id` single-row sites: ~L681, L711, L815, L937
- LINE NUMBERS DRIFT — locate each with grep `(qaRows_\('qa_audits'\)|qaRows_\('qa_queue'\)).*filter` before editing; do not touch multi-row filters or upsert paths

## Contract
- `qaRowBy_(name, col, value): Promise<Row | null>` — `.select('*').eq(col, value).limit(1)`; error -> null (missingOk, same spirit as qaRows_).
- Each replaced site keeps EXACTLY its current downstream semantics: found row used the same way; "no row" behaves as today (`[0]` -> undefined -> same guards fire).
- Do not convert multi-row filters (e.g. audits-for-range, ctls-for-agent) — those are S03-05b / future scope.
- qaRows_ stays exported for the remaining consumers.
Out of scope: every other file; qa_ctls/qa_disputes/qa_calibrations/qa_kb_gaps lookups (S03-05b); write paths.

## Actions
1. Add `qaRowBy_` under `qaRows_`.
2. Replace the qa_queue `queue_id` lookup ~L681.
3. Replace the qa_queue `queue_id` lookup ~L711.
4. Replace the qa_queue `queue_id` lookup ~L815.
5. Replace the qa_queue `queue_id` lookup ~L937.
6. Replace the qa_audits `audit_id` lookup ~L791.
7. Replace the qa_audits `audit_id` lookup ~L1042.
8. Replace the qa_audits `audit_id` lookup ~L1054.
9. Replace the qa_audits `audit_id` lookup ~L1331.
10. Replace the qa_audits `audit_id` lookup ~L1592 (~L1537 stays for S03-05b).

## Done when
- The listed single-row lookups call `qaRowBy_`; no behavior change in their callers.
- `npx vitest run tests/golden/quality.test.ts` green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/golden/quality.test.ts` -> all pass.

## Handoff
S03-05b rewires the remaining single-row tables in this same file (serial).
Write results/S03-05a.md (<=10 lines); TL alone updates TRACKER.md.
