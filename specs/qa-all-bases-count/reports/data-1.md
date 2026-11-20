# data report - qa-all-bases-count - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/2L

## Reconciliation (key check)

Metric: agent `audits` count — Kareem Salah (`kareem.salah@dabdoob.com`), period
2026-11, interaction basis, new all-bases rule. Tolerance: exact.

| Source | Result |
| --- | --- |
| Expected (PLAN / CC2 Quality `qa_audits`) | 43 |
| Live DB recompute (new rule: `qaRollupAudits_` + `qaScoreKnown_` + `qaScoreDate_(a,'interaction')` month `2026-11`) | **43** (random 26 + off-queue 17), avg score 81.4 |
| Same recompute, OLD rule (random only, excl. disputed) | 26 — reproduces the pre-change UI count |
| Sheet `qa_audits` tab (7,104 rows; readonly SA) — same filter chain | 43, basis split identical; **audit_id sets identical** (0 db-only / 0 sheet-only) |

Wider cross-check: all agents' counted audits per month 2026-09..11, DB vs
sheet — 48/48 agent-month cells exact. Exclusion buckets on Kareem's Nov set:
non-audit kind 0, voided 0, blank score 0, disputed 0 — the delta vs 26 was
purely the basis filter (17 `off-queue`), confirming debug-1.

## Checks vs PLAN definition

- **Definition match**: `qaRollupAudits_` (core.ts:263-267) now drops only
  `kind!='audit'` + `status='voided'` — matches PLAN ("disputed counted
  immediately"). `known` = rolled + `qaScoreKnown_` (analytics.ts:548-554);
  `audits: cur.length` = all bases, all statuses except voided.
- **All score paths switched**: team/CI, agentsAll, critical, criticalRate,
  scoreNoCritical, weighted, history + per-agent history, channels/by-TL
  segments, reasons loop — all on `scored`/`cur` (was `rnd`). `qaScoresRange_`
  `cur` = all counted; `randomScore`/`randomAudits`/`randomOf` removed with no
  dangling refs in src. `qaDrill_`/`getQaAnalyticsAudits` inherit all-bases +
  disputed via the shared helper.
- **Info preserved**: `pendingDisputes`/`notFinal` still emitted
  (analytics.ts:603, scoresRange:1102-1111); `bases[]`, `others[]`, nonTicket
  blocks kept as composition breakdowns.
- **Time**: interaction basis uses Riyadh wall-clock (`qeFmt_`, +3h) with
  sheet-era `M/D/YYYY` normalization — replicated verbatim in the recon.
- **Data quality**: 7,103 DB rows — 0 duplicate `audit_id`, 0 null
  `agent_email`. Sheet row 6803 has a blank `audit_id` (unmigratable per
  `require` mapping) — benign, explains the 7,104 vs 7,103 row delta.
- **Tests**: `tests/quality/qa-all-bases.test.ts` pins 4-counted/3-excluded
  (disputed+off-queue+non-ticket count; voided/calibration/blank drop) across
  all three aggregators + `pendingDisputes`; golden pin added. TL vitest PASS
  (930 tests).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
| --- | --- | --- | --- | --- | --- |
| data-1 | LOW | analytics.ts:611 | `qaPostStratify_` now receives non-ticket/off-queue contact types with no volume key; they drop out of the weighting and lower `coverage`. Mechanically consistent, but a heavily non-ticket period could make `weighted` misleading. | None required; optional: surface `coverage` next to the weighted score in UI. | dev (optional) |
| data-2 | LOW | analytics.ts:864-866 | attention `critBy` counts criticals over `cur` minus `historical`; disputed audits' critical fails now flag attention (new behaviour — consistent with count-immediately, but confirm intended). | None if intended; else add `a.status !== 'disputed'` to the critBy filter. | data-engineer (confirm) |

Not verified / assumptions: UI copy wording is the UX gate (out of scope here);
quota `doneBy` intentionally unchanged per PLAN non-goals; recon was read-only
(PostgREST GETs + `spreadsheets.readonly` scope), live DB may drift post-run;
sheet is the legacy source of record, verified identical to DB for the audited
population.
