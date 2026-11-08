# S02-01: theme.css token moves toward the mockup palette
Kind: mini
ID: S02-01
Parent: S02
Owner: dev
Depends: none
Criteria: PLAN #4
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1; actions=4; changed_lines=140; minutes=10

## Goal
`theme.css` primitives move to the mockup token values (warmer background,
mock radii/elevation) and gain the couple of tokens the refresh sheets need,
in light, explicit-dark AND prefers-color-scheme-dark blocks.

## Files
- Edit: `src/app/theme.css` | :root block (L8-187), dark blocks (L195-326)

## Context
- `mockups/assets/mock.css:7-50` | target tokens: --bg #f2f5f7, --surface-2 #f7f9fa, --line-2 #d3dce3, --ink-3 #8494a3, radii 6/10/14, shadow trio
- `src/app/theme.css:8-187` | current :root (density contract at L189-190, L408-425 — do not regress)
- `src/app/theme.css:328-406` | accent variants (pine/blue/plum/rust light+dark) — keep working

## Contract
Light :root: `--paper: #f2f5f7`; add `--surface-2: #f7f9fa`, `--ink-3: #8494a3`,
`--line-2: #d3dce3`; radii -> `--radius-s: 6px`, `--radius-m: 10px`,
`--radius-l: 14px`; shadow trio -> mock values (shadow-1
`0 1px 2px rgb(16 30 42/.05), 0 1px 6px rgb(16 30 42/.04)`, shadow-2
`0 4px 16px rgb(16 30 42/.08)`, shadow-3 `0 20px 48px rgb(16 30 42/.16)`);
add `--cx-line-2: var(--line-2)` and point `--cx-surface-2` at
`var(--surface-2)` (light) / dark equivalent. Dark + auto-dark blocks:
re-derive `--surface-2`, `--ink-3`, `--line-2`, `--cx-line-2`,
`--cx-surface-2` to dark-appropriate values (surface lifted ~4-8% from
`--surface`, ink-3 lighter than `--ink-2`, line-2 stronger than `--line`),
keep dark shadow trio as-is (already dark).
Out of scope: accent hues (`--pine*`), font stack, density targets,
`[data-app]` re-pin block, focus/reduced-motion blocks.

## Actions
1. :root light: apply the value moves + add the four new tokens/aliases above.
2. `html[data-theme="dark"]`: add dark `--surface-2/--ink-3/--line-2` and re-derive `--cx-surface-2`/`--cx-line-2`.
3. `@media (prefers-color-scheme: dark)` block: same dark additions.
4. Sanity: `grep -n "cx-target" src/app/theme.css` still shows 2.25/2.75rem contract lines untouched.

## Done when
- `--paper` is `#f2f5f7`; `--radius-s/m/l` are 6/10/14px; new tokens exist in all three blocks.
- No token referenced anywhere is left undefined (`--cx-line-2`, `--cx-surface-2` resolve in both themes).
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
refresh.css leaves (S02-02..04) and reskin leaves (S02-05..06) may reference
`--surface-2`, `--ink-3`, `--line-2`, `--cx-line-2` from this change.
Write results/S02-01.md (<=10 lines); TL alone updates TRACKER.md.
