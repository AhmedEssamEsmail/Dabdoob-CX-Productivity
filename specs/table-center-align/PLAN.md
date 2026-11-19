# PLAN: table-center-align
Type: feature (ui)   Status: draft
Date: 2026-11-19   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Every column header in every table renders `text-align:center`, and every body cell whose content is a numeral or percentage renders `text-align:center`. User-visible acceptance: on `/audit-queue` (and every other page with a table) `thead` headers and numeric `<td>`s are centered.

## Interpretation (PM calls; change in PLAN if wrong)
- "Headers" = `thead > tr > th` column headers, INCLUDING the first column (e.g. "Agent"). `tbody th[scope="row"]` row-label cells (agent names) are cells, not headers — they stay `text-align:start`. Sticky name columns keep start.
- "Cells that have numerals or percentages" = `<td>` whose rendered content is a number/percent/count/fraction (incl. `"19 of 20"`, `85%`, `0`, chips/badges holding those values). Text-only cells and interactive inputs (`.hm-num .input`, `.trk-num`) are NOT in scope.
- CSS cannot select by text content: numeric cells are identified by the codebase's numeral classes (`cx-num`, `num`, `cx-num-col`, `qa-cov__cell`, `qa-cov__ctr`, `hm-c`, `tph-hg__cell`, `pw-num`, `sch-grid-table`/`tph-hg` scoped rules). Where a numeric-content `td` lacks a class, add `cx-num` (canonical) — do not invent a new convention.

## Success criteria
1. Global rule in `cx-kit.css`: `thead th` for `.cx-table` AND bare `table` elements renders center; `td` carrying `.cx-num`, `.num`, or `.cx-num-col` renders center. `cx-num-col` changes `end`→`center` (it is used on numeric th+td). Specificity must beat `:root .cx-table :is(th,td) { text-align:start }` (0,2,1) and `:root .cx-table thead th` (0,2,2).
2. Per-app stylesheets reconciled — every rule currently forcing `th`/`td` start-align is adjusted so headers center and numeric cells center, while row-label cells keep start: `desk.css .dk-table`, `people.css .oo-table`, `queue.css .hm-need-table`, `queue.css .sch-table`, `quality.css .cx-table :is(th,td).num` (end→center), `productivity.css .tph-hg` (already center; first-child label stays start).
3. Markup leaves: every `<td>` in the 34 table files whose content is numeric/percentage and lacks a centered class gets `cx-num` added; every `thead th` lacking `scope="col"`/`className` anomalies reported (most are fine by default).
4. Already-correct stays correct: `.cx-agegrid`, `.tph-hg`, `.hm-c`, `.sch-grid-table`, `qa-cov` (after prev commit), `qa-aw`.
5. `tbody th` / sticky `qa-cov__name` / `tph-hg :first-child` row labels remain `text-align:start` — verified in the diff and on one rendered page.
6. Gates pass: `npx tsc --noEmit`, `npx eslint` on touched files, `npx vitest run` (repo suite; `qe-performer-resolution` pre-existing failure is foreign — attribute, do not fix), plus a small vitest asserting the CSS rules exist and the table markup carries the classes (follow `tests/quality/qa-cov-center.test.tsx` pattern where useful).
7. Commit only the files this run touches; never push.

## Scope / Non-goals
In: `cx-kit.css`, the 7 per-app stylesheets, the 34 tsx files containing `<table` markup, the class-name plumbing (e.g. SortTh already takes className).
Out: any layout/spacing/color change, `tbody` row-label alignment changes, numeric INPUT alignment, `display:grid`/`div`-based faux-tables (gantt, cards — not `<table>`), `.pw-kv dd`/`dk-*` non-table numerals, e2e/visual pixel assertions beyond the contract suite, pushes/PRs.

## Risk flags (y/n)
arch n · db n · data n · auth n · external-api n · ui y · perf n · deps n · tests n (vitest check inside a leaf) · docs n · deploy n
Review gates: QA (always) · Security: skip (pure CSS/markup classes, no input/authz) · UX/UI: run (spec ask is alignment-only but this changes every screen with a table)

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`. No new deps.
- Verbatim-port style: terse `/* --- X — ... */` symbol comments, `any` payloads; don't reformat untouched code.
- Heavy command output → log files + bounded tail (skills/OUTPUT-BUDGET.md); never cat `.next/`, `test-results/`, `playwright-report/`.
- Result files under `specs/table-center-align/results/` only — never repo-root `results/`.
- Foreign in-flight edits exist in the tree (hub-shared.tsx, overview-page.tsx, spec pngs); stage only this task's files explicitly — no `git add -A`.
- Pre-existing vitest failure `tests/quality/qe-performer-resolution.test.ts` is foreign (verified on clean tree) — attribute, never fix here.
- Repo-wide gates may fail on foreign edits: attribute, fix in place only if our files, never revert.

## Research notes
- Cascade: `:root .cx-table :is(th,td){text-align:start}` (0,2,1) and `:root .cx-table thead th` (0,2,2); winners must reach ≥0,2,3 or scope under an extra class/attr. Prev commit pattern: `[data-app="x"] .parent .class` works.
- `SortTh` (qa-shared) already accepts `className` after prev commit — reuse for centered sort headers where needed.
- Sortable header buttons (`.qa-sort` inline-flex) center correctly under a centered `th`.
- `tbody th` usage: `qa-cov__name` (quality), `cx-rowhead` (agents-page etc.), `tph-hg :first-child` — keep start; do not blanket-center `tbody th`.
- 34 files contain `<table`: cx-desk(2), cx-hub(4), cx-operations(1), cx-people(3), cx-productivity(5), cx-quality(11), cx-queue(6) + shared(2). Split markup audit by feature area.
- css vars: prefer `text-align:center` literal; px-exact comments style exists — no comment needed.

## Key pointers
- src/app/cx-kit.css:638-663 — base `.cx-table` rules + `cx-num-col { end }` + `cx-num` (no align)
- src/app/styles/quality.css:27 — `.cx-table :is(th,td).num { end }` → center; :165-176 — qa-cov rules
- src/app/styles/desk.css:33 — `.dk-table th,td { start }`
- src/app/styles/people.css:163 — `.oo-table th,td { start }`; :108 `.pw-kv dd { end }` (non-table)
- src/app/styles/queue.css:118 — `.hm-need-table th,td { start }`; :160-161 `.sch-grid-table` center / `.sch-table` start
- src/app/styles/productivity.css:146-150 — `.tph-hg` center + first-child start
- src/features/cx-quality/components/qa-shared.tsx:522 — SortTh (className prop exists)
- tests/quality/qa-cov-center.test.tsx — descriptor test pattern for alignment classes
