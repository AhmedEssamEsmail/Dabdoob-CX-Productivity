# 06-quality-area   (shard id: S06)
Owner: dev     Depends: S03,S04     Criteria: PLAN #1,#3,#6
Skills: none

## Goal
Migrate the Quality app: authored `styles/quality.css` for the `qa-*`/`qs-*` families, and replace every raw control in cx-quality components with `ui/` primitives.

## Files
Edit/create ONLY: `src/app/styles/quality.css` (new), `src/features/cx-quality/components/{audit-queue-page,calibration-page,ctls-page,disputes-page,kb-gaps-page,my-auditor-kpis-page,my-audits-page,qa-forms-page,qa-shared,quality-analytics-page,quality-scores-page}.tsx`, `src/app/{audit-queue,calibration,ctls,disputes,kb-gaps,my-auditor-kpis,my-audits,qa-forms,quality-analytics,quality-scores}/page.tsx`
Read-only context: `src/app/legacy-apps.css:208-479` (quality section source rules), `src/app/theme.css` + `src/app/cx-kit.css`, `src/features/shared/components/ui/index.ts`
Forbidden: everything else

## Steps
1. Author `src/app/styles/quality.css`: port every `[data-app="quality"]`-scoped FAMILY rule from `legacy-apps.css:208-479` — all `.qa-*` and `.qs-*` (charts: `.qa-trend*`,`.qa-spread*`,`.qa-dot--*`,`.qa-line*`,`.qa-spark`,`.qa-cov*`,`.qs-*`). SKIP rules that only re-declare shared classes (`.cx-*`,`.rail*`,`.nav-*`,`.brand*`,`.va-*`,`.rail-collapse` — cx-kit.css owns them now) and the per-app token block.
   Token-ize: `var(--cx-*)` colors/spacing/type only, no hex, no hardcoded font sizes. Keep `[data-app="quality"]` scoping and SVG chart selectors identical (stroke/fill via `var(--s)`/`--cx-*`).
2. Density: `qa-cov` cell padding, table paddings, `qs-*` paddings tighten to the dense contract; keep `data-l`/`data-status` colour semantics.
3. Add `import '@/app/styles/quality.css'` at the top of each listed route `page.tsx`.
4. Codemod raw controls in the 11 cx-quality files: `<button>` → `<Button>` (variant by class), `<input>/<select>/<textarea>` → `<Input>/<Select>/<Textarea>`, `.cx-seg` radio clusters → `<Seg>` keeping `role="radiogroup"`, `.qa-sort` sortable column buttons → `<Button className="qa-sort">` (className preserved verbatim — e2e may target it), `.qa-link` unstyled links→buttons → `<Button className="qa-link">`.
5. Preserve ALL `data-*` (`data-picked`,`data-fatal`,`data-answer`,`data-l`,`data-status`,`data-up/down`,`data-noq`), `aria-*`, `tabindex`, `id`, `name`, `type`, event handlers verbatim.
6. Waivers allowed only as `// eslint-disable-next-line -- kept raw: <reason>`.
7. `grep -n "<button\|<input\|<select\|<textarea" src/features/cx-quality` → 0 (or waived only).

## Done when
- `quality.css` covers the qa-/qs- selector set on new tokens; routes import it; no raw controls in cx-quality.
- Verify: `npx tsc --noEmit` -> 0; `npx eslint src/features/cx-quality` -> clean; shots for `quality-scores`,`audit-queue`,`qa-forms` reskin correctly.
