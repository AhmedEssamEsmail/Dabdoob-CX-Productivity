# fix-debug-1 — qa-audit-form-ui FIX leaves

Source findings: `../reports/debug-1.md` (dbg-1..dbg-3, all blocking) +
PLAN.md symptom 4 (`.qa-score` oversized box, blocking).
One leaf per independent root cause. All four leaves write
`src/app/styles/quality.css` -> they MUST run serially in Depends order
(dbg1-01 -> dbg1-02 -> dbg1-03 -> dbg1-04); never two at once.
Conventions (PLAN.md): verbatim legacy port style, minified local names +
`/* legacy symbol */` comment headers; `--cx-*` tokens, no px literals;
controls from `@/features/shared/components/ui`; CSS under
`[data-app="quality"]` in `src/app/styles/quality.css`.
Shared-file writer rule: same-file writers ALWAYS serial.

## dbg1-01: AuditForm answer + why controls: Seg -> Select
Kind: mini
ID: dbg1-01
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN Expected #2
Skills: none
Budget: files=2; actions=4; changed_lines=80; minutes=10

### Goal
In `AuditForm`'s question row, the answer control and the conditional
"why it failed" control render as `<Select>` dropdowns (not `Seg` radios),
so the squeezed `width:1%` cell no longer stacks options as plain text.
Behaviour (missing/why gating, fatal Pass/Fail-only, payloads) unchanged.

### Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | answer + why `Seg` blocks L925-956 only
- Edit: `src/app/styles/quality.css` | dead `.cx-seg` fail-tint rule L30 only — restyle for `.cx-select` (e.g. `.qa-q[data-answer=fail] .cx-select` border/text tint) or drop; keep scoped to `.qa-q`

### Context
- `specs/qa-audit-form-ui/reports/debug-1.md` row dbg-2 | exact fix recipe
- `src/features/shared/components/ui/Select.tsx` | thin `<select>`
  wrapper; standard props incl. `aria-label`, `aria-labelledby`,
  `onChange` (event -> `e.currentTarget.value`), `<option>` children
- `src/features/cx-quality/components/qa-shared.tsx:886-891` | `da`
  options array (fatal -> `['pass','fail']`, else + `'na'`)
- `src/features/cx-quality/components/qa-shared.tsx:899,944-945` | state
  keys: answer `u[F.id]` via `O(F.id, v)`; why `f[F.id]` via
  `g(ha => ({...ha,[F.id]:v}))`
- `tests/quality/audit-form-controls.test.tsx` | regression test (already
  failing for the right reason); READ it, do NOT edit it

### Contract
- Answer `Select`: `value={Je ?? ''}`,
  `onChange={e => O(F.id, e.currentTarget.value)}`, `aria-label={F.text}`;
  children: empty `<option value="">` first, then
  `da.map(le => <option value={le}>{QA_ANSWER[le]}</option>)`.
- Why `Select` (inside existing `.qa-q__why` div, same `Je === 'fail'`
  gating): `value={f[F.id] ?? ''}`,
  `onChange={e => g(ha => ({...ha,[F.id]:e.currentTarget.value}))}`,
  `aria-labelledby={\`qa-why-${F.id}\`}`, keep `aria-required`;
  children: empty `<option value="">` then QA_WHY options
  (`le.v`/`le.label`).
- Empty option = unanswered (`''` falsy) — `missing`/`A` gating,
  submit disabled math and `Z` payload MUST be untouched.
- quality.css:24 (`width:1%` cells) may stay or narrow to
  `:nth-child(2)` — your call, say which in results.
- Out of scope: every other `Seg` usage (BasisSeg L1340, CTL pickers,
  tabs); scoring/missing/payload code; the test file; any other file.

### Actions
1. Replace the answer `Seg` (L926-935) with a `Select` per Contract;
   ensure `Select` is imported (same ui barrel as `Seg`).
2. Replace the why `Seg` (L941-953) with a `Select` per Contract.
3. Restyle or drop the now-dead `.cx-seg` fail-tint rule at
   quality.css:30, scoped to `.qa-q`.
4. Run the Verify command; iterate until green.

### Done when
- `npx vitest run tests/quality/audit-form-controls.test.tsx` exits 0.
- No `Seg` rendered for audit answers/why controls; both are `<select>`
  with an accessible name and an empty first option.
- `npx tsc --noEmit` clean; `npx eslint` clean (0 warnings) on
  qa-shared.tsx.
- Fatal questions offer Pass/Fail only (no N/A option).

### Verify
- Run: `npx vitest run tests/quality/audit-form-controls.test.tsx` -> exit 0
- Run: `npx tsc --noEmit` -> exit 0

### Handoff
`.qa-q[data-answer=fail]` select tint (or removal) is final at
quality.css:30; later leaves may append/edit elsewhere in quality.css.
Write results/dbg1-01.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-02: `.qa-request` flex -> uniform grid
Kind: mini
ID: dbg1-02
Parent: fix-debug-1
Owner: dev
Depends: dbg1-01
Criteria: PLAN Expected #1
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=5

### Goal
`.qa-request` (NonTicketForm + RequestForm) lays out in a uniform
auto-fit grid: equal field sizing, wide `__why` fields span full row,
submit button natural width. CSS-only; no markup changes.

### Files
- Edit: `src/app/styles/quality.css` | `.qa-request` rules L181-184 only

