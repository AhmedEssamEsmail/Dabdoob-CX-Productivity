# FUX-01: login CTA height — `.cx-btn--primary` selector + svg size
Kind: mini
ID: FUX-01
Parent: FIX-UX1
Owner: dev
Depends: none
Criteria: reports/ux-1.md ux-1 (HIGH)
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=4

## Goal
`.login-card .btn-primary` never matches — `Button` renders
`.cx-btn--primary`, so the 2.5rem height rule is lost and the bare submit
`<svg>` (no width/height attrs) defaults to 300x150, inflating the CTA to
~250px tall. Restore the mock's 40px CTA.

## Files
- Edit: `src/app/refresh.css` | `.login-card` block only (~L517-522)

## Context
- `src/app/refresh.css:517-522` | dead selector `.login-card .btn-primary`
- `src/features/shared/components/ui/Button.tsx:23-24` | renders `cx-btn cx-btn--primary`
- `src/app/auth/login/page.tsx:126-141` | submit `Button` + arrow `<svg>` with viewBox but no width/height attrs
- `reports/ux-1.md` row ux-1 | exact fix

## Contract
- Rename `.login-card .btn-primary` → `.login-card .cx-btn--primary`,
  declarations unchanged (`height: 2.5rem; justify-content: center;
  font-size: .875rem`).
- Add `.login-card .cx-btn--primary svg { width: .95rem; height: .95rem;
  flex: none; }` directly after that rule.
- Out of scope: login/page.tsx markup (the span/svg stay untouched), any
  other `.login-*` rule, `Button.tsx`.

## Actions
1. Rename the dead selector and keep its declarations.
2. Add the `.login-card .cx-btn--primary svg` sizing rule.
3. `grep -n "login-card" src/app/refresh.css` → `.cx-btn--primary` rules only, no `.btn-primary` left under `.login-card`.

## Done when
- `.login-card .cx-btn--primary` carries the 2.5rem height rule and a ≤1rem svg size rule; zero `.btn-primary` selectors remain under `.login-card`.
- No other refresh.css selector edited.

## Verify
- Run: `grep -n "login-card .btn-primary\|login-card .cx-btn" src/app/refresh.css` -> cx-btn--primary hits only

## Handoff
none.
Write results/FUX-01.md (<=10 lines); TL alone updates TRACKER.md.
