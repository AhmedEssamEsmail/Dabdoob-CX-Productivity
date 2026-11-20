# fix-qa-1: qa-audit-footer-compact QA round-1 findings

Source: `reports/qa-1.md`. One independent root-cause fix per leaf.
- qa-1 (HIGH) -> leaf qa1-01 below.
- qa-2 (MED): baseline dirty edit `.qa-whylist li` belongs to a sibling spec; NOT assigned — blocked/needs-user (see TRACKER).
- qa-3 (LOW): deferred.

## qa1-01: Make #qa-comment visibly smaller — rows=2 + scoped width cap
Kind: mini
ID: qa1-01
Parent: qa-1
Owner: dev
Depends: none
Criteria: PLAN #3 (`#qa-comment` visibly smaller, labelled, editable, resize kept)
Skills: none
Budget: files=3; actions=3; changed_lines=12; minutes=10

### Goal
The `#qa-comment` Textarea is visibly smaller than the old default: `rows={2}` (was absent = HTML default 2 but with `.cx-textarea` min-height; `rows={3}` made it TALLER) and no longer stretches full-width — a scoped `max-inline-size:60ch` cap applies only inside `.qa-form` in the quality app.

### Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | `<Textarea id="qa-comment" rows={3}` at ~line 1014 — change `rows={3}` to `rows={2}` only
- Edit: `src/app/styles/quality.css` | add ONE rule near `.qa-form` rules (lines 9-26): `[data-app="quality"] .qa-form #qa-comment { max-inline-size:60ch }`; do NOT touch the dirty `.qa-whylist li` line ~208 (sibling spec baseline)
- Edit: `tests/quality/qa-audit-footer-compact.test.tsx` | the `props.rows` assertion (~line 297-304): tighten `toBeLessThanOrEqual(3)` to `toBe(2)` and update its comment/message to rows===2 so the regression is locked

### Context
- `reports/qa-1.md` | row qa-1: exact fix sanctioned there (rows={2} + scoped width cap + spec update)
- `src/app/styles/quality.css:9-26` | existing `[data-app="quality"] .qa-form ...` scoped rules to match style
- `src/app/cx-kit.css` | `.cx-textarea` keeps `resize:vertical` and `width:100%`; the cap must live in quality.css, not cx-kit
- `TRACKER.md` | baseline dirty tree — `.qa-whylist li` diff is pre-existing, out of scope

### Contract
Only: `rows={3}`->`rows={2}`; the single new scoped CSS rule; the tightened test assertion. `id`, `value`, `onInput`, `placeholder`, wrapping `.cx-field`/label, `resize:vertical`, `.qa-form__foot` buttons — all byte-identical.
Out of scope: `.qa-whylist li` (qa-2), stray log files (qa-3), any other Textarea or `.qa-form__foot` in `qa-forms-page.tsx`.

### Actions
1. In `qa-shared.tsx` change `rows={3}` to `rows={2}` on `#qa-comment`.
2. In `quality.css` add `[data-app="quality"] .qa-form #qa-comment { max-inline-size:60ch }` adjacent to the `.qa-form` rules.
3. In the test file change the rows assertion to `toBe(2)` (+ comment wording); run the targeted test.

### Done when
- `#qa-comment` renders `rows={2}` and is width-capped at 60ch inside `.qa-form` only.
- `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` is 6/6 green.
- `.qa-whylist li` line in quality.css is untouched.

### Verify
- Run: `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` -> 6/6 pass.
- Run: `npx eslint src/features/cx-quality/components/qa-shared.tsx tests/quality/qa-audit-footer-compact.test.tsx` -> exit 0.
- Grep: `qa-comment` in `src/app/styles/quality.css` shows the new scoped `max-inline-size:60ch` rule.

### Handoff
none
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
