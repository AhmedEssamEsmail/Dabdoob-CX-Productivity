# tl-3 — FIX round 3 (reports/qa-2.md)

Input: reports/qa-2.md (verdict FAIL, open 0/0/1/1).

## Routed
- qa-3 (MED): `.sch-table` thead th padding regression -> leaf `spec/fix-qa-2.md#qa2-01`, owner dev. FIXED.
- qa-2 (LOW): missing `scope="col"` x3 -> remains `deferred` per FIX LOW policy.

## Changed files (DELTA scope for re-review)
- `src/app/styles/queue.css` (+1 rule at :163: `.sch-table thead th { padding: var(--cx-space-2) var(--cx-space-3) }`; specificity 0,2,2 > :161's 0,2,1)
- `tests/css/table-center-align.test.ts` (+1 regex guard)
- `specs/table-center-align/spec/fix-qa-2.md`, `TRACKER.md`, `results/qa2-01.md`, this report, `logs/fix-qa2-*.log`

## Gates (round 3)
- `npx tsc --noEmit` -> exit 0 (logs/fix-qa2-tsc.log)
- `npx vitest run tests/css/table-center-align.test.ts` -> 14/14 pass (worker)
- `npx eslint src/app/styles/queue.css tests/css/table-center-align.test.ts` -> 0 errors (css-ignored warning only)

## Status
All blocking findings closed; qa-2 LOW deferred. Tracker updated. Ready for PM re-review. Full repo gates/e2e = PM scope.
