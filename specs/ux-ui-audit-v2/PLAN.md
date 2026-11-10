# PLAN: ux-ui-audit-v2
Type: feature (audit → implement)   Status: done
Fix scope (user-approved): EVERYTHING — all findings Critical→Low across all 9 audit reports, Top 20 + runner-ups + Medium/Low tails.
Date: 2026-11-09   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Execute the full-app UX/UI audit defined in `docs/UX-UI Improvement v2` (severity-classified findings: layout, alignment, spacing, typography, design-system, centralization, Tailwind/shadcn, architecture, responsive, accessibility, performance) across all ~40 routes and shared components — verified against real rendered output (browser screenshots, multiple viewports) — then implement the approved priority fixes through the normal build + gates pipeline.

## Success criteria
1. `specs/ux-ui-audit-v2/AUDIT-REPORT.md` consolidates per-area findings in the doc's exact output format (SEVERITY/ELEMENT/LOCATION/CATEGORY/ISSUE/ROOT CAUSE/IMPACT/RECOMMENDED FIX/CENTRALIZATION OPPORTUNITY) plus sections A–F (summaries, scorecard, Top 20).
2. Every route in `src/app/**/page.tsx` and every component area in `src/features/**` is covered by exactly one area audit report (`reports/audit-*.md`); no area unaudited.
3. Every audited route has rendered screenshots at >=2 viewports (desktop + mobile) under `specs/ux-ui-audit-v2/shots/` and the auditor that covered it references the shots.
4. User approves a ranked fix list (Top 20 + all CRITICAL/HIGH) before BUILD.
5. Approved fixes implemented via mini-shards; typecheck/lint/unit gates pass; QA + UX/UI (+perf) review gates PASS.

## Scope / Non-goals
In: audit per the doc (code + rendered screenshots); centralization/dedup recommendations; fixes for user-approved findings.
Out: design rebrand/new visual language; new features; DB/API behaviour changes; dependency upgrades (report only); commits/pushes unless asked.

## Risk flags (y/n)
arch: y (post-audit, only if consolidated findings propose new shared subsystem — architect decides before fix sharding) · db: n · data: n · auth: n · external-api: n · ui: y · perf: y · deps: n · tests: y (extend e2e/responsive specs where fixes change layout) · docs: n · deploy: n
Review gates: QA (always) · Security: skip (no auth/API/integration changes expected; re-run if a fix touches them) · Data: skip · Performance: run · UX/UI: run
Budgets (perf flag): no regression vs current `npm run test:performance` baselines; bundle/route render findings quantified in audit.

Architecture decision: see `DECISION.md` (.cx-* canonical dual-form; homes shared/components/ui + shared/lib; order registry→foundation→codemods→dead-CSS→splits; no RSC hoisting/@layer rewrite/rebrand).

## Phases (this plan's pipeline)
A. CAPTURE — one `dev` shard: dev server + Playwright screenshot harness reusing `e2e/` auth/seed infra; shots at desktop 1440 + mobile 390 (tablet 768 for tables/dashboards) into `specs/ux-ui-audit-v2/shots/` + `shots/INDEX.md` (route → files). If a route can't be reached, record why in INDEX (don't fake).
B. AUDIT — parallel `ux-ui-expert` area shards (background, one area each, read-only) + one `performance-engineer` shard for the doc's perf section. Each reads `docs/UX-UI Improvement v2`, audits code + its shots, writes `reports/audit-<area>.md` in the doc's format.
C. CONSOLIDATE — PM merges area reports into `AUDIT-REPORT.md` (dedup, severity re-check, scorecard, Top 20). → user approves fix list.
D. FIX SPEC — `spec-architect` shards approved fixes into mini-shards under `specs/ux-ui-audit-v2/spec/` (architect first if flagged in C).
E. BUILD — `tech-lead` dispatches dev/test-engineer shards.
F. GATES — QA → Performance → UX/UI per §4.

## Audit area shards (Phase B)
1. `shared-tokens` — `src/features/shared/components/ui/*`, `components/layout/SiteChrome.tsx`, `src/app/globals.css`, `theme.css`, `cx-kit.css`, `refresh.css`, `legacy-apps.css` (design-token + primitive baseline all other shards compare against)
2. `shared-shell` — `src/features/shared/components/shell/*`, `shell/`, `platform/`, `lib/`, `vendor/` (nav, topbar, toasts, view-as, command palette)
3. `hub` — `src/features/cx-hub/*` + home/overview/agents/analytics/ecosystem routes + `hub.css`
4. `quality` — `src/features/cx-quality/*` + quality-* / qa-forms / calibration / disputes / audit-queue routes + `quality.css`
5. `queue` — `src/features/cx-queue/*` + queue / mail-desk routes + `queue.css`
6. `people` — `src/features/cx-people/*` + people-holidays / coaching / one-on-ones / meetings / checkins / notes / my-* routes + `people.css`
7. `productivity` — `src/features/cx-productivity/*` + productivity-analytics / tph* / kpi-logs / status-validation / my-status / my-day / trackers / scheduler routes + `productivity.css`
8. `desk-ops` — `src/features/cx-desk/*` + `src/features/cx-operations/*` + admin / auth / ctls / aging / heatmap / kb-* / tl-* routes + `desk.css`, `operations.css`
9. `perf` — performance-engineer: re-renders, component-tree weight, fetch duplication, bundle/dead-code, `src/app/styles/*` layering

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`  perf: `npm run test:performance`  build: `npm run build`

## Conventions (<=10 lines)
- Forbidden for agents: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`.
- Next.js 16 ≠ training data: read `node_modules/next/dist/docs/` relevant guide before Next changes; cite doc path in shards.
- `npm ci` first if node_modules stale; Playwright dep may be absent (sibling `~/WFM/node_modules` fallback per lessons).
- Heavy output → log files + bounded tails (OUTPUT-BUDGET); never cat `.next/`/playwright-report/test-results.
- No commits/pushes/deploys/remote-DB without explicit user approval.
- Screenshot artifacts are scratch under `shots/`; reports are deliverables under `reports/`.
- `specs/cx-hub/PORTING-GUIDE.md`: keep legacy function names verbatim in legacy-parity areas.
- `src/features/shared/platform/options.ts` contains NUL bytes — diffs as binary, edits still fine.

## Research notes
- NEEDS_USER/PM-note (PERF-12, S14-04): `tests/performance/api.spec.ts` is a vacuous stub asserting only hardcoded constants — `npm run test:performance` measures nothing and must NOT be treated as an enforced perf gate in Phase F; rewrite excluded per DECISION.md "Stays out".
- Audit spec source: `docs/UX-UI Improvement v2.md` (verbatim prompt; its OUTPUT FORMAT and severity classes are contractual for every audit-*.md).
- App: Next 16.4.3 + React 19 + Tailwind v4 + custom design tokens in `theme.css`/`globals.css`; shared primitives in `shared/components/ui/` (Button/Card/Input/Modal/Table/Tabs/etc. — the de-facto design system); per-area stylesheets `src/app/styles/*.css`.

## Key pointers
- `docs/UX-UI Improvement v2` — audit spec, binding output format
- `src/features/shared/components/ui/` — design-system primitives (baseline for duplication findings)
- `src/app/theme.css`, `globals.css`, `styles/*.css` — token + per-area CSS audit targets
- `e2e/seed-users.mjs`, `e2e/users.ts`, `e2e/auth.spec.ts`, `e2e/responsive.spec.ts` — auth/seed + viewport infra to reuse for screenshots
- `src/app/**/page.tsx` (~40 routes) — coverage checklist source for Phase B/CONSOLIDATE
