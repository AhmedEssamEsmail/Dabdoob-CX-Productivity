# 14-ui-docs   (shard id: S14)
Owner: tech-writer     Depends: S04,S13     Criteria: PLAN #2
Skills: none

## Goal
Write `docs/UI-SYSTEM.md` documenting the new design system: token layer, every `components/ui/` primitive with a gallery of its variants/states, theming/density/a11y notes, and the cx-* class mapping.

## Files
Edit/create ONLY: `docs/UI-SYSTEM.md`
Read-only context: `src/features/shared/components/ui/*.tsx` (real prop signatures — document what exists, not aspirations), `src/app/theme.css` (token names), `src/app/cx-kit.css` (class names), `.devin/work/shots/redesign/` (reference screenshots, do not copy images), `docs/REPO-LAYOUT.md` (doc style)
Forbidden: everything else

## Steps
1. Sections: Overview (refined-neutral direction) → Tokens (table: name, light, dark, purpose — cover palette/accent/type/radii/shadows/spacing/motion/status/age/density `--cx-target`) → Components → Theming (`cx.appearance` storage keys, `data-theme`, `data-accent`, `data-reduce-*`) → A11y contract (focus ring, contrast, reduced-motion, RTL, touch targets) → Legacy mapping (old `cx-*`/`btn`/`.field` class → component).
2. Components section: one subsection per ui/ export — Button (primary/quiet/danger/small/icon), Input, Select, Textarea, Field, Card, Section, Chip, StatusChip, Note, Seg, Toggle, Tabs, Table+parts, Modal, toast, Skeleton, Empty — each with a props table (from the .tsx) and a "Gallery" sub-table listing every variant × state (default/hover/focus/disabled/loading as applicable) with a one-line usage snippet.
3. Keep it factual: only document props/classes that exist; note "className merges onto the cx-* base" once globally.
4. No images required; reference shot paths textually (`.devin/work/shots/redesign/`).

## Done when
- `docs/UI-SYSTEM.md` exists covering all ui/ exports with props + variant/state gallery; token table matches theme.css names.
- Verify: `grep -c "^### " docs/UI-SYSTEM.md` -> ≥ 17 component sections.
