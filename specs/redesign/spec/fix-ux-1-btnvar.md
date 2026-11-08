# Fix: dead `cx-btn--small` / `cx-btn--icon` variants (ux-6)

Slug: fix-ux-1-btnvar. Project root: `C:\Users\AHMED\KPIs\CX-Hub`.
Owner: dev     Source: `specs/redesign/reports/ux-1.md` finding ux-6 (MED).
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Finding
- **ux-6 (MED)** `src/features/shared/components/ui/Button.tsx:25-26` + `docs/UI-SYSTEM.md:153-166` — `size="sm"`/`icon` emit classes `cx-btn--small`/`cx-btn--icon` that are **defined nowhere** in loaded CSS (only `.btn-small` exists). ~49 call sites get a silently dead small variant. Fix: author the classes (preferred — dropping the props would break ~49 call sites).

## Goal
`:root .cx-btn--small` and `:root .cx-btn--icon` authored in `cx-kit.css` next to `.cx-btn`, honouring the density contract: small = 2rem min-height + `--cx-text-xs`/xs text; icon = square (inline-size = block-size = `--cx-target`), padding reset, centered glyph. Docs updated only if behaviour/wording diverges.

## Files (only these)
- `src/app/cx-kit.css`
- `src/features/shared/components/ui/Button.tsx` (only if emitted class names need correction)
- `docs/UI-SYSTEM.md` (only if doc text needs correction)

## Rules
- Read `Button.tsx` first for exact emitted class names + any modifier composition (e.g. with `cx-btn--primary`). Reference legacy `.btn-small`/icon-button rules in `src/app/globals.css` (on disk, unimported) and any `.cx-btn` base rules already in `cx-kit.css`.
- Keep `:root .cls` (0,2,0) specificity, `--cx-*` tokens, logical properties, no `!important`, no literal hex.
- Do NOT touch call sites; do NOT remove the props.

## Verify
1. `grep -rn "cx-btn--small\|cx-btn--icon" src/app/cx-kit.css` shows new rules; `npx tsc --noEmit` 0 errors; `npx eslint src/features/shared/components/ui docs` clean.
2. Update TRACKER Review-findings row ux-6 → done with evidence. Reply <=100 words.
</content>
