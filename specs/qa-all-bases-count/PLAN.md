# PLAN — qa-all-bases-count

## Goal
Quality analytics must count **every audit** in every score, count, chart and
table — all sample bases (`random`, `targeted`, `request`, `off-queue`,
`non-ticket`, `historical`, `unknown`), **non-ticket audits blended into
agent/team scores**, and **disputed audits counted immediately**. The only
remaining exclusions: `kind != 'audit'` (calibration), `status = 'voided'`,
and blank scores (`qaScoreKnown_`). Verified context: agent Kareem Salah shows
26 audits for 2026-11 (random only) but 43 exist — see
`specs/agent-audit-count-gap/reports/debug-1.md`.

## Success criteria
1. Agents table `audits` count = all non-voided, non-calibration audits with a
   known score in the period (Kareem → 43 for 2026-11, interaction basis).
2. Team score, agent score/avg, trend, critical count/rate, full-marks,
   score-no-critical, weighted, channels, by-TL, history/trend series — all
   computed over the same all-bases, all-status-except-voided population.
3. `qaRollupAudits_` no longer drops `status='disputed'` (keep kind+voided);
   `pendingDisputes`/`notFinal` still reported as info.
4. `qaDrill_` (agent/question drill-down + `getQaAnalyticsAudits`) counts and
   lists all bases + disputed too; `others[]`/bases breakdowns remain but as
   composition info (no longer "excluded from the score").
5. Non-ticket audits join agent/team scores and counts; the nonTicket block may
   remain as an informational breakdown — no "never blended" semantics/copy.
6. All UI copy updated: no "random sample"/"random audits"/"random only"
   claims on analytics + scores pages + chart hints + empty states; the
   scores-page explainer (~line 673) rewritten for the new rule; per-agent
   `randomScore`/`randomAudits` columns removed or repurposed.
7. `npm run lint`, `npx tsc --noEmit`, and `npx vitest run tests/quality
   tests/golden` pass; golden fixtures updated to the new rule with a
   re-verified expected output (not blanket-blessed).

## Non-goals
- Queue mechanics unchanged: off-queue still uses no queue slot; quota/coverage
  (`doneBy`, queue detail copy) keeps its queue-slot meaning — flag for user
  at the end if they want it changed too.
- Dispute workflow, CTL/settlement logic, sync scripts unchanged.
- No schema/DB changes; no remote writes.

## Risk flags
- `data` — KPI/metric semantics change → data gate (`data-analyst`).
- `ui` — copy + column changes on analytics & scores pages → UX gate.
- `tests` — golden + quality unit tests shift.
- Skipped: `arch` (rule decided), `db`/`auth`/`external-api`/`security` (pure
  aggregation change), `perf` (same row volume — only the filter changes).

## Gates
- `npm run lint`
- `npx tsc --noEmit`
- `npx vitest run tests/quality tests/golden` (redirect to log, bounded tail)

## Conventions
- AGENTS.md: Next.js version differs from training — check
  `node_modules/next/dist/docs/` if touching framework APIs (unlikely here).
- Heavy output -> log file under specs/<slug>/logs/ + bounded tail; never cat
  logs; delete scratch logs when done (OUTPUT-BUDGET.md).
- Windows: no `node --check src/*.js` globs.
- Commit only this task's touched paths; never `git add -A`.

## Research notes
- Random-only touchpoints in src/features/cx-quality/lib/analytics.ts:
  `qaAnalytics_`: 556 isRandom, 558-560 rnd/rndPrev/rndPrev2, 575-577 team+
  critical, 588 agentsAll, 608-610 scoreNoCritical/criticalRate/weighted,
  624-627 prev/tlOf, 660 rndBy history, 683 reasons loop, 793-814 byTl block,
  934-946 nonTicket block, 976 audits/disputed counts, 618-621 bases[].
  `qaDrill_`: 1084 counted, 1086-1111 isRandom/rnd/team, 1142-1153 question
  table filters isRandom, 1228 others[].
  `qaColumnTrend_` (191) already uses all audits; `cell().history` line 203 ok.
- `qaRollupAudits_` core.ts:262 — drop `status !== 'disputed'`; callers:
  analytics.ts:404, 548, 1015, 1084; server.ts:1113.
- `qaSampleBasis_` analytics.ts:179 — keep returning real bases for breakdowns;
  `qaIsNonTicket_` still needed for ticketUrl + breakdown.
- UI copy: quality-analytics-page.tsx (43 bases strip, 80/99/210/300/337/436
  "random" texts, 1305 sub), quality-analytics-charts.tsx (141, 280 hints),
  quality-scores-page.tsx (227 empty, 239-240 randomScore col, 381, 550 sub,
  558 label, 579 minN text, 673-679 explainer), qa-shared.tsx (319 basis hint
  stays, 1252 'Random' chip label stays for basis display).
- Tests: tests/golden/quality.test.ts, tests/quality/qa-agent-weeks.test.ts,
  tests/quality/qa-interaction-date.test.ts; add pin: byAgent audits includes
  off-queue + disputed + non-ticket.
- Verification vs sheet: spreadsheet `1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w`
  tab `qa_audits`; debugger reconciler approach in debug-1.md.

## Key pointers
- Main file: src/features/cx-quality/lib/analytics.ts (~1241 lines, two big
  aggregators); core.ts:262 helper; server.ts:1113 + drill 1976.
- Components live in src/features/cx-quality/components/.
