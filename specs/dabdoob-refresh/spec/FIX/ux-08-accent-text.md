# FUX-08: `--cx-accent` used as TEXT color → `--cx-accent-text` (`.kicker` + forgot span)
Kind: mini
ID: FUX-08
Parent: FIX-UX1
Owner: dev
Depends: FUX-01 (refresh.css serial), FUX-02 (login/page.tsx serial)
Criteria: reports/ux-1.md ux-8 (MED)
Skills: none
Budget: files=2; actions=2; changed_lines=6; minutes=4

## Goal
`--cx-accent` is a FILL token; as text it measures 4.08:1 on dark
`--cx-surface` (<4.5). `.kicker` and the login forgot-password element
use it as text color. Swap both to `--cx-accent-text` (dark `#59b795` =
7.2:1; light unchanged at ≥6:1). Project lesson: separate fill vs text
tokens.

## Files
- Edit: `src/app/refresh.css` | `.kicker` rule only (~L29-33)
- Edit: `src/app/auth/login/page.tsx` | forgot-password element's inline style only (~L110; a `<span>` after FUX-02)

## Context
- `src/app/refresh.css:29-33` | `.kicker { … color: var(--cx-accent); … }`
- `src/app/auth/login/page.tsx:110` | inline `color: 'var(--cx-accent)'` on the (post-FUX-02) forgot `<span>`
- `src/app/theme.css:144` | `--cx-accent-text: var(--cx-accent-hover)` — theme-aware text token, already used by `.cpk-item.on`/`.cpk-item:hover`
- `reports/ux-1.md` row ux-8 | exact fix

## Contract
- `.kicker`: `color: var(--cx-accent)` → `color: var(--cx-accent-text)`; all other declarations unchanged.
- Login forgot element: inline style `color: 'var(--cx-accent)'` → `'var(--cx-accent-text)'`; keep `fontWeight: 600`, `className="small"`.
- Do NOT touch `--cx-accent` used for fills/borders/backgrounds
  anywhere else, and do NOT change the element/tag (FUX-02 owns that).
- Out of scope: any other accent usage not named in the finding.

## Actions
1. Swap the two `var(--cx-accent)` text-color references to `var(--cx-accent-text)` (one per file).
2. `npx eslint src/app/auth/login/page.tsx` + `npx tsc --noEmit` clean.

## Done when
- `.kicker` and the forgot element both use `--cx-accent-text`; no other declaration changed in either file.
- `npx tsc --noEmit` clean.

## Verify
- Run: `grep -n "color: var(--cx-accent)" src/app/refresh.css && grep -n "cx-accent'" src/app/auth/login/page.tsx` -> `.kicker` line shows `accent-text`; login line shows `accent-text`

## Handoff
none.
Write results/FUX-08.md (<=10 lines); TL alone updates TRACKER.md.
