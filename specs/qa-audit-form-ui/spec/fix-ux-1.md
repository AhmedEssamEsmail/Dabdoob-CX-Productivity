# Fix leaves for reports/ux-1.md

| Finding | Leaf | Owner |
|---|---|---|
| ux-1 (MED) `#qa-when` `inline-size:auto` is a no-op inside grid `.cx-field` | ux1-01 | dev |
| ux-2 (MED) answer/why selects collapse to 53px in `width:1%` cell | ux1-02 | dev |
| ux-4 (LOW) answer select lacks `aria-required` (why select has it) | ux1-03 | dev |

Deferred (LOW, out of PM scope this round): ux-3, ux-5, ux-6.

## ux1-01: Make `#qa-when` actually shrink inside its grid `.cx-field`
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: PLAN Expected #3 (`#qa-when` sizes to content)
Skills: none
Budget: files=1; actions=1; changed_lines=3; minutes=5

### Goal
`#qa-when` (datetime/date `Input` inside `.cx-field`, which is
`display:grid` per `cx-kit.css:253`) renders at content width instead of
stretching to the full panel/column width, at both 375px and 1024px.

### Files
- Edit: `src/app/styles/quality.css` | the `[data-app="quality"] #qa-when` rule only (~L10)

### Context
- `src/app/styles/quality.css:10` | current rule `{ inline-size:auto;max-inline-size:100% }` — a no-op: grid items default `justify-self:stretch`
- `src/app/cx-kit.css:253` | `:root .cx-field { display: grid; align-content: start; }`
- `src/features/cx-quality/components/qa-shared.tsx:819-833` | `#qa-when` Input inside `.cx-field`
- `reports/ux-1.md` ux-1 | reviewer fix: add `justify-self:start` (or `inline-size:fit-content`)

### Contract
Only the `#qa-when` rule changes; keep `max-inline-size:100%` as the
mobile guard. No markup changes, no other rules touched.
Out of scope: every other rule in quality.css; qa-shared.tsx; cx-kit.css.

### Actions
1. Add `justify-self:start` to the existing
   `[data-app="quality"] #qa-when` rule (keeps `inline-size:auto` +
   `max-inline-size:100%`; `fit-content` is an acceptable alternative per
   the reviewer, pick one).

### Done when
- The `#qa-when` rule declares `justify-self:start` (or `inline-size:fit-content`)
- `git diff src/app/styles/quality.css` shows only that rule changed
- `npx vitest run tests/quality` shows no NEW failure vs baseline
  (`qe-fd-cache.test.ts` failure is pre-existing)

### Verify
- Run: `grep -n "qa-when" src/app/styles/quality.css` -> rule contains `justify-self:start` or `fit-content`

### Handoff
None — visual verification is the ux reviewer's re-check.
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-02: Give answer/why `.cx-select`s an intrinsic inline size
Kind: mini
ID: ux1-02
Parent: fix-ux-1
Owner: dev
Depends: ux1-01 (same file — serial writer)
Criteria: PLAN Expected #2 (answer/why controls usable dropdowns)
Skills: none
Budget: files=1; actions=1; changed_lines=3; minutes=5

### Goal
Answer and "why it failed" `<select>`s inside `.qa-form .qa-q` rows stop
collapsing to ~53px (`.cx-select{width:100%}` inside the `width:1%` table
cell) and render at a readable intrinsic width at 375px and 1024px;
"Fail"/"Process" option text no longer clips.

### Files
- Edit: `src/app/styles/quality.css` | add ONE rule next to the `.qa-form .cx-table` cell-sizing rules (~L23-25)

### Context
- `src/app/styles/quality.css:25` | `.qa-form .cx-table :is(th,td):nth-child(n+2) { width:1% }` shrinks the answer cell
- `src/app/cx-kit.css:276-291` | `.cx-select` base rule sets `width:100%`
- `src/features/cx-quality/components/qa-shared.tsx:925-963` | answer + why selects live in that `td.num` cell
- `reports/ux-1.md` ux-2 | reviewer fix: `.qa-form .qa-q .cx-select { inline-size:auto; min-inline-size:6.5rem }`

### Contract
Add one new rule; do not alter the `width:1%` cell rule or `.cx-select`
base styles. Table keeps reflowing; `TableScroll` already covers any
375px overflow.
Out of scope: qa-shared.tsx markup, empty-option labels (ux-6 deferred),
`.qa-score` media rule (ux-3 deferred), every other rule.

### Actions
1. Insert `[data-app="quality"] .qa-form .qa-q .cx-select { inline-size:auto;min-inline-size:6.5rem }`
   adjacent to the `.qa-form .cx-table` sizing rules (minified one-line
   style per file conventions).

### Done when
- The new `.qa-form .qa-q .cx-select` rule exists with
  `inline-size:auto` and `min-inline-size:6.5rem`
- `git diff src/app/styles/quality.css` shows only the added rule
- `npx vitest run tests/quality` shows no NEW failure vs baseline
  (`qe-fd-cache.test.ts` failure is pre-existing)

### Verify
- Run: `grep -n "qa-q .cx-select" src/app/styles/quality.css` -> one rule with `min-inline-size:6.5rem`

### Handoff
None — visual verification is the ux reviewer's re-check.
Write results/ux1-02.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-03: Add `aria-required` to the answer Select for parity
Kind: mini
ID: ux1-03
Parent: fix-ux-1
Owner: dev
Depends: none (disjoint file from ux1-01/ux1-02)
Criteria: PLAN gates (a11y parity; submit gating unchanged)
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
The per-question answer `Select` in `AuditForm` carries
`aria-required="true"` exactly like the sibling "why it failed" select,
since both gate submit. No behaviour change.

### Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | answer `Select` props only (~L926-939)

### Context
- `src/features/cx-quality/components/qa-shared.tsx:926-939` | answer `Select` (has `aria-label={F.text}`, no `aria-required`)
- `src/features/cx-quality/components/qa-shared.tsx:945-962` | why `Select` already uses `{...{ 'aria-required': 'true' }}` spread — mirror that exact pattern
- `reports/ux-1.md` ux-4 | the finding
- `tests/quality/audit-form-controls.test.tsx:143-152` | existing assertions key on `aria-label`; keep it intact

### Contract
Add the attribute only — do not touch handlers, options, `aria-label`,
or any other element/prop. Attribute value is the string `'true'`.
Out of scope: the why select, the empty `<option>` label, all other
files.

### Actions
1. Add `{...{ 'aria-required': 'true' }}` to the answer `Select` (same
   spread idiom as the why select at L954).

### Done when
- Answer `Select` props include `aria-required='true'`
- `npx eslint src/features/cx-quality/components/qa-shared.tsx` exits 0, 0 warnings
- `npx vitest run tests/quality/audit-form-controls.test.tsx` passes 2/2

### Verify
- Run: `npx eslint src/features/cx-quality/components/qa-shared.tsx && npx vitest run tests/quality/audit-form-controls.test.tsx` -> exit 0; 2/2 pass

### Handoff
None.
Write results/ux1-03.md (<=10 lines); TL alone updates TRACKER.md.
