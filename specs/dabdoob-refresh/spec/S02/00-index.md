# S02: Design tokens + kit foundation (mockup design language)
Kind: package
ID: S02
Dispatch: NEVER

## Goal and contract
PLAN criteria #3 (rail/toast chrome) and #4 (kit/tokens): port the
`mockups/assets/mock.css` design language into the real design system —
warmer bg, card elevation, stat+delta chips, pills, compact tables,
mixbar/bar/spark viz, worklist items, master-detail, agenda timeline,
designed empty states — BOTH light and dark themes, all accent variants.

Architecture contract (all children):
- NEW class families live in `src/app/refresh.css` (new file, imported in
  `layout.tsx` AFTER `cx-kit.css` so it wins ties) — leaves S02-02..04.
- RESKINS of existing classes stay in `src/app/cx-kit.css` — leaves
  S02-05..06 (same `:root .cls` (0,2,0) convention).
- `theme.css` gets the token moves only — leaf S02-01.
- Colors come from `--*`/`--cx-*` tokens only; every value must have a
  dark-mode path (theme.css dark blocks) or be token-derived. Accent fill
  vs accent text stay separate tokens (`--cx-accent` vs `--cx-accent-text`)
  — verify theme×accent pairings, not per-selector fixes.
- Density contract preserved: `--cx-target` 2.25rem fine / 2.75rem coarse,
  table row ≤36px, td ≈13px (`shoot-new.mjs` contract checks must stay green).

## Children
Index: `S02/00-index.md`
| Leaf | Outcome | File(s) |
|---|---|---|
| S02-01 | theme.css token moves (bg/radii/shadows/new aliases) | theme.css |
| S02-02 | refresh.css base: shell+page chrome, utilities, states, palette, rail bits | refresh.css, layout.tsx |
| S02-03 | refresh.css: cards/stats/delta/pills/tags/agechip/tbl/seg/tabs | refresh.css |
| S02-04 | refresh.css: viz (mixbar/bar/spark/heat), worklist, agenda, md, login | refresh.css |
| S02-05 | cx-kit.css: rail/nav reskin (bullets off), toasts off-rail | cx-kit.css |
| S02-06 | cx-kit.css: controls/cards/chips/tables/segs/dq-head reskin | cx-kit.css |

## Completion
All six leaves done; `node .devin/work/shoot-new.mjs` contract-report shows
no targetOk/btnMinHOk/rowOk/baseFontOk regressions (PM-run gate).
