# P2FSH-04 — va-title h2 -> p before page h1
Status: DONE
Files: src/features/shared/components/shell/ViewAs.tsx (va-title heading swapped h2->p, id+className kept)
Checks: eslint ViewAs.tsx clean; `npx tsc --noEmit` EXIT=0
Browser DOM-order probe not run locally (no dev server); change is tag-swap only, labelledby binding preserved.
Blockers: none.
