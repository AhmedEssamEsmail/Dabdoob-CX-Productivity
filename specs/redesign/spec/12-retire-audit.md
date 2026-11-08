# 12-retire-audit   (shard id: S12)
Owner: dev     Depends: S03,S05,S06,S07,S08,S09,S10,S11     Criteria: PLAN #1,#3,#6,#8
Skills: none

## Goal
Retire the generated sheets, run the raw-control / hex / font-scale audits, and leave every gate green.

## Files
Edit/create ONLY: `src/app/layout.tsx` (remove 2 import lines), plus any straggler files needed to make audits pass (any `.tsx` under `src/` may be touched ONLY to add a waiver comment or convert a missed control)
Read-only context: `src/app/globals.css`, `src/app/legacy-apps.css` (files stay in tree; just un-imported), `e2e/` specs
Forbidden: manifests/lockfiles, `.env*`, deleting the generated css files (keep them — the merge script can regenerate)

## Steps
1. In `src/app/layout.tsx` delete `import "./globals.css";` and `import "./legacy-apps.css";`. Keep `theme.css` + `cx-kit.css` imports.
2. Raw-control audit — run from project root, expected 0 hits outside `components/ui/`:
   - `grep -rn "<button" src --include="*.tsx" | grep -v "components/ui"` → only lines with `-- kept raw:` waivers
   - `grep -rn "<input\|<select\|<textarea" src --include="*.tsx" | grep -v "components/ui"` → same
3. Hex/font audit (criterion #6): `grep -rn "#[0-9a-fA-F]\{3,8\}" src --include="*.tsx"` → only inside GLSL/shader strings (ecosystem) or waiver comments; `grep -rn "font-size:" src --include="*.tsx"` → 0. `grep -rn "fontSize" src --include="*.tsx" | grep -v "var(--cx"` → 0.
4. Selector-coverage sanity: for every class still emitted by tsx (spot-check `.pv-*`,`.md-*`,`.qa-*`,`.trk-*`,`.dk-*`,`.eco3-*`), confirm a rule exists in `theme.css`, `cx-kit.css`, or `styles/*.css`. Missing → add the rule to the matching authored css file (allowed edit).
5. Run all gates: `npx tsc --noEmit`; `npx eslint .`; `npx vitest run`; `npx next build`; `npm run test:e2e`; `npm run test:security`. Any failure caused by the markup changes → fix inside the offending component (preserve the DOM contract: roles, aria, names, `data-*`, class names, `#nav`, `input[name]`, `button[type]`).
6. Delete now-dead imports/vars lint surfaces (unused imports from the codemod), keep waiver comments intact.

## Done when
- `layout.tsx` imports exactly `theme.css` + `cx-kit.css`; both greps in step 2 return 0/waived-only; step 3 audits clean.
- Verify: `npx tsc --noEmit && npx eslint . && npx vitest run && npx next build` -> all exit 0; `npm run test:e2e` -> all specs pass; `npm run test:security` -> passes.
