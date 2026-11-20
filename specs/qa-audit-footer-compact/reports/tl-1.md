# tl-1: qa-audit-footer-compact FIX (reports/debug-1.md)

All 4 blocking findings fixed via leaves in `fix-debug-1.md` (preflight: 4/4 PASS, all `Kind: mini`).

## Changed files (scoped diff: reports/fix-debug-1-diff.log — 5 ins / 2 del)
- `src/features/cx-quality/components/audit-queue-page.tsx` — row toggle `Pass` -> `Skip` (dbg1-01)
- `src/features/cx-quality/components/audit-queue-detail.tsx` — `'Passing…'`/`'Confirm pass'` -> `'Skipping…'`/`'Confirm skip'`; `x` branch untouched (dbg1-02)
- `src/features/cx-quality/components/qa-shared.tsx` — `#qa-comment` `rows={3}` (dbg1-03); both `.qa-form__foot` Buttons `size="sm"` (dbg1-04)

## Leaves
| Leaf | Status | Evidence |
|---|---|---|
| dbg1-01 | done | results/dbg1-01.md |
| dbg1-02 | done | results/dbg1-02.md |
| dbg1-03 | done | results/dbg1-03.md |
| dbg1-04 | done | results/dbg1-04.md (serial after dbg1-03, same file) |

## Integration gates
- Targeted regression `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx`: **6/6 PASS**
- `npx tsc --noEmit`: PASS (clean, empty log)
- `npx eslint` on the 3 touched files: PASS exit 0
- `npx vitest run` (full): 1524/1526. Two failures are **pre-existing and unrelated** to this diff:
  - `tests/freeze/sheets-freeze-scan.test.ts` — repo-scan of `scripts/ops/qa-*.ts` (committed code, untouched)
  - `tests/css/table-center-align.test.ts` — `.qa-whylist li` expects `justify-content:center`; baseline dirty edit to `src/app/styles/quality.css` (present before this FIX run, belongs to another change) flipped it to `flex-start`. Not reverted per rules.
- `npx playwright test e2e/page-contract.spec.ts`: 350/410 pass; 60 failures are environmental —
  `e2e login failed` (seed/dev-server) and 500-resource errors across ~30 unrelated routes.
  `/audit-queue` passes contract on chromium/firefox/webkit/tablet; its single mobile fail is the
  login-infra error, not a contract violation. Not attributable to the 5-line diff; flagging for PM.

## Reviewer DELTA scope
Changed files: the 3 components above only. Regression spec: `tests/quality/qa-audit-footer-compact.test.tsx` (debugger-written, now green).

## Notes
- No reviewer/architect/debugger shards spawned (PM runs gates); none requested.
- Sibling non-goals respected: `qa-forms-page.tsx` footer, `QA_ANSWER.pass`, toasts/`passed` wording, `PassForm` name — all untouched.
