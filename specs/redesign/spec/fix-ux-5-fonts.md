# fix-ux-5-fonts: remaining font-size literals -> type scale (people/queue/desk)
Kind: mini
ID: fix-ux-5-fonts
Parent: fix-ux-5
Owner: dev
Depends: none
Criteria: ux-5 batch — font-size literals outside the type scale violate the "no font sizes outside the type scale" contract
Skills: none
Budget: files=3; actions=3; changed_lines=22; minutes=10

## Goal
Every `font-size:<number>` literal in people.css, queue.css and desk.css resolves to a `var(--cx-text-*)` scale token. Scale (theme.css:45-52): xs .75rem, sm .8125rem, md .875rem, lg 1.0625rem, xl 1.375rem, 2xl 1.75rem, 3xl 2.5rem. `.9375rem`->md and `1.125rem`->lg are intentional slight tightenings (density goal) — no new scale steps.

## Files
- Edit: `src/app/styles/people.css` | the 17 literals at l.7,9,11,12,18,22,27,34,41,49,67,78,81,83,105,110,128
- Edit: `src/app/styles/queue.css` | `.dq-statusline` l.237 and `.dq-chart__axis` l.269 only
- Edit: `src/app/styles/desk.css` | `.dk-overall b` l.27 only

## Context
- `src/app/theme.css:45-52` and `src/app/theme.css:97-103` | `--text-*`/`--cx-text-*` scale definitions
- `src/app/styles/queue.css:180` | `.sch-cell sup` `font-size:.6em` — leave (proportional glyph, by design)
- `src/app/styles/quality.css:150` | `.qa-sort__arrow` `.7em` — verify-only, intentionally not edited
- `src/app/styles/hub.css:167` | `.eco3-head h1` literal is owned by fix-ux-5-eco3-h1 — do not touch hub.css
- `src/app/theme.css:182` + `src/app/cx-kit.css` + `src/app/globals.css` + `src/app/legacy-apps.css` | token definition site / proportional `.93em` / generated parity — non-goal, do not touch

## Contract
Mapping — people.css: `.75rem`->`var(--cx-text-xs)` (l.9,34,78); `.8125rem`->`var(--cx-text-sm)` (l.18,105); `.875rem`->`var(--cx-text-md)` (l.22,27,49,81,83,128); `.9375rem`->`var(--cx-text-md)` (l.7,12,41,67,110); `1.125rem`->`var(--cx-text-lg)` (l.11). queue.css: `.8125rem`->sm; `12px`->`var(--cx-text-xs)` (12px == xs at 16px root). desk.css: `2.5rem`->`var(--cx-text-3xl)` (exact match).
Change `font-size` declarations only; selectors, rule order and other properties untouched; CSS-only, no DOM/tsx edits.
Out of scope: theme.css, cx-kit.css, quality.css, hub.css, generated parity css, proportional `.em` sizes.

## Actions
1. people.css: apply the Contract mapping to the 17 listed rules.
2. queue.css: l.237 `.8125rem`->`var(--cx-text-sm)`; l.269 `12px`->`var(--cx-text-xs)`; leave l.180 `.6em`.
3. desk.css: l.27 `2.5rem`->`var(--cx-text-3xl)`.

## Done when
- Zero `font-size:<number>px|rem` literals in the three edited files
- `.6em` (queue.css) and `.7em` (quality.css) remain untouched
- `.9375rem`->md and `1.125rem`->lg tightenings recorded in results (tracker note for TL)

## Verify
- Run: `grep -noE "font-size:[ \t]*[0-9.]+(px|rem)" src/app/styles/people.css src/app/styles/queue.css src/app/styles/desk.css` -> 0 hits

## Handoff
Only remaining authored font-size literal is hub.css `.eco3-head h1` (owned by fix-ux-5-eco3-h1); all domain CSS then sits on the scale.
Write results/fix-ux-5-fonts.md (<=10 lines); TL alone updates TRACKER.md.
