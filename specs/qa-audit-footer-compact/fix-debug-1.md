# fix-debug-1: qa-audit-footer-compact blocking findings

Source: `reports/debug-1.md`. One independent root-cause fix per leaf.
Regression test (already written, failing for the right reasons):
`tests/quality/qa-audit-footer-compact.test.tsx` — 5 fail / 1 pass now; all 6 must pass after all leaves.

## dbg1-01: Rename queue-row toggle label "Pass" -> "Skip"
Kind: mini
ID: dbg1-01
Parent: debug-1
Owner: dev
Depends: none
Criteria: PLAN #1 (row action reads "Skip", wiring unchanged)
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
The second action button in each random-sample queue row reads `Skip` instead of `Pass`; aria-expanded/onClick/passInvoker wiring is byte-identical.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | label literal inside the `<Button>` at lines 477-486 only

### Context
- `reports/debug-1.md` | row dbg-1: label-only fix, wiring confirmed correct
- `tests/quality/qa-audit-footer-compact.test.tsx` | failing assertion `expected 'Pass' to be 'Skip'`

### Contract
Only the rendered text `Pass` (line 485) becomes `Skip`. No prop, handler, aria attribute, or structural change.
Out of scope: every other button/label on the page; toasts and "passed" history wording stay per PLAN; `PassForm` component name stays.

### Actions
1. Change the literal `Pass` to `Skip` inside the `<Button>` at audit-queue-page.tsx:477-486; run the targeted test.

### Done when
- The queue-row toggle renders `Skip`.
- `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` shows the row-label assertion passing (other leaves' assertions may still fail).

### Verify
- Run: `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` -> row toggle label assertion passes; no new failures.

### Handoff
none
Write results/dbg1-01.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-02: PassForm sample-branch labels -> "Skipping…" / "Confirm skip"
Kind: mini
ID: dbg1-02
Parent: debug-1
Owner: dev
Depends: none
Criteria: PLAN #2 (submit reads "Confirm skip", busy "Skipping…"; x remove branch unchanged)
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
In `PassForm`, the non-`x` (sample-pass) branch of the submit button label reads `Skipping…` when busy and `Confirm skip` when idle; the `x` remove branch stays `Removing…` / `Remove` byte-identical.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | ternary inside submit `<Button>` at line 121 only

### Context
- `reports/debug-1.md` | row dbg-2: two literals only; `x` branches already correct
- `tests/quality/qa-audit-footer-compact.test.tsx` | failing assertions `expected 'Confirm pass' to be 'Confirm skip'` and `'Passing…'` -> `'Skipping…'`

### Contract
In `{u ? (x ? 'Removing…' : 'Passing…') : x ? 'Remove' : 'Confirm pass'}` change only `'Passing…'` -> `'Skipping…'` and `'Confirm pass'` -> `'Confirm skip'`. Keep `'Removing…'`/`'Remove'` and all surrounding code byte-identical.
Out of scope: hint text, aria attributes, `PassForm` name, toasts, `QA_ANSWER.pass` scoring vocabulary.

### Actions
1. Edit the two non-`x` literals in the line-121 ternary; run the targeted test.

### Done when
- Sample rows show `Confirm skip` / `Skipping…`; non-ticket rows still show `Remove` / `Removing…`.
- The targeted test's PassForm label assertions pass (other leaves' assertions may still fail).

### Verify
- Run: `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` -> PassForm label assertions pass; guard (x-branch) assertion still passes.

### Handoff
none
Write results/dbg1-02.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-03: Compact comment textarea via rows prop
Kind: mini
ID: dbg1-03
Parent: debug-1
Owner: dev
Depends: none
Criteria: PLAN #3 (`#qa-comment` visibly smaller, labelled, editable, resize kept)
Skills: none
Budget: files=1; actions=1; changed_lines=1; minutes=5

### Goal
The `#qa-comment` `Textarea` in `AuditForm` renders ~3 lines tall instead of the `.cx-textarea` default min-height.

### Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | `<Textarea id="qa-comment">` props at lines 1012-1017 only

### Context
- `reports/debug-1.md` | row dbg-3: `props.rows` undefined; CSS `resize:vertical` retained via `cx-kit.css:275-298`
- `tests/quality/qa-audit-footer-compact.test.tsx` | failing assertion `props.rows` is undefined

### Contract
Add `rows={3}` to the existing `Textarea`. Keep `id`, `value`, `onInput`, `placeholder`, and the wrapping `.cx-field`/label unchanged.
Out of scope: `.qa-form__foot` buttons (dbg1-04), CSS edits, any other Textarea.

### Actions
1. Add `rows={3}` to the `Textarea` at qa-shared.tsx:1012-1017; run the targeted test.

### Done when
- `Textarea` receives `rows={3}`.
- The targeted test's `props.rows` assertion passes (dbg1-04 assertions may still fail).

### Verify
- Run: `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` -> rows assertion passes; no new failures.

### Handoff
none
Write results/dbg1-03.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-04: size="sm" on audit-form footer buttons
Kind: mini
ID: dbg1-04
Parent: debug-1
Owner: dev
Depends: dbg1-03 (same file; serial)
Criteria: PLAN #4 (submit + Cancel render `cx-btn--sm`)
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
Both `Button`s inside `.qa-form__foot` in `AuditForm` pass `size="sm"` so `Button` adds `cx-btn--sm`.

### Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | submit `Button` (lines 1052-1058) and Cancel `Button` (lines 1069-1075) props only

### Context
- `reports/debug-1.md` | row dbg-4: `Button.tsx:25` adds `cx-btn--sm` only for `size==='sm'`; do not hand-roll classes
- `tests/quality/qa-audit-footer-compact.test.tsx` | failing assertions `props.size` undefined on both `.qa-form__foot` buttons

### Contract
Add `size="sm"` to the submit `Button` (1052-1058) and the Cancel `Button` (1069-1075). No label, handler, disabled-logic, or className changes.
Out of scope: `#qa-comment` Textarea (dbg1-03); `.qa-form__foot` in `qa-forms-page.tsx` (explicit sibling non-goal); CSS edits.

### Actions
1. Add `size="sm"` to both `.qa-form__foot` Buttons; run the targeted test.

### Done when
- Both footer Buttons render `cx-btn--sm` on one row.
- `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` fully green (6/6) combined with the other leaves.

### Verify
- Run: `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` -> all 6 assertions pass once sibling leaves are in.

### Handoff
none
Write results/dbg1-04.md (<=10 lines); TL alone updates TRACKER.md.
