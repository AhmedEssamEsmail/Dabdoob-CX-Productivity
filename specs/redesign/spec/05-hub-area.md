# 05-hub-area   (shard id: S05)
Owner: dev     Depends: S03,S04     Criteria: PLAN #1,#3,#6
Skills: none

## Goal
Migrate the Hub app to the new language: authored `styles/hub.css` for the `md-*` and `eco3-*` families, and replace every raw control in cx-hub components with `ui/` primitives.

## Files
Edit/create ONLY: `src/app/styles/hub.css` (new), `src/features/cx-hub/components/{admin-page,ecosystem-page,hub-shared,my-day-page,overview-page,people-holidays-page}.tsx`, `src/app/{page.tsx,my-day/page.tsx,overview/page.tsx,people-holidays/page.tsx,admin/page.tsx,admin/config/page.tsx,admin/roster/page.tsx,ecosystem/page.tsx}`
Read-only context: `src/app/legacy-apps.css:5-207` (hub section source rules), `src/app/theme.css` + `src/app/cx-kit.css` (tokens/classes to consume), `src/features/shared/components/ui/index.ts`, `src/features/cx-hub/components/ecosystem-page.tsx:2537-2660` (eco3 DOM), `src/features/cx-hub/components/admin-page.tsx:282-310` (appearance accents UI)
Forbidden: everything else

## Steps
1. Author `src/app/styles/hub.css`: port every `[data-app="hub"]`-scoped family rule from `legacy-apps.css:5-207` (all `.md-*` + the `[data-app="hub"]` dark re-declares) to the new tokens — hairline borders, `var(--cx-*)` colors/spacing/type only, NO hex literals, no px/rem font sizes outside `--cx-text-*`. Keep selectors `[data-app="hub"] .md-*` (equal specificity, later load wins).
2. Add `eco3` rules at TOP LEVEL (not `[data-app]` — ecosystem route renders bare without the shell): `.eco3`, `.eco3-canvas`, `.eco3-tags`, `.eco3-tag`, `.eco3-s-{ok,warn,down,idle}` restyled to refined neutral (muted dot/tag chips, hairline borders, `--cx-*` tokens). Keep class names byte-identical.
3. In `ecosystem-page.tsx`: retune hardcoded material/sky palette constants toward the neutral direction (fewer saturated hues) — GLSL strings may keep literals; TSX style props must use `var(--cx-*)`. Do not change behaviour, geometry, or the `eco3-*` class names.
4. In `admin-page.tsx`: the 4 accent swatch hexes (`Em` table ~line 285) — replace inline hex preview with a `data-accent-preview` span styled from `hub.css` (`[data-accent-preview="blue"]{background:#2b5797}` — hex lives in CSS, not tsx). Keep `applyAppearance`/storage logic untouched.
5. Add `import '@/app/styles/hub.css'` at the top of each listed `src/app` route file (ecosystem/page.tsx included — it needs the eco3 rules).
6. Codemod raw controls in the 6 cx-hub component files: `<button>` → `<Button>` (variant by class: `cx-btn--primary`→`primary`, `cx-btn--quiet`→`quiet`, else default; keep ALL other classNames via `className` merge — e.g. `.md-cardtoggle`, `.qa-sort`, `.nav-*` stay), `<input>/<select>/<textarea>` → `<Input>/<Select>/<Textarea>` (forward name/type/value/checked/required/autoComplete/placeholder/aria-*). Preserve every `data-*`, `aria-*`, `id`, `role`, `type`, `disabled`, `onClick`, inline `style` props verbatim.
7. If a raw control can't map (e.g. `all:unset` semantics genuinely needed), leave it with `// eslint-disable-next-line -- kept raw: <reason>` and count it.
8. `grep -n "<button\|<input\|<select\|<textarea" src/features/cx-hub` → 0 (or only waived lines).

## Done when
- `hub.css` covers all hub family selectors + unscoped eco3 rules; every hub route imports it; hub components have no raw controls.
- Verify: `npx tsc --noEmit` -> 0; `npx eslint src/features/cx-hub` -> clean; shots for `/`, `my-day`, `overview`, `admin`, `ecosystem` reskin correctly.
