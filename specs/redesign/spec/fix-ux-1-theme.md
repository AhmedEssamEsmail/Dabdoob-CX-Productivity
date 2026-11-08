# Fix: theme.css contrast misses (ux-4, ux-5)

Slug: fix-ux-1-theme. Project root: `C:\Users\AHMED\KPIs\CX-Hub`.
Owner: dev     Source: `specs/redesign/reports/ux-1.md` findings ux-4 (MED) + ux-5 (MED).
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Findings
- **ux-4 (MED)** `src/app/theme.css:134` `--cx-ink-3` ≈ **3.51:1 (light) / 4.10:1 (dark)** vs surface <4.5:1 (WCAG 1.4.3). Consumers: `.nav-group-label`, `.popup-kicker`, `.nav-ext-note`, `.cx-faint`, `.cx-section__hint`-adjacent text — nav group labels render on all 40 routes. Raise the mix (e.g., `--cx-ink-2` ~85% of surface) or re-declare so both themes reach ≥4.5:1.
- **ux-5 (MED)** dark `[data-accent="pine"]` pair `--cx-accent-hover` on `--cx-accent-soft` ≈ **4.40:1** <4.5 → `.nav-link[aria-current]`, `.cx-seg label:has(input:checked)` text fails AA in dark pine only (blue/plum/rust pass; all light accents pass). Brighten dark pine's `--cx-accent-hover` (report suggests ~#59b795) or deepen `--cx-accent-soft` — verify ≥4.5:1.

## Goal
`--cx-ink-3` text ≥4.5:1 vs its surfaces in BOTH themes; dark-pine accent-hover on accent-soft ≥4.5:1. Do not regress any pair that currently passes.

## Files (only these)
- `src/app/theme.css`

## Rules
- Token edits only; no tsx/other-css edits; keep file comment style. If `--cx-ink-3` is also used decoratively where 3:1 suffices, still fix at the token (simplest) — a slightly darker tertiary ink is acceptable.
- Check every block that re-declares the token (`html[data-theme="dark"]`, prefers-color-scheme, per-accent blocks) — fix each that fails.
- No new tokens unless strictly needed.

## Verify
1. Compute sRGB relative-luminance contrast for each changed pair (light + dark) and report ratios; thresholds above must pass.
2. `npx tsc --noEmit` 0 errors; `npx eslint .` 0 errors.
3. Update TRACKER Review-findings rows ux-4, ux-5 → done with evidence. Reply <=100 words.
</content>
