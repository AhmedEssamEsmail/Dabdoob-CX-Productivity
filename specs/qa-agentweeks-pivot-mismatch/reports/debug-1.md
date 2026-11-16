# debug report - qa-agentweeks-pivot-mismatch - 1

Verdict: **ROOT_CAUSE_FOUND** — the two numbers measure different date dimensions.
On the default "interaction" basis, `qaScoreDate_` can only parse
`interaction_at` when it starts `yyyy-MM-dd` (`analytics.ts:151-157`,
`core.ts:677-681`). In production **6,680 of 6,817 `qa_audits` rows (98.0%)
store `interaction_at` as sheet-era `M/D/YYYY H:mm:ss` text** (e.g.
`10/15/2026 0:00:00`), so the app silently falls back to **`audit_date`** —
the day the audit was *logged*. The user's pivot groups by the *interaction*
date. `audit_date` lags `interaction_at` by median 2 days (observed 0–8), so
each app cell is a time-shifted, batch-shaped version of the pivot cell —
higher or lower depending on auditors' logging rhythm. Both directions of the
reported mismatch are explained.

Repro: `tests/quality/qa-scoredate-mdy-format.test.ts` (new, **fails now**):
`qaScoreDate_({interaction_at:'10/15/2026 0:00:00', audit_date:'2026-10-19'}, 'interaction')`
returns `'2026-10-19'` (audit_date) instead of `'2026-10-15'`.
DB repro: recomputing the app pipeline on prod rows reproduces the reported
app cells **exactly** (18-OCT=32, 13-SEPT=23, 20-SEPT=11).

## Exact app counting semantics (the `audits` sub-number, Agents-by-week)

A row counts iff ALL of:

| # | Rule | file:line |
|---|------|-----------|
| 1 | `agent_email` → `normEmail_` (trim + lowercase only; no dot-stripping) matches row key | `adapters.ts:75-77`, `analytics.ts:220-222` |
| 2 | Active view (default): email blank/non-`@` or in live-HCT active set | `server.ts:1912`, `server.ts:1833-1836`, `server.ts:1800-1817` |
| 3 | `kind` = 'audit' (blank defaults 'audit') AND `status` ∉ {`voided`, `disputed`} | `core.ts:262-266` (`qaRollupAudits_`, applied `analytics.ts:551`) |
| 4 | `score_final` or `score` non-blank | `analytics.ts:307-309`, `analytics.ts:553-557` |
| 5 | effective `sample_basis` ∈ {`random`, `historical`} | `analytics.ts:199-202`; derivation `analytics.ts:179-184` + `168-176` |
| 6 | date = `qaScoreDate_`: first `yyyy-MM-dd` of `qaWhen_(interaction_at)` — strips a leading `'`, converts only ISO-`Z` to Riyadh (+3h fixed, `engine.ts:792-810`); **any other text passes through and fails the regex → falls back to `audit_date[0:10]`** | `analytics.ts:151-157`, `core.ts:677-681` |
| 7 | that date's Sunday-start week (`weekStartsOn` default 0) is inside the 12-week grid ending at `qaPeriodOf_(min(periodEnd, today))` | `core.ts:372-377`, `engine.ts:97`, `analytics.ts:550`, `analytics.ts:208-232` |

Notably INCLUDED in the count: `status='historical'` (and basis 'historical')
rows — 396/456 of the test agent's rows count via this path.

## Pivot semantics and mapping

`COUNTA(agent_email)` per week of `interaction_at` over (presumably) all
exported rows — i.e. no filters 1-5 above, and the date = the interaction's
own date. The sheet stores `M/D/YYYY H:mm:ss` text which Sheets parses as a
date (month-first proven: 264/456 agent rows have day >12 in the second
field). So the pivot measures "interactions that occurred in week W" while
the app measures "audits logged in week W".

## Cell reconciliation — `abdelsamad.mohamed@dabdoob.com` (note: real email has ONE 'd', `dabdoob`, not PLAN's `dabdooob`)

456 rows; formats: 454 `M/D/YYYY`, 2 ISO. No voided/disputed/blank-score rows.

| Sun week | app (audit_date) | pivot (interaction date, recomputed) | user's pivot |
|---|---|---|---|
| 2026-09-13 | **23** ✓ | 15 | 19 |
| 2026-09-20 | **11** ✓ | 19 | 20 |
| 2026-10-18 | **32** ✓ | 15 | 20 |

