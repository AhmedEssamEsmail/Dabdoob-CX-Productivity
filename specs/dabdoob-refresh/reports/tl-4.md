# TL report 4 — dabdoob-refresh (FIX round 1, source: reports/ux-1.md)

Dispatched 8 bounded fix leaves (FUX-01..08, `spec/FIX/`, preflight
`check_shards.py` 8/8 PASS + semantic vs LIMITS) covering the 1 HIGH + 7 MED
blocking findings. All done. **5 LOW findings (ux-9..ux-13) deferred** per
FIX convention — recorded in TRACKER's findings table; say the word and I
shard them next round.

## Waves (same-file writers serialised)
- Wave 1: FUX-01 (refresh.css), FUX-02 (login), FUX-03 (palette+shell), FUX-06 (agents)
- Wave 2: FUX-04 (palette scroll), FUX-07 (queue mixbar), FUX-08 (accent-text; deps FUX-01+02)
- Wave 3: FUX-05 (palette combobox)

## Changed files (reviewer DELTA scope — this round's diffs only)
| File | Leaves | Change |
|---|---|---|
| `src/app/refresh.css` | FUX-01, FUX-08 | `.login-card .cx-btn--primary` (was dead `.btn-primary`) + `svg{width/height:.95rem}`; `.kicker` color -> `--cx-accent-text` |
| `src/app/auth/login/page.tsx` | FUX-02, FUX-08 | forgot `<a href="#">` -> `<span>` (no reset route exists — verified `src/app/auth/` = login/logout only); span color -> `--cx-accent-text` |
| `src/features/shared/components/shell/CommandPalette.tsx` | FUX-03, FUX-04, FUX-05 | `Tab` preventDefault branch; `listRef` + `scrollIntoView({block:'nearest'})` on `[active]`; input `role=combobox` + `aria-expanded/controls/autocomplete/activedescendant`; `id="cpk-list"`, option `id="cpk-item-N"` |
| `src/features/shared/components/shell/AppShell.tsx` | FUX-03 | `railSearchRef` on `.rail-search`; `onClose` focuses it after `setPaletteOpen(false)` (covers Esc/backdrop/Enter) |
| `src/features/cx-people/components/agents-page.tsx` | FUX-06 | workbook prose wall -> one `.card-hint` `D()` line |
| `src/features/cx-queue/components/queue-page.tsx` | FUX-07 | mixbar segment `color: var(--cx-age-ink-${ageRank})` (aging-page precedent) |

## Integration checkpoint (all writers finished)
- `npx tsc --noEmit` — PASS (clean)
- `npx eslint . --quiet` — PASS (0 errors)
- `npx vitest run` — PASS (1117/1117)

## Notes for the ux re-review
- ux-3: focus restore is on the palette `onClose` prop (Esc, backdrop,
  Enter-activate). The global ⌘K/Ctrl+K toggle and route-change close were
  untouched per leaf scope — flag if the gate wants restore there too.
- ux-2: link dropped to a `<span>` (same look, non-interactive) — no reset
  flow exists to link to.
- ux-7: `.mixbar > div` keeps `--cx-accent-ink` default for tph's
  accent/bad fills; only queue segments got per-rank ink (finding scope).
- e2e/shot-harness re-run = PM gates; no test updates needed (no hook changes).

## Status
All blocking findings fixed; no RESHARD_NEEDED, no blocked items.
Deferred: ux-9..ux-13 (LOW). Report: `reports/tl-4.md`; tracker: `../TRACKER.md`.
