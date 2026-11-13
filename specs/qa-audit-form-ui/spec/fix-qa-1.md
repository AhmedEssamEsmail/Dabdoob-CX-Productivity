# Fix leaves for reports/qa-1.md

| Finding | Leaf | Owner |
|---|---|---|
| qa-1 (MED) `no-explicit-any` at tests/quality/audit-form-controls.test.tsx:82 | qa1-01 | test-engineer |

## qa1-01: Type `El.props` without `any` so the eslint gate passes
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: test-engineer
Depends: none
Criteria: PLAN gates (`npx eslint` clean on changed files)
Skills: none
Budget: files=1; actions=1; changed_lines=6; minutes=5

### Goal
Remove the `@typescript-eslint/no-explicit-any` error at
`tests/quality/audit-form-controls.test.tsx:82` by typing `El.props`
without `any`, keeping all existing assertions compiling and passing.

### Files
- Edit: `tests/quality/audit-form-controls.test.tsx` | `type El` declaration only (~L80-83)

### Context
- `tests/quality/audit-form-controls.test.tsx:80-95` | `El` type + `walk()`; index access on props (`e.props['aria-label']`, `e.props.value`) must still work
- `tests/quality/audit-form-controls.test.tsx:163-171` | `first.props.onChange(...)` is invoked twice — `onChange` must stay callable (non-optional or asserted)
- `reports/qa-1.md` finding qa-1 | suggested shape: `Record<string, unknown> & { children?: unknown; onChange: (v: unknown) => void }`

### Contract
Only the `type El` declaration changes. No test logic, assertions, mocks,
or other files touched. Index access yields `unknown` (comparisons with
`===`/`toContain` still compile); `props.onChange` is callable with one
`unknown` arg and must not be possibly-undefined at the two call sites.
Out of scope: everything else in the file, all source files, eslint config.

### Actions
1. Replace `Record<string, any>` in `type El` with an `unknown`-based
   record plus an explicit callable `onChange` member (per the qa-1
   suggestion); adjust adjacent members only if tsc requires it.

### Done when
- `npx eslint tests/quality/audit-form-controls.test.tsx` exits 0, 0 warnings
- `npx tsc --noEmit` exits 0
- `npx vitest run tests/quality/audit-form-controls.test.tsx` passes (2/2)

### Verify
- Run: `npx eslint tests/quality/audit-form-controls.test.tsx && npx vitest run tests/quality/audit-form-controls.test.tsx` -> eslint exit 0; vitest 2/2 pass

### Handoff
Test file lint-clean; no source or API changes. Other `tests/quality`
failures (`qe-fd-cache`) are pre-existing baseline, not this leaf.
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
