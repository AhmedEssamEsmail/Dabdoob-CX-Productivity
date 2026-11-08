# 09-ops-desk-areas   (shard id: S09)
Owner: dev     Depends: S03,S04     Criteria: PLAN #1,#3,#6
Skills: none

## Goal
Migrate the Operations and Desk apps: authored `styles/operations.css` (`trk-*`) and `styles/desk.css` (`dk-*`), plus raw-control codemod in cx-operations + cx-desk components.

## Files
Edit/create ONLY: `src/app/styles/operations.css`, `src/app/styles/desk.css` (new), `src/features/cx-operations/components/trackers-page.tsx`, `src/features/cx-desk/components/{kb-tracker-page,kpi-logs-page,mail-desk-page,tl-performance-page}.tsx`, `src/app/{trackers,tl-performance,kb-tracker,kpi-logs,mail-desk}/page.tsx`
Read-only context: `src/app/legacy-apps.css:1127-1255` (operations), `:1256-1383` (desk), `src/app/theme.css` + `src/app/cx-kit.css`, `src/features/shared/components/ui/index.ts`
Forbidden: everything else

## Steps
1. `styles/operations.css`: port `[data-app="operations"] .trk-*` family rules (banner, grid, tools, tables, switch/select heads) onto `var(--cx-*)`, dense paddings, hairlines; keep selectors/scoping identical.
2. `styles/desk.css`: port `[data-app="desk"] .dk-*` family rules (`dk-skel`,`dk-failed/error/fine/muted/none`,`[data-band]` bands, kpi-logs/mail-desk/tl-performance layouts) the same way; `[data-band]` keeps `--band` mechanism, values from status tokens.
3. Imports: `import '@/app/styles/operations.css'` → `src/app/trackers/page.tsx`; `import '@/app/styles/desk.css'` → `src/app/{tl-performance,kb-tracker,kpi-logs,mail-desk}/page.tsx`.
4. Codemod raw controls in the 5 component files → `ui/` primitives; preserve all `data-*`, `aria-*`, `role`, `name`, `type`, `id`, handlers.
5. Waivers: `// eslint-disable-next-line -- kept raw: <reason>` only.
6. `grep -n "<button\|<input\|<select\|<textarea" src/features/cx-operations src/features/cx-desk` → 0 (or waived only).

## Done when
- Both css files cover their family selectors on new tokens; routes import them; no raw controls in either feature dir.
- Verify: `npx tsc --noEmit` -> 0; `npx eslint src/features/cx-operations src/features/cx-desk` -> clean; shots for `trackers`,`tl-performance`,`mail-desk` reskin correctly.
