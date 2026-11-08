# fix-ux-5-swatches: accent/swatch palette tokens + hub.css hex migration
Kind: mini
ID: fix-ux-5-swatches
Parent: fix-ux-5
Owner: dev
Depends: none
Criteria: ux-5 batch — accent/theme preview swatch palette exists only as hub.css hex literals (supersedes draft spec/fix-ux-5-controls.md)
Skills: none
Budget: files=2; actions=2; changed_lines=40; minutes=10

## Goal
Accent preview swatches (`[data-accent-preview]`) and theme tiles (`.ap-swatch`) consume named tokens from theme.css; rendered colors identical to today in light and dark.

## Files
- Edit: `src/app/theme.css` | add 4 `--cx-accent-*` named-palette tokens + 4 `--cx-swatch-*` tokens in `:root` after `--cx-accent-soft` (~l.142); redeclare the 4 accent tokens dark inside `html[data-theme="dark"]` (~l.218-221) and inside the `@media (prefers-color-scheme: dark)` `:root:not([data-theme="light"])` block (~l.281-284)
- Edit: `src/app/styles/hub.css` | `[data-accent-preview]` rules l.98-105 and `.ap-swatch[data-t]` rules l.206-211 — hex to var() swap only

## Context
- `src/app/theme.css:137-145` | light `:root` accent block — insertion point
- `src/app/theme.css:218-221` and `src/app/theme.css:281-284` | the two dark blocks that already redeclare `--cx-accent-*`; mirror the named palette tokens there
- `src/app/styles/hub.css:98-105` | 8 preview rules (4 light + 4 `html[data-theme="dark"]` variants)
- `src/app/styles/hub.css:205-211` | `.ap-swatch[data-t=light|dark|auto]` tiles incl. 135deg split gradients
- `src/app/styles/hub.css:114-135` | `--eco3-*`/`.eco3-s-*` hexes — keep (waived canvas palette, qa-4)

## Contract
New `:root` tokens: `--cx-accent-pine:#1b4c45`, `--cx-accent-blue:#2b5797`, `--cx-accent-plum:#6b3a72`, `--cx-accent-rust:#9a4a1f`, `--cx-swatch-light-bg:#f6f8f7`, `--cx-swatch-light-fg:#1b4c45`, `--cx-swatch-dark-bg:#131b1d`, `--cx-swatch-dark-fg:#0c2623`.
Dark redeclares (in BOTH dark blocks): `--cx-accent-pine:#3d8f76`, `--cx-accent-blue:#7aa8f5`, `--cx-accent-plum:#b78ad0`, `--cx-accent-rust:#e0955c`.
hub.css mapping: each `[data-accent-preview="X"]` -> `background:var(--cx-accent-X)` (the dark rules use the same var — dark values resolve via the redeclared tokens); `.ap-swatch` bg / `:before` / gradient stops -> the matching `--cx-swatch-light-*` / `--cx-swatch-dark-*` var.
Swatch pixel colors unchanged. Out of scope: `.eco3-head h1` (leaf fix-ux-5-eco3-h1), the `.eco3-*` block, every other rule/file, tsx.

## Actions
1. theme.css: add the 8 `:root` tokens after `--cx-accent-soft` (~l.142); add the 4 dark `--cx-accent-*` redeclares inside `html[data-theme="dark"]` (~l.218-221) and inside the system-dark `:root:not([data-theme="light"])` block (~l.281-284).
2. hub.css: replace the hex literals in l.98-105 and l.206-211 with the matching `var(--cx-accent-*)`/`var(--cx-swatch-*)` per the mapping above.

## Done when
- No hex remains in `[data-accent-preview]` or `.ap-swatch` rules; hex in hub.css only inside the `--eco3-*`/`.eco3-s-*` block (~l.114-135)
- All 8 `:root` tokens and both dark redeclare sets exist
- Appearance previews render identical colors in light and dark themes

## Verify
- Run: `grep -nE "#[0-9a-fA-F]{3,8}" src/app/styles/hub.css` -> only the ~9 `--eco3-*`/`--c` hexes remain (~l.114-135)

## Handoff
`--cx-accent-pine/blue/plum/rust` + `--cx-swatch-*` tokens published; fix-ux-5-eco3-h1 may edit hub.css only after this leaf lands (same-file serialization).
Write results/fix-ux-5-swatches.md (<=10 lines); TL alone updates TRACKER.md.
