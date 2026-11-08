# FUX-02: login "Forgot password?" — dead `href="#"` becomes non-interactive text
Kind: mini
ID: FUX-02
Parent: FIX-UX1
Owner: dev
Depends: none
Criteria: reports/ux-1.md ux-2 (MED)
Skills: none
Budget: files=1; actions=2; changed_lines=8; minutes=4

## Goal
"Forgot password?" is `<a href="#">` — a dead control that only mutates the
hash. Verified: NO reset route exists (`src/app/auth/` holds only `login/`
and `logout/`; no forgot/reset/reset-password route or page anywhere in
`src/`). Per the finding + PM instruction, drop the dead link; keep the
mock's forgot-row anatomy (`.between` label row still has a right-side
element) as non-interactive text.

## Files
- Edit: `src/app/auth/login/page.tsx` | password `Field` label only (~L105-114)

## Context
- `src/app/auth/login/page.tsx:105-114` | the `<a href="#">` inside the
  `.between` `Field` label
- `src/app/auth/` | directory listing proof: `login/`, `logout/` only — no
  reset flow to point at
- `reports/ux-1.md` row ux-2 | exact fix (drop or disabled text/hint)

## Contract
- Replace the `<a href="#" className="small" style={{ color:
  'var(--cx-accent)', fontWeight: 600 }}>Forgot password?</a>` with a
  `<span>` carrying the SAME `className="small"` and SAME inline style
  (color token itself is fixed by FUX-08 — do not change it here), no
  `href`, not focusable, no click handler.
- Keep the `D()`/i18n treatment exactly as the current text has it
  (the string is a JSX literal today — keep it a JSX literal).
- Out of scope: the color token (FUX-08), the submit Button/svg (FUX-01
  CSS handles sizing), anything else in the file.

## Actions
1. Swap `<a href="#" ...>` → `<span ...>`; remove `href`; keep class, style and text identical.
2. `npx eslint src/app/auth/login/page.tsx` + `npx tsc --noEmit` clean.

## Done when
- No `href="#"` remains in the file; the forgot element is a
  non-interactive `<span>` inside the `.between` label; login still
  renders both label-row children.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/app/auth/login/page.tsx` -> 0 errors; `grep -n 'href="#"' src/app/auth/login/page.tsx` -> 0 hits

## Handoff
FUX-08 restyles this span's color token.
Write results/FUX-02.md (<=10 lines); TL alone updates TRACKER.md.
