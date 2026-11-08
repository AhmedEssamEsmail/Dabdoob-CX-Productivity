# Fix: .cx-toggle checked text color (ux-16)

Slug: fix-ux-2-toggle-color. Project root: `C:\Users\AHMED\KPIs\CX-Hub`.
Owner: dev     Source: `specs/redesign/reports/ux-2.md` finding ux-16 (MED).
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Findings
- **ux-16 (MED)** `src/app/cx-kit.css:362-366` `.cx-toggle input:checked + span` uses `color: var(--cx-accent)` on `--cx-accent-soft`. Dark pine: `--cx-accent` `--pine-2` `#3d8f76` on soft `#213638` ≈ **3.27:1 <4.5:1** (WCAG 1.4.3) — checked label + `✓` under-readable on people-holidays/audit toggles. `.cx-seg` checked (:334) correctly uses `--cx-accent-hover` (5.28:1); toggle is inconsistent. Light pine 5.3:1 ✓; dark blue/plum/rust pass.

## Goal
Checked `.cx-toggle` label text ≥4.5:1 on `--cx-accent-soft` in ALL themes/accents. Per report's exact fix: change :365 to `color: var(--cx-accent-hover)`; the border may keep `--cx-accent` (4.1:1 vs surface ≥3:1).

## Files (only these)
- `src/app/cx-kit.css`

## Rules
- One declaration change expected; no tsx/other-css edits; keep file comment style.
- Recompute contrast for dark pine AND re-verify the other 7 theme×accent checked-toggle pairs still ≥4.5:1 (accent-hover on accent-soft).

## Verify
1. Report sRGB relative-luminance ratios for all 8 theme×accent pairs after the change.
2. `npx tsc --noEmit` 0 errors; `npx eslint .` 0 errors.
3. Update TRACKER Review-findings row ux-16 → done with evidence. Reply <=100 words.
