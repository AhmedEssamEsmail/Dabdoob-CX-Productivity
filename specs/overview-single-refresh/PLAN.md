# PLAN: overview-single-refresh
Type: bugfix   Status: done
Date: 2026-11-19   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
`/overview` currently renders two identical `RefreshButton` controls for admin/TL users: one in the page header and one inside the `Queues now` section. Keep only the page-header control, and make that single control refresh both the home payload and the queue-health section so removing the duplicate does not leave stale queue data.

## Success criteria
1. `/overview` renders exactly one `.cx-refresh > button` for admin/TL users, located under `.page-head .page-actions`.
2. The `Queues now` heading keeps its Freshdesk freshness hint but contains no refresh button/control.
3. A successful top-button refresh still POSTs `/api/queue/refresh`, reloads `/api/hub/home`, and causes the `Queues now` section to reload `/api/queue/health`.
4. No horizontal overflow or control movement regression is introduced at 375/1024 px.
5. Targeted typecheck/lint and a focused regression check pass; commit contains only this task's changes.

## Scope / Non-goals
In: `src/features/cx-hub/components/overview-page.tsx`; `src/features/cx-hub/components/hub-shared.tsx` only if needed to let `Mu` reload on a parent refresh signal; focused regression coverage if the debugger/TL chooses one.
Out: changing refresh API semantics/cooldown; changing `/queue` or `/aging` refresh controls; broad layout redesign; DB/auth/deploy work.

## Risk flags (y/n)
arch n · db n · data n · auth n · external-api n · ui y · perf n · deps n · tests y · docs n · deploy n
Review gates: QA (always) · Security: skip(no authz/input/API contract change) · Data: skip(no metric/pipeline change) · Performance: skip(no perf-sensitive change) · UX/UI: run
Budgets (perf flag): n/a

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Keep commits task-scoped; user requested exactly one commit, no push.
- Do not touch `package.json`, lockfiles, `.env*`, `cx-kpis-*.json`, DB files, or unrelated dirty files.
- UI definition of done includes the 375/1024 px page contract where practical.
- Use existing `Eo`/`usePageData` and `Hf`/`RefreshButton` patterns; no new dependency.
- Heavy gate output must go to logs under the task spec dir; read bounded tails only.

## Research notes
- Both controls are `Hf`, which delegates to shared `RefreshButton` and POSTs `/api/queue/refresh`; the server-side job is throttled to 120s and rebuilds Freshdesk/queue aggregates.
- The header control reloads only `Vi.home`; `Mu` owns the separate `Of.queueHealth` fetch, so the fix must propagate the successful refresh to `Mu` rather than merely deleting its button.
- Current CSS already constrains `.cx-refresh > button` to `min-inline-size: 11rem`; stale pre-`21c8b49` CSS explained the screenshot's full-width second button.

## Key pointers
- `src/features/cx-hub/components/overview-page.tsx:245-281` - `Mu` fetches queue health and renders the duplicate `Hf` in `Queues now`.
- `src/features/cx-hub/components/overview-page.tsx:399-455` - `OverviewPage` fetches home data and renders the header `Hf`.
- `src/features/cx-hub/components/overview-page.tsx:615-644` - `Mu` mounts for admin/TL layouts.
- `src/features/cx-hub/components/hub-shared.tsx:145-148` - `Eo` wraps `usePageData`; can accept an optional deps argument if needed.
- `src/features/shared/lib/use-page-data.ts:26-82` - `deps` refires the loader; `reload` bumps the internal tick.
- `src/features/shared/components/ui/RefreshButton.tsx:35-59` - `onDone` fires only when `refreshed` is true; button state is local.
- `src/app/refresh.css:497-499` - refresh/status/button sizing contract.
- `e2e/toolbar-stability.spec.ts:40-47` - existing `/overview` toolbar coverage to extend or use as evidence.
