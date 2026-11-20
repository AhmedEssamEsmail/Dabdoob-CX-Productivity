# debug report - qa-audit-footer-compact - 1

Verdict: ROOT_CAUSE_FOUND

Repro: `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` (new file) -> 5 failed, 1 passed:
- `expected 'Pass' to be 'Skip'` (queue-row toggle button)
- `expected 'Confirm pass' to be 'Confirm skip'` / `expected 'Passing…' to be 'Skipping…'` (PassForm sample branch)
- `props.rows` is `undefined` (#qa-comment textarea — no compact row count)
- `props.size` is `undefined` on both `.qa-form__foot` buttons (default `md`, no `cx-btn--sm`)
- guard passing: non-ticket row still renders `Remove`/`Removing…` (x branch correctly untouched)

Root cause: the "Pass" CTA vocabulary and full-size footer are verbatim-legacy carryovers, not logic bugs —
the row toggle button literal is `Pass` (audit-queue-page.tsx:485), the PassForm sample-branch labels are
`'Passing…'`/`'Confirm pass'` (audit-queue-detail.tsx:121), the `#qa-comment` `Textarea` has no `rows`
prop so `.cx-textarea` (cx-kit.css:275-298, `width:100%`, min-height) renders a full-height box
(qa-shared.tsx:1012-1017), and neither footer `Button` passes `size` so `Button` never adds `cx-btn--sm`
(qa-shared.tsx:1051-1076, Button.tsx:25).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| dbg-1 | HIGH | src/features/cx-quality/components/audit-queue-page.tsx:485 | Queue-row toggle renders `Pass`; test: `expected 'Pass' to be 'Skip'`. aria-expanded/onClick/passInvoker wiring correct — label only. | Change literal `Pass` -> `Skip` inside the `<Button>` at 477-486. Touch nothing else. | dev |
| dbg-2 | HIGH | src/features/cx-quality/components/audit-queue-detail.tsx:121 | Sample branch (`x` false) shows `Passing…`/`Confirm pass`; tests confirm both fail. `x` remove branch already `Remove`/`Removing…` (passing). | In the ternary `{u ? (x ? 'Removing…' : 'Passing…') : x ? 'Remove' : 'Confirm pass'}` change only the two non-x literals -> `'Skipping…'` / `'Confirm skip'`. Keep the `x` branches byte-identical. | dev |
| dbg-3 | MED | src/features/cx-quality/components/qa-shared.tsx:1012-1017 | `#qa-comment` Textarea has no `rows`; CSS `.cx-textarea` min-height makes it tall. Test: `props.rows` undefined. | Add `rows={3}` to the `Textarea` (keeps label, `onInput`, placeholder; `resize:vertical` retained via CSS). | dev |
| dbg-4 | MED | src/features/cx-quality/components/qa-shared.tsx:1052-1075 | Both `.qa-form__foot` Buttons lack `size`; Button.tsx:25 shows `cx-btn--sm` only when `size==='sm'`. Test: `size` undefined on both. | Add `size="sm"` to the submit Button (1052-1058) and the Cancel Button (1069-1075). Do not hand-roll classes. | dev |

Regression test: `tests/quality/qa-audit-footer-compact.test.tsx` — failing now for the right reasons (5 fail / 1 pass guard); all 6 should pass after the fix.

Siblings (same pattern, out of scope — do NOT change in this shard):
- `qa-forms-page.tsx:335-349` — `.qa-form__foot` with full-size Buttons on the form-editor page (other page).
- `qa-shared.tsx:627` `QA_ANSWER.pass = 'Pass'` — scoring answer vocabulary; PLAN keeps data/status wording.
- Toasts/history keep "passed" wording by design (`audit-queue-page.tsx:449,530`; `audit-queue-detail.tsx:77` `Passed #…` toast; status `passed` throughout `lib/server.ts`) — untouched per PLAN.
- `PassForm` component name stays (PLAN non-goal).

Fix risks: none structural — string/`rows`/`size` prop changes only; verify `npx tsc --noEmit`, `npx eslint .`, and the 375/1024px page-contract e2e per PLAN gates.
