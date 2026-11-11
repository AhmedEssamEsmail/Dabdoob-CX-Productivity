# P-19 render profile — /tph-grid + /audit-queue

Measured 2025-11-11 by `node scripts/perf-profile.mjs` (Playwright chromium,
seeded admin `e2e.admin@dabdoob.com`) against `npm run dev` on localhost:3000.
Raw entries: `specs/perf-pushdown/logs/perf-profile.json`; console:
`specs/perf-pushdown/logs/perf-profile.log`.

**Caveat:** timings come from the dev build (unminified React, `performWorkUntilDeadline`
chunks), so absolute ms are inflated vs production. Entries are `longtask` /
`long-animation-frame` (>50 ms by definition); attribution is mostly the React
scheduler chunk, so regions are inferred from interaction timestamps.

## /tph-grid (serves `/tph`; 6 tabs, overview default)

| Segment | Window (ms) | Long entries | Peak |
|---|---|---|---|
| Initial render + data load | 0–3556 | 11 (all >50 ms) | LoAF 246 ms @1872, longtask 229 ms @1872 |
| Tab switch → grid (`#tph-tab-grid`) | 3556–4513 | 3 | longtask 102 ms @3564 (`OneOnOneAlerts.useEffect.unlock` chunk) |
| Day step back (`Previous day`, refetch) | 4513–end | 6 | LoAF 156 ms @5014, longtask 128 ms @4778 |

Interactions not applicable: no PagedList "more" button and no search/filter
control exist on this page (recorded `skipped`).

### Findings (>50 ms commits)

1. **Initial render / first commit — `TphGridPage` → `Ga` → `Xa` (overview tab).**
   ~250 ms LoAF during hydration+data render. Fix leaf: wrap `Xa`'s derived
   row/aggregate computations in `useMemo` (one outcome).
2. **Grid tab mount — `Es`/`Ts` (`tph-grid-views.tsx`, `tph-grid-matrix.tsx`).**
   ~100 ms commit on tab switch. Fix leaf: extract/memoize the heaviest row
   subcomponent with `React.memo` (one outcome).
3. **Day change refetch — `ae.page()` → `Ga` re-render.** ~130–156 ms commit.
   Fix leaf: memoize derived grid rows so unchanged tabs do not recompute on
   `d` identity change (one outcome); defer if P-16 index lands first.

## /audit-queue — BLOCKED (re-run 2026-11-11, seeded data present)

Re-run after extending `scripts/perf-profile.mjs` to wait for `.workitem`/alert
and to log `/api/qa` >=400 responses. Result: **the data path is still
UNMEASURED — not for lack of data, but because `getQaQueuePage` 500s.**

- Remote `qa_queue` holds 2,314 rows (~159 open within the 7-day desk window),
  so no seeding was needed. The page renders `Audit Desk` shell, then
  `LoadError`: "This page could not load. **column qa_queue.id does not
  exist**". 0 `.workitem` rows; all scripted interactions skipped.
- API evidence (`perf-profile.log`): `POST /api/qa/getQaQueuePage` -> 500
  `{"error":"column qa_queue.id does not exist"}` (x2, initial + retry).
- Root cause (schema drift, NOT a perf issue): remote `qa_queue` and
  `qa_audits` are pre-existing tables that lack the `id bigserial` column
  declared in `supabase/migrations/20261105172048_quality.sql` (`create table
  if not exists` skipped them). `readAllPaged` (`repo.ts:175`) defaults the
  ordering pk to `id`; `PK_OVERRIDES` has no `qa_queue`/`qa_audits` entry, so
  every `qaRows_('qa_queue'|'qa_audits')` read throws -> ALL Quality pages
  reading those tables 500 (desk, my-audits, scores, analytics, ...).
- Only measured entries: one ~90 ms LoAF + two ~80 ms longtasks during the
  shell/error render — dev-build inflated, error path only -> **no code
  change** proposed for perf; the blocker is functional.

**Fix-leaf proposal (TL to file; outside this leaf):** either add
`'qa_queue': 'queue_id'` and `'qa_audits': 'audit_id'` to `PK_OVERRIDES`
(code fix, verify no other qa_* table lacks `id` remotely — `qa_forms`/`qa_ctls`
do have it), or apply the missing `id` columns to the remote tables
(supabase-expert; remote write needs user approval). Re-run this profile
afterwards to measure the real data-state render.

## Post-fix re-profile (2026-11-11, after p19-01..03 + pk-apply-01)

Two `node scripts/perf-profile.mjs` runs against the same dev server; JSON in
`specs/perf-pushdown/logs/perf-profile.json` holds run 2, run 1 log in
`perf-profile-p19-06.log`. Dev-build timings are noisy run-to-run; verdicts
below cite both runs.

### /tph-grid — before/after per region

| Region | Pre-fix peak | Post-fix run 1 | Post-fix run 2 | Verdict |
|---|---|---|---|---|
| Initial render (`Ga`→`Xa`) | LoAF 246 ms | LoAF 233 ms | LoAF 178 ms | Improved in run 2 (~28%), marginal in run 1 — p19-01/p19-03 memo wins are real but inside dev-build noise |
| Grid tab mount (`Es`/`Ts`) | longtask 102 ms | longtask 192 ms | longtask 112 ms | NOT improved — within noise of pre-fix; p19-02 `memo` extraction did not show a measurable win in dev build |
| Day step refetch | LoAF 156 ms | LoAF 205 ms | LoAF 159 ms | NOT improved — run 2 matches pre-fix, run 1 worse; likely noise, no regression proven |

Remaining >50 ms entries all sit in the React scheduler chunk; no new
component-level signal. No further fix leaf proposed from this data —
recommend a production-build (`next build && next start`) profile before
filing more leaves, since dev timings cannot resolve <100 ms deltas.

### /audit-queue — data path now MEASURED (was BLOCKED)

- `POST /api/qa/getQaQueuePage` -> **200** (was 500 `column qa_queue.id does
  not exist`); pk-apply-01 fix confirmed. Payload: `rows[213]`,
  `requests[0]`, `passed[300]`, `quota[39]`, `auditors[6]`.
- Today's queue is genuinely empty (`requests` 0, no today's sample rows):
  page renders Audit Desk shell + "Nothing to do in today's queue." —
  **0 `.workitem` rows**, so "select first work item"/"search" interactions
  remain `skipped (not present)`. No `[role="alert"]` errors.
- Measured render commit on payload arrival: **LoAF ~266-292 ms** (run 2 /
  run 1) + duplicated longtask ~203-204 ms — dev-build inflated but >50 ms.
  >50 ms entry -> fix-leaf proposal (TL to file): memoize/split the
  `AuditQueuePage` data-state render (`audit-queue-page.tsx`, coverage +
  list regions) — one bounded leaf, same pattern as p19-01..03.
- Script quirk (pre-existing, not edited this leaf): `perf-profile.mjs`
  slices `entries` by a `before` count taken on the previous page, so
  `pages['/audit-queue'].entries` is empty; the raw entries are preserved
  under `segments[0].entries` in the JSON. TL may file a one-line fix
  (`entries: all`) if the flat array is needed downstream.

## Verdict

- /tph-grid: three >50 ms commit regions → three bounded fix leaves proposed above.
- /audit-queue: data path BLOCKED — `getQaQueuePage` 500s on remote schema
  drift (`qa_queue.id` missing); seeded rows exist (2,314). Fix leaf proposed
  above; re-profile after the schema/code fix.
- Out of scope noted: `one-on-ones` and `quality-analytics` share the same
  large-component pattern; if fix leaves 1–3 confirm the pattern, file a
  follow-up profiling leaf for those two routes.