- **18-OCT, app +17**: all 15 interaction-week rows appear in the app cell;
  the other 17 are audits *logged* that week on interactions from earlier
  days (lag p25=1d, med=2d, p75=3d, max=8d).
- **20-SEPT, app −8**: of the pivot's 19 rows, 8 were logged in week 09-27
  (`app-buckets-to-2026-09-27`); the remaining 11 = the app cell exactly.
- Lag + catch-up batching shifts counts both directions — matches the symptom.
- Off-queue rows (basis-excluded): app drops 2 rows in week 10-25, 9 in 11-01,
  12 in 11-08 — recent cells read extra-low vs a raw COUNTA pivot.

## Candidate-cause verdicts

| # | Cause | Verdict |
|---|-------|---------|
| 1/9 | interaction_at unparseable → `audit_date` fallback (incl. M/D/YYYY; also 33 blank rows) | **CONFIRMED — explains ~all divergence in both directions** (98% of table) |
| 2 | `sample_basis` filter (random/historical only) | **CONFIRMED** — 23 off-queue rows, weeks 10-25/11-01/11-08 (app < pivot, recent cells only) |
| 3 | blank-score filter | Mechanism real; **0 rows** for this agent — ruled out for these cells |
| 4 | `qaRollupAudits_` — NOT a dedupe; it filters kind≠audit & status voided/disputed (PLAN ln63-64 was wrong: calibrations/voided/disputed **are** excluded). Rescore is in-place (`server.ts:1441-1445`) — no double rows | **0 matching rows** — ruled out for these cells |
| 5 | calibration/voided rows in table | None for this agent — ruled out here |
| 6 | active-agent filter | Agent is active; only removes whole agents — ruled out |
| 7 | 12-week window | Both cells inside grid (2026-08-30..2026-11-15) — ruled out |
| 8 | week-start | Both Sun (`weekStartsOn=0` default `engine.ts:97`; pivot cols are Sundays) — ruled out |
| 10 | pivot-source divergence | **Partial / unverifiable**: recomputed interaction-week counts are 15/19/15 vs claimed 20/19/20. The user's flat "~20/cell" matches the sampling quota (`auditsPerWeek:20`, `engine.ts:92`) — pivot may be over the queue/draw export or a slightly different extract. Residual ~+5 on 10-18 attributed here |

## Siblings (same `qaWhen_`/`^\d{4}-\d{2}-\d{2}` pattern)

- Every `basis='interaction'` consumer buckets by `audit_date` for M/D/YYYY
  rows: health strip, `byAgent`, history, columns, `qaDrill_`
  (`analytics.ts:545,663,1015`), `getQaScoresPage`/`qaScoresRange_`.
- `qaHasInteraction_` (`analytics.ts:160-162`) → `fallbackDates` counter
  (`analytics.ts:978`, `:1240`) mislabels M/D/YYYY rows as "no interaction
  date"; the UI note (`qa-shared.tsx:301-304`) understates it.
- `qaHandledOf_` queue "handled date" (`server.ts:639`) has the same regex.
- Write path that produced the format: sheet→Postgres mirror copies
  `interaction_at` verbatim (`route-core.ts:138-147`); `backfillQaInteractionDates`
  (`server.ts:2401-2419`) copies queue values that `qaQueueFromSheet_` stored
  as formatted sheet text (`core.ts:613`). New audits via
  `qaCleanInteractionAt_` (`pure.ts:42-53`) store proper `'yyyy-MM-dd HH:mm` —
  the 104 ISO rows are all recent.
- Minor: ISO offsets (`+03:00`) also fail `qaWhen_`'s `Z$` regex; `score=null`
  numerics pass `qaScoreKnown_` as `'null'` → counted as 0. Not observed.

Regression test: `tests/quality/qa-scoredate-mdy-format.test.ts` — **failing
now** (`expected '2026-10-19' to be '2026-10-15'`).

If a fix is wanted: normalize stored `interaction_at` to `yyyy-MM-dd HH:mm`
(backfill) or teach `qaScoreDate_`/`qaWhen_` to parse `M/D/YYYY H:mm:ss` —
either restores interaction-date bucketing (note risk: `D/M` vs `M/D`
ambiguity for day ≤12 rows; month-first is proven for this dataset).
