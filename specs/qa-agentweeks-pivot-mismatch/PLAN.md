# PLAN — Agents-by-week audit counts vs interaction_at pivot (INVESTIGATE ONLY)

## Goal
Explain why the per-agent, per-week audit counts (the small number under each score
chip) in the "Agents by week" table on `/quality-analytics` differ from a Google
Sheets pivot that does `COUNTA(agent_email)` grouped by week of `interaction_at`.
The user's pivot shows ~20 audits/agent/week for nearly every cell; the app shows
widely varying counts (e.g. Abdelsamad Mohamed: app 18-OCT = 32 vs pivot 20; app
13-SEPT = 23 vs pivot 19; app 20-SEPT = 11 vs pivot 20 — app is both higher AND
lower than the pivot depending on the cell).

**No fix.** Deliverable = a findings report that (a) documents the exact app
counting semantics, (b) enumerates every dimension on which the two numbers can
diverge, and (c) reconciles at least one concrete agent×week cell against real
DB data showing which causes explain the numeric gap.

## Success criteria
1. A precise spec of what the app's `audits` sub-number counts: filters, date
   field, timezone, week boundaries, window, dedupe — each with file:line cites.
2. A precise spec of what the user's pivot counts (all `qa_audits` rows by raw
   `interaction_at` date) and how it maps onto #1.
3. For >=1 concrete cell (suggest: `abdelsamad.mohamed@dabdooob.com` × week of
   2026-10-18, where app=32, pivot=20 — and a second cell where app < pivot, e.g.
   week 2026-09-20 app=11 vs pivot=20): run read-only queries against the real
   `qa_audits` data and decompose the gap into named causes with counts per cause.
4. Explicit verdict on each candidate cause: confirmed-explains-N-rows /
   ruled-out / unverifiable-without-pivot-source.

## Non-goals
- No code changes, no fix proposals beyond a one-line "if a fix is wanted" note.
- No changes to sheets, DB, or settings.

## Risk flags
- `data` — KPI/metric semantics investigation.

## App-side facts already established (verified by PM)
- `AgentWeeks` renders `c.audits` under the score chip:
  `src/features/cx-quality/components/quality-analytics-page.tsx:453-500`.
- `qaColumnTrend_(known, anchor, startsOn, nameOf, dateOf)` —
  `src/features/cx-quality/lib/analytics.ts:191-233`:
  - `list` = `known` filtered to `qaSampleBasis_ ∈ {'random','historical'}` (line 199-202).
  - Buckets into 12 weekly periods ending at `qaPeriodOf_(anchor,'week',startsOn)`.
  - `audits` = `l.length` of that filtered list.
- `dateOf` = `qaScoreDate_(a, basis)` (`analytics.ts:545`): basis 'interaction'
  (default) = the Riyadh date of `interaction_at` via `qaWhen_`, fallback
  `audit_date`; basis 'audit' = `audit_date` (`analytics.ts:148-157`). A visible
  UI toggle switches basis (`quality-analytics-page.tsx:1182+`, default
  'interaction' at :1209).
- `known` = `qaRollupAudits_(audits)` filtered to `qaScoreKnown_` (non-blank
  score) — `analytics.ts:551-557`. Blank scores are counted as `blankScores` and
  dropped.
- Server side `getQaAnalyticsPage` (`src/features/cx-quality/lib/server.ts:1875-1930`):
  - `active` defaults to 'active' → `qaActiveKeep_(agent_email)` filter on all
    audits (line 1911-1912).
  - `weekStartsOn` comes from `qeSettings_()` (line 1882); 0=Sun,1=Mon. App
    column headers (30-AUG, 06-SEPT … 15-NOV 2026) are Sundays → startsOn=0.
  - `anchor` = min(periodEnd, today) (`analytics.ts:550`); the 12-week grid ends
    at the *viewed* period's week, not necessarily the current week.
  - Result is cached (`cachePut`, key includes basis/active/startsOn, TTL 600).
- `qa_audits` rows include `kind='calibration'` and `status` values like
  'voided'/'rescored'/'disputed'/'historical' — check whether `qaRollupAudits_`
  or the basis filter drops any of them (calibrations/voided are NOT excluded
  from `known`/`list` on the evidence seen so far; only excluded in the quota
  block at `analytics.ts:596`).
- `qaWhen_` (find def, likely `src/features/cx-quality/lib/core.ts` or
  `pure.ts`) parses `interaction_at` — confirm the exact parse + timezone
  handling (Riyadh) and what it returns for blank/garbage values.
- Agent rows are keyed by `normEmail_(agent_email)`; label via `dir.name(e)`.
  Email variants (case, dots, typos) collapse in the app but stay separate rows
  in a raw pivot.

## Candidate causes to test (rank by likelihood)
1. **Date basis mismatch**: app in 'audit' basis (or toggle state) vs pivot on
   interaction_at → counts drift both directions across week boundaries.
   Also Riyadh-tz conversion of `interaction_at` vs the sheet's raw date.
2. **sample_basis filter**: app counts only random|historical; pivot counts all.
   (Explains app < pivot only.)
3. **known-score filter**: blank-score audits dropped in app.
4. **qaRollupAudits_ dedupe/merge** (rescored pairs etc.) — read its source.
5. **kind/status rows** (calibration, voided) counted in app but absent from the
   pivot's source — or vice versa.
6. **active-agent filter** — deactivated agents dropped in app default view.
7. **Window**: app shows exactly 12 weeks ending at the viewed period; pivot
   covers a wider range (matters only if comparing non-overlapping columns).
8. **Week-start convention**: confirm both use Sun–Sat for 2026 dates.
9. **interaction_at fallback**: rows with blank/unparseable interaction_at fall
   back to audit_date in app; pivot may drop or mis-bucket them.
10. **Pivot source divergence**: the sheet's interaction_at may already be
    Riyadh-formatted text ('yyyy-MM-dd HH:mm') or from a different table/export.

## DB access for verification (read-only SELECTs only)
- Project ref: `uugeyulccyytvgcabzzx` (production). Read-only queries are fine;
  NO writes, no migrations.
- Try the `supabase` MCP server first; if it lacks DB scope (known issue per
  `.devin/lessons.md`), use direct Postgres: host
  `aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.<ref>`,
  db `postgres` (password from local env/.env if present — do NOT print secrets).
- If no DB path works, deliver the code-level decomposition + the exact SQL the
  user can run, and mark criterion 3 as partially met.

## Conventions / gates
- Work dir: `specs/qa-agentweeks-pivot-mismatch/`; report at `reports/debug-1.md`.
- Keep transcript output bounded: redirect heavy query output to files, read
  bounded tails (`OUTPUT-BUDGET.md`).
- No commits, no pushes, no remote writes.
- Report format: Verdict/summary at top, then per-cause breakdown with
  file:line cites and query evidence.

## Research notes
- Both screenshots use Sun-start weeks in 2026 (app cols 30-AUG..15-NOV; pivot
  cols 12-JUL..01-NOV) — week boundaries probably match; verify anyway.
- Pivot last column 01-NOV suggests the pivot was built before week of 08-NOV
  closed; overlapping comparison range = 30-AUG..01-NOV.
