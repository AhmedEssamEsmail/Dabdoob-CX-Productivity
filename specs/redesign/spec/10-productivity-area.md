# 10-productivity-area   (shard id: S10)
Owner: dev     Depends: S03,S04     Criteria: PLAN #1,#3,#6
Skills: none

## Goal
Migrate the Productivity app: authored `styles/productivity.css` for the `pv-*`/`tph-*` families (currently unscoped in `globals.css`), and replace every raw control in the productivity pages with `ui/` primitives.

## Files
Edit/create ONLY: `src/app/styles/productivity.css` (new), `src/app/{status-validation,my-status,productivity-analytics,tph-grid}/page.tsx`, `src/features/cx-productivity/components/pv-shared.tsx`
Read-only context: `src/app/globals.css` (pv-*/tph-* selector source — grep `pv-\|tph-`), `e2e/status-validation.spec.ts` + `e2e/my-status.spec.ts` (DOM contract: `.pv-item`,`.pv-item__who`,`.pv-item__what`,`.pv-detail`,`.pv-strip`,`.pv-facts`,`.pv-cards article`,`.pv-form`,`radiogroup`,`.cx-chip[data-status]`,`.cx-table`,`.toast`), `src/app/theme.css` + `src/app/cx-kit.css`, `src/features/shared/components/ui/index.ts`
Forbidden: everything else

## Steps
1. Verify scope safety: `grep -rln "pv-\|tph-" src/features --include="*.tsx" | grep -v cx-productivity` — if anything outside cx-productivity renders pv-/tph- classes, note it and keep those selectors unscoped in step 3.
2. Extract every `.pv-*`/`.tph-*` rule from `globals.css` (they are unscoped there — the productivity sheet was the base app).
3. Author `src/app/styles/productivity.css`: re-author each rule under `[data-app="productivity"]` scoping (unless step 1 found cross-app users — then keep the same unscoped selectors). `var(--cx-*)` tokens only; dense tables (`pv-item` rows ≤2.25rem); the pv strip/cards/detail/form keep exact class names; tph grid keeps its dense tabular structure.
4. Add `import '@/app/styles/productivity.css'` to `src/app/{status-validation,my-status,productivity-analytics,tph-grid}/page.tsx` (`tph` re-exports tph-grid — covered).
5. Codemod raw controls in `status-validation/page.tsx`, `my-status/page.tsx`, `productivity-analytics/page.tsx`, `tph-grid/page.tsx`, `pv-shared.tsx`: `<button className="pv-item">` → `<Button className="pv-item">` (className byte-identical — e2e clicks `.pv-item`); decision-form radios keep `role="radiogroup"` (use `<Seg>`); `.pv-form` accept/revert buttons → `<Button>` keeping accessible names "Accept as…"/"Revert to…".
6. Preserve ALL `data-*`, `aria-*`, `name`, `type`, `id`, handlers verbatim.
7. Waivers: `// eslint-disable-next-line -- kept raw: <reason>` only.
8. `grep -n "<button\|<input\|<select\|<textarea" src/app/status-validation src/app/my-status src/app/productivity-analytics src/app/tph-grid src/features/cx-productivity` → 0 (or waived only).

## Done when
- `productivity.css` covers pv-*/tph-* on new tokens; the 4 pages import it; no raw controls; e2e selectors intact.
- Verify: `npx tsc --noEmit` -> 0; `npx eslint src/app/status-validation src/app/my-status src/app/productivity-analytics src/app/tph-grid src/features/cx-productivity` -> clean; `npm run test:e2e -- status-validation my-status` passes.
