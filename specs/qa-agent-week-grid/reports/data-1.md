# data report - qa-agent-week-grid - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/1L

Reconciliation: `columns.agentWeeks` cell `{avg,audits,history}` — recomputed fixture (2 agents × 12 weeks, anchor `2026-11-14` Sat, `weekStartsOn=0`) by hand: quota week of anchor = `2026-11-08` (Sun), periods[0] = `2026-08-23` (anchor −77d verified). Expected b@x wk11 avg 80/audits 1, a@x wk11 avg 60/history 1, team total 2 — `qaColumnTrend_` output matches exactly (delta 0, tolerance exact). Edge cases verified: out-of-window audit (`2026-06-01`) dropped, `targeted` basis dropped, historical counted. `npx vitest run tests/quality/qa-agent-weeks.test.ts` → 4/4 pass.

Checks:
- Definition (PLAN #6) matches code exactly: `qaColumnTrend_` filters `qaSampleBasis_` ∈ {random,historical} before bucketing (analytics.ts:199-202); avg = plain mean of `qaFinalScore_`, `qaRound1_` (analytics.ts:203-207); same `known` list → blank scores excluded (analytics.ts:553-557, `qaScoreKnown_`:307).
- Basis toggle: `agentWeeks` built inside same `grainOf` closure using the shared `dof = dateOf` (`qaScoreDate_(a,basis)`, analytics.ts:545,676) — rebuckets identically to `week`/`month` grains.
- Time: periods via `qaPeriodOf_`/`qaPrevPeriod_`/`dqAddDays_` — pure UTC date-key arithmetic, no DST; shared `anchor = min(pEnd, todayKey)` (analytics.ts:550) → last column = same quota week as the 8-week chart; `startsOn` (0|1) respected in bucketing, header tooltip and hint (`t.weekStartsOn === 1`, payload field confirmed analytics.ts:977).
- No double counting: each audit lands in exactly one cell via period-key index `at[]` (analytics.ts:211-223); agents appear only with ≥1 in-window audit (lazy `agents[e]` creation), sorted by `label` — matches "one row per agent with audits in the 12-week window".
- Rendering: `avg === null → '–'`, else `Chip status={qaBand(avg,false)}` + `qaPct` + faint `audits` — consistent with existing `qaBand(x,false)` usage (line 59) and `{avg,audits,history}` cell shape. `awLabel` uses `timeZone:'UTC'` en-GB → `dd-Mmm` (e.g. `08-Nov`); title `Week of YYYY-MM-DD, Sun–Sat|Mon–Sun`. Rendered directly before `<Columns/>` (line 1303-1304).
- Access scoping: server-computed page payload; table exposes the same agent data already shown by the charts — no new scope.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| data-1 | LOW | quality-analytics-page.tsx:486 | `c.avg === null` misses `NaN`: a non-numeric non-blank score (passes `qaScoreKnown_`) yields `avg=NaN` → renders "NaN%" with `ok` band. Inherited from shared `cell`/`meanOf` math; DB score column is numeric so risk negligible. | `c.avg === null \|\| !isFinite(c.avg)` → '–' (or coerce in `cell`) | dev |

Not verified / assumptions: no live-DB reconciliation (read-only review; pure-function recomputation + unit test used instead). Assumes `score`/`score_final` columns are numeric in DB per schema. `history` count present in payload but intentionally not rendered per PLAN ("score + audits only"). Newest column may be a partial quota week — same as charts, by design.
