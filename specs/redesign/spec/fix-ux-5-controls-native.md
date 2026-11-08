# fix-ux-5-controls-native: shared native checkbox/radio styling
Kind: mini
ID: fix-ux-5-controls-native
Parent: fix-ux-5
Owner: dev
Depends: none
Criteria: ux-5 batch — kept-raw native checkboxes/radios have no shared styling outside `.pw-check` (supersedes draft spec/fix-ux-5-controls.md)
Skills: none
Budget: files=1; actions=1; changed_lines=10; minutes=5

## Goal
One shared restyle for kept-raw native `<input type="checkbox">`/`<input type="radio">`: uniform 1.125rem box, accent-colored check via `accent-color`, pointer cursor, dimmed disabled state. Plain native-control restyle only — no `appearance` or pseudo-element rendering.

## Files
- Edit: `src/app/cx-kit.css` | insert one rule block between the `.cx-switch` family end (after l.425) and `:root .cx-tabs` (l.427)

## Context
- `src/app/cx-kit.css:357-425` | `.cx-toggle`/`.cx-switch` inputs are `position:absolute;opacity:0` — the `[type]` rules are visually inert on them; their span internals keep their own sizes
- `src/app/styles/people.css:41` | `.pw-check` already sizes its own checkboxes — do not add overrides for it

## Contract
Add exactly these rules, `:root`-prefixed per cx-kit convention:
- `:root input[type="checkbox"], :root input[type="radio"] { width:1.125rem; height:1.125rem; accent-color:var(--cx-accent); cursor:pointer; flex:none; margin:0 }`
- `:root input[type="checkbox"]:disabled, :root input[type="radio"]:disabled { cursor:not-allowed; opacity:.55 }`
Invariants: CSS-only; no DOM/class/tsx changes; no `appearance`, `::before`/`::after`, or per-family overrides — the shared rule applies wherever the selector matches.
Out of scope: every other rule and file; theme.css/hub.css belong to sibling leaves.

## Actions
1. Insert the two rules above as one block at the l.425/427 boundary in `src/app/cx-kit.css`, matching the file's comment/spacing style.

## Done when
- `accent-color:var(--cx-accent)` present on the shared `input[type]` selector pair in cx-kit.css
- A kept-raw checkbox shows the accent-colored check in the default accent (spot-render)
- No `appearance`/pseudo-element rendering added; `.cx-toggle`/`.cx-switch` visuals unchanged

## Verify
- Run: `grep -n "accent-color" src/app/cx-kit.css` -> exactly 1 hit inside the new input[type] block

## Handoff
Shared native-control styling now comes from cx-kit.css; no downstream contract changes.
Write results/fix-ux-5-controls-native.md (<=10 lines); TL alone updates TRACKER.md.
