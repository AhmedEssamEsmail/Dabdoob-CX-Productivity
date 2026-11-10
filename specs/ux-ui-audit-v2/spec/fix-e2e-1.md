# fix-e2e-1 — tl6 e2e gate failures (BUILD final verify)
Source: `specs/ux-ui-audit-v2/logs/tl6-e2e.log`, reconciled in `reports/tl-6.md`.
Blocking finding: 10 deterministic failures (my-status `intervals list displays correctly` +
`status colors match design` ×5 projects). The other 5 failures are the known
seed/login + remote-load env flake class (`e2e login failed`, `aria-busy` timeouts) — NOT routed.

## e2e1-01: `Empty` title heading semantics — restore heading role lost by `empty`→`Empty` migration
Kind: mini
ID: e2e1-01
Parent: S12
Owner: dev
Depends: none
Status: fix leaf — tl6 e2e regression (S12-18..21 contract `.t` h2 → `Empty` title→strong)
Criteria: e2e gate — my-status heading assertions (`logs/tl6-e2e.log`)
Skills: none
Budget: files=1; actions=3; changed_lines=8; minutes=4

### Goal
`e2e/my-status.spec.ts` asserts `getByRole('heading', { name: 'No flags in the last 45 days' })`.
Pre-migration markup was `<div class="empty"><h2 class="t">…`; the `Empty` primitive renders
`title` as `<strong>` → heading role lost (a11y regression, 10 deterministic e2e failures).
Restore heading semantics inside the primitive so all 32 `Empty` consumers regain it.

### Files
- Edit: `src/features/shared/components/ui/Empty.tsx` | :4-13, :23 — add optional `level` prop + `role="heading" aria-level` on the title `<strong>`.

### Context
- `src/app/cx-kit.css:819` | `:root .cx-empty strong` rule must keep matching — do NOT rename the element.
- `e2e/my-status.spec.ts:48-50,63-65` | the contract under test (heading role only, no level check).

### Contract
Additive, zero structural churn: destructure `level = 2` (legacy `.t` sites were h2), add
`level?: number` to `EmptyProps` with a one-line doc comment, render
`<strong role="heading" aria-level={level}>{title}</strong>`. No call-site edits, no CSS edits,
no other prop changes.

### Actions
1. Add `level?: number` to `EmptyProps`.
2. Render the title `<strong>` with `role="heading" aria-level={level}` (default 2).
3. Typecheck + targeted e2e + goldens below.

### Done when
- `npx tsc --noEmit` clean.
- my-status heading specs pass: `intervals list displays correctly` + `status colors match design`.
- vitest goldens green, count unchanged from 1196/1196 baseline (no snapshot on Empty internals —
  if any golden asserts the strong attrs, report the count in results; do NOT widen scope).

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx playwright test e2e/my-status.spec.ts --project=chromium` -> 4/4 pass
  (log to `specs/ux-ui-audit-v2/logs/e2e1-01-my-status.log`, tail only).
- Run: `npx vitest run tests/golden` -> all pass.

### Handoff
Write `results/e2e1-01.md` (<=10 lines): status, files, check outputs, any golden snapshot
collisions. TL alone updates TRACKER.md.

## e2e1-02: my-status spec — `exact: true` on the `This week` heading assertion
Kind: mini
ID: e2e1-02
Parent: S12
Owner: dev
Depends: e2e1-01
Status: fix leaf — strict-mode collision from e2e1-01 heading semantics
Criteria: e2e gate — my-status `agent can view own productivity score` (`logs/e2e1-01-my-status.log`)
Skills: none
Budget: files=1; actions=2; changed_lines=2; minutes=3

### Goal
`getByRole('heading', { name: 'This week' })` substring-matches the new Empty heading
"No logged time this week yet." → Playwright strict-mode violation. The assertion's intent
is the literal section h2 "This week"; tighten it to an exact match.

### Files
- Edit: `e2e/my-status.spec.ts` | :18 — `name: 'This week'` → `{ name: 'This week', exact: true }`.

### Context
- `spec/fix-e2e-1.md#e2e1-01` | the heading-role contract now live in `Empty.tsx`.

### Contract
Change ONLY the `name:` option on line 18 — no other spec lines, no `Empty` edits, no other
`exact:` additions. The `'My status'` (:17) and `'No flags…'` (:49,:64) assertions stay as-is
(they still match exactly one heading).

### Actions
1. Add `exact: true` to the `getByRole` name option at `e2e/my-status.spec.ts:18`.
2. Run the my-status spec.

### Done when
- `npx playwright test e2e/my-status.spec.ts --project=chromium` -> 4/4 pass.

### Verify
- Run: `npx playwright test e2e/my-status.spec.ts --project=chromium` -> 4/4
  (log `specs/ux-ui-audit-v2/logs/e2e1-02-my-status.log`, tail only).
- Run: `npx vitest run tests/golden` -> pass.

### Handoff
Write `results/e2e1-02.md` (<=10 lines): status, file, check outputs. TL alone updates TRACKER.md.
