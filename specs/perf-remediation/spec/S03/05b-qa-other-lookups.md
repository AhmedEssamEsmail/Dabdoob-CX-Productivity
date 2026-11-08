# S03-05b: Remaining qa_* single-row lookups via qaRowBy_
Kind: mini
ID: S03-05b
Parent: S03
Owner: dev
Depends: S03-05a
Criteria: PLAN #3 (same hot file — serial, keeps S03-05a under the action cap)
Skills: none
Budget: files=1; actions=9; changed_lines=60; minutes=9

## Goal
Finish the single-row lookup conversion in `cx-quality/lib/server.ts`: the
`qa_ctls`, `qa_disputes`, `qa_calibrations`, `qa_kb_gaps` and remaining
`qa_queue`/`qa_audits` one-row `.filter(...)[0]` sites go through
`qaRowBy_` (added by S03-05a).

## Files
- Edit: `src/features/cx-quality/lib/server.ts` | only the listed lookup sites (serial after S03-05a)

## Context
- `src/features/cx-quality/lib/server.ts` | `qaRowBy_` from S03-05a
- Single-row sites (grep `qaRows_\('qa_(ctls|disputes|calibrations|kb_gaps|queue|audits)'\)` + `filter` + `[0]`): approx — qa_ctls by ctl_id ~L1022 and by audit_id where used as a single lookup; qa_disputes dispute_id ~L1326; qa_calibrations calibration_id ~L1517; qa_kb_gaps gap_id ~L1625; qa_ctls open-ctl-for-audit ~L1354; any audit_id/queue_id single-row site S03-05a left
- ONE ROW ONLY: sites like :1095,:1149,:1417,:1670,:1722,:2175 iterate/filter many rows — do NOT touch them
- LINE NUMBERS DRIFT — locate via grep before editing

## Contract
- Same rules as S03-05a: one row via `.eq().limit(1)`; identical no-row semantics; error -> null.
- If a site filters on TWO columns (e.g. audit_id + kind), extend `qaRowBy_` to accept extra `.eq` pairs (single small signature — no query-string filters) OR keep a local filtered read; pick one and keep it consistent.
- Anything ambiguous (filter condition not expressible as eq) is left as-is and listed in results.
Out of scope: multi-row filters, write/upsert paths, other files.

## Actions
1. Convert the qa_ctls `ctl_id` single-row lookup (~L1022).
2. Convert the qa_ctls open-ctl-for-audit lookup (~L1354).
3. Convert the qa_disputes `dispute_id` lookup (~L1326).
4. Convert the qa_calibrations `calibration_id` lookup (~L1517).
5. Convert the qa_kb_gaps `gap_id` lookup (~L1625).
6. Convert any single-row qa_ctls-by-audit_id lookup the grep finds.
7. Convert the qa_audits 'other'-audit `audit_id` lookup (~L1537).
8. Convert any remaining single-row audit_id/queue_id site S03-05a left.
9. Record every skipped site + reason in results.

## Done when
- No `qaRows_(...)` whole-table read remains solely to pick one row by id in this file (skipped ones recorded).
- `npx vitest run tests/golden/quality.test.ts` green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/golden/quality.test.ts` -> all pass.

## Handoff
None. Write results/S03-05b.md (<=10 lines) with converted/skipped counts;
TL alone updates TRACKER.md.
