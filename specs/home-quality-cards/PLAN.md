# PLAN: home-quality-cards
Type: feature   Status: draft
Date: 2026-11-20   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
On Hub Home (`/overview`), remove the full-width up-next check-in card (`.upnext`,
`Nf`) and its header jump button (`If`, same page only — the pair stays exported in
hub-shared for my-day) and render 4 quality stat cards in that slot instead:
current-month QA score, delta vs last month, current-week QA score, open CTL count.
Audience = same as the banner: `!specialist && role !== 'agent'` (admin + TL).
Scope = same as Team pulse: admin all agents; TL = self + own team (`pulseEmails`).

## Success criteria
1. `/overview` for admin & TL shows NO `.upnext` card and NO `.upnext-jump` header
   button; instead a `.page-stats` row of 4 `.stat` cards labelled:
   "Quality this month", "vs last month", "Quality this week", "Open CTLs".
2. Metric definitions (window on `audit_date`, audits = `qaRollupAudits_`
   [kind='audit', status<>'voided'] ∩ `qaScoreKnown_`, scope = `pulseEmails`
   [admin: all]):
   - `quality.month` = audit-weighted mean of `qaFinalScore_` (round 1dp) over
     `audit_date` in [first-of-this-month .. today], else null.
   - `quality.monthDelta` = `month` − same mean over the previous calendar month
     (null when either side has no scored audits).
   - `quality.week` = same mean over `audit_date` in [quota-week start .. today];
     week start via `qaPeriodOf_(today,'week',weekStartsOn)`, `weekStartsOn` from
     `qa_engine_settings` config (default 0 = Sunday).
   - `quality.openCtls` = count of `qa_ctls` `status='open'`; admin: all; tl:
     `tl_email` = user (same leg as `qaCtlScopeVisible_(…,'mine')`; the CTL desk's
     active-agent filter is NOT applied — noted divergence).
   - Kuwait/'Asia/Riyadh' date keys (`dqDateKey_`); null-safe for missing stores
     (`exists:false` → empty), never throws (mirrors `ecosystemHealth` try/catch →
     `out.quality = null`).
3. `quality` key present for admin & TL; absent/null for agent & specialist.
4. `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` pass. Golden test keeps
   passing via an additive-strip divergence (same seam as D-PULSE).
5. Cards carry an `aria-label`/landmark so screen readers can tell them from the
   ticket stats row; empty scores render `–`, delta shows signed value (`Ql`).

## Scope / Non-goals
In: `src/features/cx-hub/lib/aggregates.ts` (add `quality` to getHomePage),
`src/features/cx-hub/components/overview-page.tsx` (remove Ag/r/If/Nf use, add
quality row), `tests/golden/hub-overview.test.ts` (strip additive key), one new
vitest for the quality block. Optional tiny CSS hook class if `.page-stats`
reuse needs spacing adjust.
Out: my-day-page's If/Nf (untouched), hub-shared exports, `.upnext` CSS, any
schema/migration, the CTL desk filters, scores-page CI math (QA_AGENT_MIN_N
verdict math is NOT reused — home shows the plain weighted mean like pulse).

## Risk flags (y/n)
arch n · db n · data y (metric windows/scoping) · auth n · external-api n ·
ui y · perf n · deps n · tests n · docs n · deploy n
Review gates: QA run · Security skip (no authz change; payload behind existing
requireRole) · Data: run · Performance: skip · UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`
e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Verbatim-port file: keep legacy short names; additive fields allowed via
  documented divergences (see `dropPulse_` D-PULSE precedent in
  `tests/golden/hub-overview.test.ts` ~line 115).
- Forbidden: package.json/lockfile, .env*, cx-kpis-*.json.
- ANOTHER AGENT is mid-flight editing cx-quality components + quality.css
  (git status shows qa-audit-footer-compact work). Do NOT touch those files;
  at commit, stage ONLY this task's hunks (git diff HEAD to verify).
- Home payload reads are perf-sensitive: reuse the one `readStoreFiltered` per
  table, keep the audit read bounded (`gte audit_date: prevMonthStart`).
- Result files under `specs/home-quality-cards/results/`, never repo-root
  `results/`.

## Research notes
- `.upnext`/`.page-stats` styles: `src/app/styles/hub.css` ~217, `src/app/refresh.css` ~51.
- `Ag/If/Nf/Om/Lf` live in overview-page.tsx + `hub-shared.tsx` (~580-615);
  my-day-page.tsx still uses If/Nf → exports stay.
- QA pure helpers: `qaRollupAudits_`, `qaFinalScore_`, `qaRound1_`,
  `qaCtlScopeVisible_`, `qaPeriodOf_` in `cx-quality/lib/core.ts` (~253-383);
  `qaScoreKnown_` in `cx-quality/lib/analytics.ts` (~304); `qeSettingsFrom_`
  in `cx-quality/lib/engine.ts` (~320) parses `qa_engine_settings` config.
- `getQaCtlPage` open/on_hold visibility for reference: `cx-quality/lib/server.ts` ~1192-1245.
- e2e treats up-next as optional (`e2e/toolbar-stability.spec.ts`) — removal safe.

## Key pointers
- `src/features/cx-hub/lib/aggregates.ts`:178-453 — `getHomePage`; `pulseEmails`
  built ~396-404, `pulse` ~405; quality block slots after that.
- `src/features/cx-hub/components/overview-page.tsx`:18-29 (`Ag`), 399-500 —
  `r` at 403, `If` in actions at 453, `Nf` card at 500 to replace.
- `tests/golden/hub-overview.test.ts`:115-125 — `dropPulse_` strip seam.
PLAN.md