### Context
- `specs/qa-audit-form-ui/reports/debug-1.md` row dbg-1 | exact fix recipe
- `src/app/styles/quality.css:85-88` | `.qa-grid` pattern to mirror
- `src/features/cx-quality/components/audit-queue-detail.tsx:548-637` |
  NonTicketForm field order/classes (read region only)
- `src/features/cx-quality/components/audit-queue-detail.tsx:161-259` |
  RequestForm (read region only)

### Contract
- `.qa-request` becomes
  `display:grid;gap:var(--cx-space-3);grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));align-items:end`
  (keep `margin-block-end`).
- `.qa-request>*{min-inline-size:0}`; controls inside
  `:is(input:not([type=checkbox]):not([type=radio]),select,textarea)` get
  `box-sizing:border-box;min-inline-size:0;max-inline-size:100%`.
- `.qa-request .qa-request__why, .qa-request .cx-error{grid-column:1/-1}`;
  `.qa-request .qa-actions{justify-self:start}`.
- Replace the L182-184 flex children rules; keep selectors scoped under
  `[data-app="quality"] .qa-request`.
- Out of scope: any markup/tsx edits; any other selector block.

### Actions
1. Rewrite the `.qa-request` block (L181-184) per Contract.
2. Run the Verify commands.

### Done when
- No `.qa-request` rule uses `flex:1 1 10rem` / `flex:3 1 16rem`.
- `__why` fields and `.cx-error` span the full grid row; `.qa-actions`
  button keeps natural width.
- `npx vitest run tests/quality` still green; eslint clean on the file.

### Verify
- Run: `npx vitest run tests/quality` -> exit 0

### Handoff
`.qa-request` grid is final; later leaves append elsewhere in
quality.css. Write results/dbg1-02.md (<=10 lines); TL alone updates
TRACKER.md.

## dbg1-03: `#qa-when` shrink-to-fit
Kind: mini
ID: dbg1-03
Parent: fix-debug-1
Owner: dev
Depends: dbg1-02
Criteria: PLAN Expected #3
Skills: none
Budget: files=1; actions=1; changed_lines=3; minutes=5

### Goal
The `#qa-when` datetime input sizes to its content instead of filling
the full `.qa-form` panel width. CSS-only.

### Files
- Edit: `src/app/styles/quality.css` | add ONE `#qa-when` rule near the `.qa-form` block (after L9); no other lines touched

### Context
- `specs/qa-audit-form-ui/reports/debug-1.md` row dbg-3 | exact fix recipe
- `src/features/cx-quality/components/qa-shared.tsx:825-832` | the
  `Input id="qa-when"` (already labelled + required — untouched)
- `src/app/cx-kit.css:281` | `.cx-input{width:100%}` being overridden

### Contract
- Add `[data-app="quality"] #qa-when{inline-size:auto;max-inline-size:100%}`.
- Out of scope: tsx edits, other selectors, cx-kit.css.

### Actions
1. Add the rule; run Verify.

### Done when
- Rule present under `[data-app="quality"]`; input no longer inherits
  full-width sizing.
- `npx vitest run tests/quality` still green; eslint clean on the file.

### Verify
- Run: `npx vitest run tests/quality` -> exit 0

### Handoff
None beyond the new rule. Write results/dbg1-03.md (<=10 lines); TL
alone updates TRACKER.md.

## dbg1-04: `.qa-score` compact summary
Kind: mini
ID: dbg1-04
Parent: fix-debug-1
Owner: dev
Depends: dbg1-03
Criteria: PLAN Expected #4
Skills: none
Budget: files=1; actions=2; changed_lines=8; minutes=5

### Goal
The `.qa-score` footer block ("0% — N of M answered") reads as a compact
summary instead of a hero number: smaller `__num`, tighter padding,
aligned with the footer button row. CSS-only.

### Files
- Edit: `src/app/styles/quality.css` | `.qa-score` / `.qa-score__num` / `.qa-score__sub` rules L16-18 only

### Context
- `specs/qa-audit-form-ui/PLAN.md` Expected #4 + Repro hints (`.qa-score`
  = sticky score summary in all audit forms)
- `src/features/cx-quality/components/qa-shared.tsx` | search
  `qa-score` for markup (`.qa-score`, `.qa-score__num`, `.qa-score__sub`)
- `src/app/styles/quality.css:11` | `.qa-form__foot` footer flex row the
  box should sit inline with

### Contract
- `.qa-score__num` drops `--cx-text-2xl` -> `--cx-text-lg` (or smaller).
- `.qa-score` padding shrinks (e.g. `var(--cx-space-1)
  var(--cx-space-3)`); keep `--st-*` fallbacks, border, radius tokens.
- Sticky `position`/`inset-block-start` may stay or go — pick the
  cleanest; note choice in results.
- Out of scope: markup/tsx, other selectors, token changes.

### Actions
1. Restyle the three `.qa-score*` rules per Contract.
2. Run Verify.

### Done when
- `.qa-score__num` no longer uses `--cx-text-2xl`; padding reduced.
- Box renders inline/aligned with footer actions (no panel-scale block).
- `npx vitest run tests/quality` still green; eslint clean on the file.

### Verify
- Run: `npx vitest run tests/quality` -> exit 0

### Handoff
Final leaf; `.qa-score*` rules settled. Write results/dbg1-04.md (<=10
lines); TL alone updates TRACKER.md.
