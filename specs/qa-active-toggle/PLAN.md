# PLAN: qa-active-toggle
Type: feature   Status: draft
Date: 2026-11-16   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
/quality-analytics, /quality-scores and /audit-queue list people who are no longer active. Add an "Active only" / "All users" `Seg` to each page's top controls. Active only is the DEFAULT and must apply to EVERY agent-keyed table/section — so the server filters the audit/queue/CTL inputs (not just output rows) and every derived aggregate, table and drill becomes active-only. "Active" = a `dq_hct` row passing `dqHctActive_` (status 'Current' AND lwd blank/'-').

## Success criteria
1. All three pages load in "Active only" mode: every person-keyed surface — attention, byAgent, byTl/team-leads, ctlSla, auditors, nonTicket agent lists, repeats/coaching, scores byAgent/byTl, drill agent lists, and the audit-queue's rows/requests/passed/worklist/quota coverage rows — contains only active agents (people with rows but no qualifying dq_hct row are hidden).
2. Aggregates recompute on the filtered set: team score/health strip, history/columns, questions, by-channel/by-contact, reasons/others, the scores trend/hero, and the queue's "Today v of O audited" / worklist counts reflect active agents' rows only.
3. Toggling to "All users" refetches and restores today's behaviour exactly; toggling back re-filters. On /quality-scores the choice persists in the URL hash (default when param absent = active); /audit-queue keeps it in state like the analytics page.
4. CTLs for inactive agents drop from ctlOpen/ctlOverdue/coaching counts; auditor KPI rows for inactive auditors hide.
5. If `dq_hct` can't be read (missing store), "Active only" must NOT empty the pages — fall back to unfiltered.
6. Non-email sentinel rows like `(no lead)` are not dropped by person-keyed post-filters.
7. `npx tsc --noEmit` and `npx vitest run` pass.

## Scope / Non-goals
In: `getQaAnalyticsPage`, `getQaScoresPage`, `getQaAnalyticsAudits`, `getQaQueuePage` gain an `active` arg; shared dq_hct active-email helper; route + `P.*` wiring; Seg on all three pages; scores-page hash param.
Out: no schema/RLS changes; `qaAnalytics_`/`qaScoresRange_`/`qaDrill_`/`qaWeekQuota_`/`qaRequestRows_` pure functions stay untouched (filter inputs before calling, filter rows after); no other pages; `roster.active` sync unchanged. Audit-queue deliberate exclusions (management/diagnostic surfaces, not agent data): `unmatched` import note (name-only, no emails), the admin view-as `auditors` picker, `mine` own-audit counts, and the `AccessPanel`/`SamplingPanel` admin tools (separate endpoints — inactive people must stay manageable there, e.g. revoking an ex-auditor's grant).

## Risk flags (y/n)
arch n · db n (read-only on existing table) · data n · auth n · external-api n · ui y · perf n · deps n · tests n · docs n · deploy n
Review gates: QA (always) · Security: skip (read-only filter on a service-role table already read server-side; `qaRequireRole_` unchanged) · Data: skip · Performance: skip · UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Verbatim-legacy-port codebase: keep closure symbol style; comment new code like existing section headers.
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`. No new deps.
- dq_hct is service-role only (RLS deny-all) — server-side reads only, via `readStore`/`qaRows_`.
- Heavy gate output → log file + bounded tail (renderer OOM risk); don't `cat` logs.
- Do not commit/push unless the user asks.

## Cross-workstream note
- `specs/unify-roster-source` (in flight) drops the `dq_hct` table; its DECISION.md Q2=B re-points `qaActiveEmails_` to `dqReadHct_()` + 600s cache, fail-open null — same semantics, already coordinated. `roster.active` was rejected there (out-of-scope agents would silently narrow). `tests/platform/dq-hct-active.test.ts` tests only the pure `dqHctActive_` — unaffected.

## Research notes
- Filter inputs server-side: aggregates can't be re-derived client-side, so when active the server passes `audits`/`ctls` narrowed by `agent_email ∈ activeSet` (blank agent_email rows kept — unattributable) into the pure builders; post-filtering person-keyed rows is cheap defense-in-depth for quota/ctlOpen-sourced rows.
- dq_hct duplicate emails: mirror `dqRosterFromHct_` — an email counts active iff ANY of its rows passes `dqHctActive_`.
- Both payloads are cached 600 s: append `':act'`/`''` to `qa_an7:` and `qa_sc1:` keys (payload shape unchanged, no prefix bump needed).
- `getQaAnalyticsAudits` feeds BOTH pages' drill sections; pass the flag through `scope.active` so question→agent drill lists match the page mode.
- `qaQuotaAgents_` already returns roster-active agents only — quota behaviour is unchanged in both modes.
- `dqHctActive_` (`src/features/cx-hub/lib/roster.ts:154`) is module-private; export it. Cross-feature imports are established (server.ts already imports `@/features/cx-queue/lib`); no import cycle (roster.ts doesn't import cx-quality).

## Key pointers
- `src/features/cx-quality/lib/server.ts:1752-1783` — `getQaScoresPage`: filter `audits`, cache-key suffix
- `src/features/cx-quality/lib/server.ts:1785-1836` — `getQaAnalyticsPage`: filter `audits`+`ctls`, cache-key suffix, post-filter rows
- `src/features/cx-quality/lib/server.ts:1838-1870` — `getQaAnalyticsAudits`: filter `audits`
- `src/features/cx-quality/lib/analytics.ts:898-934,975-991` — person-keyed outputs: `attention`(email), `byAgent`(key), `byTl`(tlEmail), `ctlSla`(tlEmail), `auditors`(key), `nonTicket[].agents`(email), `repeats`(agentEmail)
- `src/features/cx-hub/lib/roster.ts:154-158` — `dqHctActive_` to export
- `src/features/cx-quality/components/qa-shared.tsx:99-104` — `P.scoresPage`/`P.analyticsPage`/`P.analyticsAudits` signatures
- `src/features/cx-quality/components/qa-shared.tsx:1364-1380` — `DrillSection` passes `scope.active`
- `src/features/cx-quality/components/quality-analytics-page.tsx:1116-1206,1139-1150` — `BasisSeg` pattern + `scope`/`r()` where the flag lives
- `src/features/cx-quality/components/quality-scores-page.tsx:394-450,476-519` — hash-param state machine (`readHash`/`writeHash`/`initialState`/`h()`) + `qs-bar` filter row
- `src/features/cx-quality/lib/server.ts:623-727` — `qaQueuePageFor_`/`getQaQueuePage`: filter `all` (qa_queue) after line 627 → narrows `rows`/`passed`/`requests`/quota `waiting`; post-filter `quota` + `quotaWeeks[].rows` on `r.email`; `failMemory` keys follow filtered rows automatically. No page cache here — direct compute.
- `src/features/cx-quality/lib/pure.ts:229-260,296-318` — `qaWeekQuota_` rows carry `email`; `qaRequestRows_` reads `all` (input filter covers it) — context only
- `src/features/cx-quality/components/audit-queue-page.tsx:140-249` — `useSe(() => P.queuePage(who))`, the `qa-queue-status` Seg in `aside` where the new Seg belongs, `seg` state pattern
- `src/features/cx-quality/components/audit-queue-coverage.tsx:91-162` — WeekCoverage reads `d.quotaWeeks[a].rows` (email-keyed)
- `src/app/api/qa/[action]/route.ts:14,37-39` — handler arg wiring (`getQaQueuePage` takes `a[1]`)
- `supabase/migrations/20261109131140_dq_hct_table.sql` — dq_hct columns (`status`, `lwd` are text)
