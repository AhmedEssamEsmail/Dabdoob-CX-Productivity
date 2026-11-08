# fix-ux-5-eco3-h1: .eco3-head h1 font-size onto the type scale
Kind: mini
ID: fix-ux-5-eco3-h1
Parent: fix-ux-5
Owner: dev
Depends: fix-ux-5-swatches
Criteria: ux-5 batch — `.eco3-head h1` uses a literal `font-size:1rem` outside the type scale (supersedes draft spec/fix-ux-5-controls.md)
Skills: none
Budget: files=1; actions=1; changed_lines=1; minutes=3

## Goal
`.eco3-head h1` consumes the type-scale token: `font-size:1rem` -> `font-size:var(--cx-text-lg)` (1.0625rem — intentional slight tightening per the density goal; do not add a new scale step).

## Files
- Edit: `src/app/styles/hub.css` | `.eco3-head h1` declaration block (l.167) — one property change only

## Context
- `src/app/styles/hub.css:166-172` | `.eco3-head` overlay rules; siblings already use `var(--cx-text-xs)`
- `src/app/theme.css:49,100` | `--cx-text-lg` resolves to `--text-lg: 1.0625rem`

## Contract
Change only the `font-size` declaration on `.eco3-head h1`. Keep all other declarations, selectors and file ordering untouched; no DOM/tsx edits.
Out of scope: every other rule in hub.css and every other file.

## Actions
1. In `src/app/styles/hub.css` l.167, replace `font-size:1rem` with `font-size:var(--cx-text-lg)` inside `.eco3-head h1`.

## Done when
- `.eco3-head h1` reads `font-size:var(--cx-text-lg)`
- No `font-size:<number>` literal remains in hub.css
- h1 renders ~same size (1rem -> 1.0625rem tightening noted in results)

## Verify
- Run: `grep -nE "font-size:[ \t]*[0-9.]+(px|rem|em)" src/app/styles/hub.css` -> 0 hits

## Handoff
hub.css is fully tokenized for font-size; no downstream contract changes.
Write results/fix-ux-5-eco3-h1.md (<=10 lines); TL alone updates TRACKER.md.
