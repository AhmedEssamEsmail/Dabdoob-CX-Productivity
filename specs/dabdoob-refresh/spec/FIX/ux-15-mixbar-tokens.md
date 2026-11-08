# FUX-09: tph-grid mixbar/legend — refresh.css token map + per-segment ink
Kind: mini
ID: FUX-09
Parent: FIX-UX2
Owner: dev
Depends: none
Criteria: reports/ux-2.md ux-15 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=5

## Goal
The "% of cap — today by hour" `.mixbar` and its legend use `var(--accent)`
and `var(--bad)`, tokens that are never defined → "Actual"/"Over cap"
segments and both legend swatches render transparent, and `.mixbar > div`
ink sits ~1:1 on the card surface. `--line-2` segments are defined but the
white/#08130f ink measures 1.39:1 light / ~2.1:1 dark. Map every fill to
`--cx-*` tokens and give the flat `--cx-line-2` segments a readable ink so
all pairs pass AA in both themes.

## Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | `% of cap` mixbar + `.mixbar-legend` only (~L2057-2091)

## Context
- `tph-grid-page.tsx:2066-2076` | `bg` ternary (`var(--bad)`/`var(--accent)`/`var(--line-2)`) + segment `style={{ flex: 1, background: bg, minWidth: 0 }}` with `<span>` label
- `tph-grid-page.tsx:2078-2091` | legend `<i>` swatches: `--accent` (Actual), `--line-2` (Scheduled/estimate), `--bad` (Over cap)
- `src/app/theme.css:139-145,172-174` (light) and `:203,234,243,257-259,316` (dark) | `--cx-accent`/`--cx-accent-ink`/`--cx-status-bad-fg`/`--cx-status-bad-edge`/`--cx-line-2`/`--cx-ink` defined both themes
- `src/app/refresh.css:352-355` | `.mixbar > div` base already sets `color: var(--cx-accent-ink)` — correct ink for accent/bad fills, wrong for `--line-2`
- `reports/ux-2.md` row ux-15 | finding + suggested fix (edge/ink-2 variants measured below — TL chose passing tokens)

## Contract
- Fill map (segments AND matching legend `<i>` swatches):
  - `var(--accent)` -> `var(--cx-accent)` (ink stays base `--cx-accent-ink`: 6.4:1 light pine, >=4.7:1 all dark accents)
  - `var(--bad)` -> `var(--cx-status-bad-fg)` (w/ `--cx-accent-ink`: 6.5:1 light, 9.1:1 dark — `bad-edge` #d9483f only 4.24:1 light, rejected)
  - `var(--line-2)` -> `var(--cx-line-2)` plus explicit `color: var(--cx-ink)` on those segment divs only (11.0:1 light / 8.1:1 dark; `--cx-ink-2` fails dark at ~3.9:1)
- Add `color` via the existing inline `style` object (e.g. a second const
  or ternary on the same condition `bg` uses). No CSS file edits; do NOT
  change `.mixbar > div` base, `role="img"`/`aria-label`/`title`, `flex: 1`,
  legend text/structure, or anything outside ~L2057-2091.
- Out of scope: `var(--accent,#2563eb)` in legacy-apps.css (has fallback),
  queue/aging mixbars (ux-7 already fixed), ux-14 (deferred LOW).

## Actions
1. In the `bg` ternary (~L2066) replace the three tokens per the map; add
   per-segment `color: var(--cx-ink)` on the line-2 branch in the segment
   `style` object (~L2071).
2. Replace the three legend `<i>` swatch backgrounds with the same tokens
   (L2080, L2084, L2088).
3. `npx eslint src/features/cx-productivity/components/tph-grid-page.tsx` + `npx tsc --noEmit` clean; grep the file for `var(--accent)`/`var(--bad)` -> 0 hits.

## Done when
- 0 remaining `var(--accent)` / `var(--bad)` / `var(--line-2)` in the file;
  all six segment/legend fills use `--cx-*` tokens.
- Flat (Scheduled/estimate) segments carry `color: var(--cx-ink)`; accent
  and bad segments keep base `--cx-accent-ink`.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/features/cx-productivity/components/tph-grid-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "var(--accent)\|var(--bad)\|var(--line-2)" src/features/cx-productivity/components/tph-grid-page.tsx` -> no output

## Handoff
none.
Write results/FUX-09.md (<=10 lines); TL alone updates TRACKER.md.
