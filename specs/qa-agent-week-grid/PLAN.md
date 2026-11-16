# PLAN: qa-agent-week-grid
Type: feature   Status: draft
Date: 2026-11-16   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
On `/quality-analytics`, add a new table section immediately before the "Score over time" charts: agent names in rows, the last 12 weeks in columns. It must be styled identically to the page's other `cx-table` tables (e.g. "Who needs a look") and must follow the existing "By interaction date / Audited in period" basis toggle.

## Success criteria
1. A new `QaSection` + `TableScroll` + `table.cx-table` appears on `/quality-analytics` directly before the "Score over time" section (`<Columns/>`), titled e.g. "Agents by week".
2. Header row: `Agent` column + 12 week columns labelled `dd-Mmm` (e.g. `08-Nov`) of each week's FIRST day; title/tooltip shows the full week (`Week of YYYY-MM-DD, Sun–Sat` per `weekStartsOn`). Oldest week left, newest right (same order as `columns.week.periods`).
3. One row per agent with audits in the 12-week window (from the new payload field), sorted by agent name. Each cell = the week's score chip (`Chip`/`qaBand`-toned `%`) + faint audits count (`cx-faint qa-sub`), `–` when no audits that week — same cell composition as the column chart's data (`{avg, audits, history}`).
4. Basis connection: data comes from the existing `P.analyticsPage(grain, period, basis)` payload recomputed server-side, so toggling "By interaction date / Audited in period" rebuckets the table exactly like the charts — no extra fetch or client state.
5. Weeks = the 12 quota weeks ending at the same anchor the charts use (`min(periodEnd, today)`), respecting the `weekStartsOn` setting (0 = Sunday). Month view is NOT required.
6. Metric definition (data gate): numerator = mean of `qaFinalScore_` over audits whose `qaSampleBasis_` is `random` or `historical` (identical to the column charts); denominator bucketed per agent per week by `dateOf` (interaction date when basis=interaction else audit_date). Blank-score audits stay excluded (`known` list).
7. `npx tsc --noEmit` and `npx eslint` on touched files pass; the new pure-function extension is covered by a small unit test in `tests/quality/`.

## Scope / Non-goals
In: one new payload field (`columns.agentWeeks` or sibling produced by `qaColumnTrend_`), one new table component + render call, dd-Mmm week header formatting, a unit test for the 12-week bucketing.
Out: changing the 8-week / 6-month charts, the agent picker, drill-drawer wiring from cells, new API endpoints, DB/schema changes, commits/pushes.

## Risk flags (y/n)
arch n · db n · data y · auth n · external-api n · ui y · perf n · deps n · tests y · docs n · deploy n
Review gates: QA (always) · Security: skip (read-only display of existing payload, no authz/user input) · Data: run · Performance: skip (~12-column table, no new fetch/queries) · UX/UI: run
Budgets (perf flag): n/a

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Verbatim-port style in this feature: terse legacy symbol comments (`/* --- Xs — ... */`), `any`-typed payloads, eslint-disable header already present.
- Forbidden for agents: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`. No new deps.
- Next.js 16 differs from training data: check `node_modules/next/dist/docs/` before Next-specific code (unlikely needed; client component edits only).
- Heavy command output → log files + bounded tail (OUTPUT-BUDGET.md).
- Week buckets respect `S.weekStartsOn` (0=Sunday, engine quota week); labels must derive from the period key, not a hardcoded weekday.
- Result/report files under `specs/qa-agent-week-grid/results/`, never repo-root `results/`.

## Research notes
- `P.analyticsPage` → `POST /api/qa/getQaAnalyticsPage` → `qaAnalytics_` already takes `opts.basis` and builds `dateOf = qaScoreDate_(a, basis)`; `qaColumnTrend_` receives `dateOf`, so anything derived from its output follows the toggle for free.
- `qaColumnTrend_` currently returns `{ week: grainOf('week', 8), month: grainOf('month', 6) }`; each grain = `{ periods, team, agents[{key,label,cells[{avg,audits,history]}]] }`, agents pre-sorted by label. Extend with a 12-week grain (e.g. `agentWeeks: grainOf('week', 12)`) — do NOT widen the existing 8-week chart data.
- Anchor for both charts = `pEnd < todayKey ? pEnd : todayKey`; reuse the same anchor call so the table ends at the same week.
- Cell shape `{avg, audits, history}` matches the chart tooltip data; `history` count can be ignored in the table or shown faint — keep it simple: score + audits only.
- Week label: period key is `YYYY-MM-DD` first day of the quota week; format `dd-Mmm` e.g. `08-Nov` (en-GB `day:'2-digit', month:'short'` gives "08 Nov" — join with `-`); title attr `Week of YYYY-MM-DD` via `qaPeriodLabel`-style copy.
- Design tokens: `QaSection` (title+hint), `TableScroll` (`cx-panel cx-tablewrap`), `table.cx-table`, `td.cx-num`, `Chip status={qaBand(avg,false)}`, `span.cx-faint.qa-sub` — copy the `Agents`/`Attention` table structure verbatim.

## Key pointers
- src/features/cx-quality/lib/analytics.ts:186-232 — `qaColumnTrend_` (add 12-week grain here)
- src/features/cx-quality/lib/analytics.ts:675 — `columns` built and added to payload; `anchor`/`dateOf`/`startsOn` in scope
- src/features/cx-quality/components/quality-analytics-page.tsx:1235-1241 — render order: `HealthHead, Attention, Agents, Columns, Questions…`; insert new component before `<Columns/>`
- src/features/cx-quality/components/quality-analytics-page.tsx:348-444 — `Agents` table = canonical cx-table markup to mimic
- src/features/cx-quality/components/qa-shared.tsx:186-241 — `qaBand`, `ScoreChip`, `qaPct`; :1237-1259 — period/month label helpers
- tests/quality/qa-interaction-date.test.ts — existing unit-test home for basis/bucketing logic
