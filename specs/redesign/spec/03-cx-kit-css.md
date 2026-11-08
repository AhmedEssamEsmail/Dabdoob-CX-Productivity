# 03-cx-kit-css   (shard id: S03)
Owner: dev     Depends: S01     Criteria: PLAN #1,#6,#7
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Goal
Author `src/app/cx-kit.css` — the new design language for EVERY shared component class and the shell chrome — so the generated sheets stop being the visual source while class names stay identical (cx-* contract reskinned in place).

## Files
Edit/create ONLY: `src/app/cx-kit.css` (new), `src/app/layout.tsx`
Read-only context: `src/app/globals.css` (selector inventory — minified; extract with `node -e "const s=require('fs').readFileSync('src/app/globals.css','utf8');console.log([...new Set([...s.matchAll(/\.[a-zA-Z][\w-]*/g)].map(m=>m[0]))].join('\n'))"`), `src/app/legacy-apps.css:445-478` (example of per-app rail/nav re-skins to unify), `src/features/shared/components/shell/AppShell.tsx` + `ui.tsx` + `Popups.tsx` + `Toasts.tsx` + `BootSplash.tsx` + `ViewAs.tsx` (class usage), `src/app/theme.css` (S01's tokens), `src/app/auth/login/page.tsx` (`.state-screen`,`.field`,`.cx-muted` usage)
Forbidden: `globals.css`/`legacy-apps.css` (generated; do not edit), any `.tsx`, `.env*`

## Steps
1. Selector inventory first: run the node one-liner above on `globals.css` and on `legacy-apps.css`; list every class the sheets define. Your authored file must cover: base elements, `.cx-*` full family (btn+variants, input, select, textarea, field, panel, table/tablewrap, grid-2, chip, seg, toggle, tabs, note, section+fold `cxp-*`, skel/`skeleton`/`cc-skel`, muted/faint/error, dialog/menu/popup, `cc-tip`, `[data-age]`/`[data-status]` states), legacy `.btn`/`.btn-primary`/`.field`/`.field-label`/`.field-error`, shell chrome (`.shell`,`.rail`,`.rail-head`,`.brand`,`.brand-mark`,`.brand-name`,`#nav`/`.nav`,`.nav-group`,`.nav-group-label`,`.nav-link`,`.nav-ind`,`.nav-icon`,`.nav-text`,`.nav-ext`,`.nav-toggle`,`.rail-foot`,`.rail-who`,`.rail-va`,`.va-open`,`.rail-collapse`,`.nav-open`,`.rail-off`,`.main`,`.skip`,`.viewing-as`,`.state-screen`,`.page`,`.dq-head`,`.page-title`,`.page-purpose`,`.toasts`,`.toast*`,`.popup*`,`.sr-only`,`.cx-muted`,`.cx-empty`), entrance anim (`.is-in`,`.is-done`,`[data-entry]`), scrollbars, `::selection`, print rules, RTL (`[dir=rtl]`) and `data-tone` nav accents.
2. **Specificity rule (critical):** the generated sheets re-declare shared classes under `[data-app="x"]` (specificity 0,2,0). Author every shared rule as `:root .cls` (= 0,2,0) so it ties and wins by load order — `cx-kit.css` MUST be imported after `legacy-apps.css`. For selectors already `[data-app]`-scoped in legacy-apps.css you may also use `[data-app] .cls` in cx-kit.
3. Reskin per direction: refined neutral — hairline `1px solid var(--cx-line)` borders, `--cx-surface` panels, restrained `--cx-accent` for primary actions + nav indicator, tight type hierarchy (`--cx-text-*`), denser paddings, `--cx-shadow-pop` only for popups/dialogs. No gradient washes. One accent only; `data-tone` rail accents become muted status hues, not the rainbow set.
4. Geometry contract (criterion #6): every button class → `min-height: var(--cx-target); border-radius: var(--cx-radius-control); border: 1px solid <token>`; variant colors from tokens only.
5. Density: `.cx-table`/`table` rows → `td,th { block-size: 2.25rem; padding-block: .25rem }`-ish; base data font `var(--cx-text-sm)` (0.8125rem). `@media (pointer:coarse)` keeps `--cx-target` 2.75rem (already in theme.css; don't fight it).
6. A11y: `:focus-visible` ring (`var(--cx-focus-ring)` or `outline:2px solid var(--cx-focus)`) on EVERY interactive class; AA contrast for chip/status pairs in both themes — pick `--cx-status-*` combos that pass 4.5:1 text / 3:1 borders.
7. `.cx-empty` — add a class (new; `ui/Empty` will use it): centred muted block with icon slot, uses `--cx-ink-2` + hairline border.
8. `layout.tsx`: add `import "./cx-kit.css";` immediately after the `theme.css` import (order: globals → legacy-apps → theme → cx-kit).
9. `.rail` restyle: neutral surface (no more `--pine` dark rail) — `--cx-surface` bg, `--cx-line` hairline edge, `--pine-ink`-dependent rules remapped to `--cx-ink*` tokens (keep the var names in selectors only if you redefine them under `.rail`).

## Done when
- `cx-kit.css` covers the full selector inventory; `layout.tsx` import order is globals→legacy-apps→theme→cx-kit.
- No `var(--pine`/literal hex OUTSIDE token definitions leaks into authored rules; every interactive class has a `:focus-visible` style.
- Verify: `npx next build` -> 0; dev-check `/`, `/status-validation`, `/auth/login` show new language and unchanged DOM classes.
