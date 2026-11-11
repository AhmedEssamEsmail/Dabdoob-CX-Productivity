# fix-p19-1: P-19 follow-up leaves from PERF_PROFILE.md
Source: `docs/PERF_PROFILE.md` (S15-01, measured 2025-11-11). Three /tph-grid
commit regions >50 ms -> three bounded fix leaves; /audit-queue data path was
unmeasured -> one re-profile leaf. Same-file rule: p19-01 and p19-02 both edit
`tph-grid-views.tsx` -> serial via Depends. All remedies use existing components
only (`PagedList.tsx`, React `useMemo`/`memo`); no new deps; dev-build timings
are inflated — verify by re-running `node scripts/perf-profile.mjs` after the fix.

## p19-01: Xa overview tab — memoize remaining derived rows
Kind: mini
ID: p19-01
Parent: S15
Owner: dev
Depends: none
Criteria: PLAN #9 (P-19 fix leaf 1 — initial render ~250 ms)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=7

### Goal
`Xa` (overview tab) recomputes nothing unmemoized on render; existing `useMemo`s keep stable deps.

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | `Xa` body (:193-~475)
- Create: `tests/perf/tph-grid-memo.test.tsx` | render-count / memo parity test for `Xa`

### Context
- `src/features/cx-productivity/components/tph-grid-views.tsx:193-475` | `Xa`; existing useMemos at :201-229
- `docs/PERF_PROFILE.md` | finding 1 (~250 ms LoAF on initial render)
- `src/features/cx-productivity/components/tph-grid-shared.ts` | `Ua`/aggregation helpers `Xa` calls (verify import names while editing)

### Contract
Every derived list/map `Xa` renders (missing/over/below/call/note items and any
remaining inline `.filter`/`.map` aggregates) is `useMemo`-wrapped with the
narrowest stable deps (field-level like `[d.dayTotals]`, never `[d]`). Rendered
output identical — same rows, same order. Out of scope: `Es`, `Ts` (p19-02),
`Ga`/page.tsx (p19-03), any other component.

### Actions
1. Inventory `Xa`'s derived values; `useMemo`-wrap the unmemoized ones with field-level deps.
2. Tighten any `[d]`-wide dep arrays inside `Xa` to the specific `d.*` fields read.
3. Test: mount `Xa` with fixture data; assert output rows identical and a re-render with an unrelated prop change does not recompute memoized derivations (spy or render-count assertion).

### Done when
- test green; `npx tsc --noEmit` clean
- re-profile (`node scripts/perf-profile.mjs`) shows the initial-render segment improved or a recorded reason it didn't

### Verify
- Run: `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> pass; `npx tsc --noEmit` -> 0 errors

### Handoff
views.tsx free for p19-02 (Es/Ts memoization).
Write results/p19-01.md (<=10 lines); TL alone updates TRACKER.md.

## p19-02: Es/Ts grid tab mount — React.memo heaviest row subcomponent
Kind: mini
ID: p19-02
Parent: S15
Owner: dev
Depends: p19-01
Criteria: PLAN #9 (P-19 fix leaf 2 — grid tab mount ~100 ms)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=7

### Goal
The heaviest per-row subcomponent rendered by `Es`/`Ts` is `React.memo`-extracted so tab mount re-renders less.

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | `Es` (:476-664) and/or `Ts` (:665-end) — pick the single hottest row renderer (record choice + why)
- Edit: `tests/perf/tph-grid-memo.test.tsx` | extend with the memoized subcomponent case

### Context
- `src/features/cx-productivity/components/tph-grid-views.tsx:476-720,789-900` | `Es`, `Ts`, existing `memo` pattern (`TextItem`:73, `TaskItem`:641, `CaseHourRow`:789)
- `docs/PERF_PROFILE.md` | finding 2 (~100 ms commit on `#tph-tab-grid` mount)
- `src/features/cx-productivity/components/tph-grid-matrix.tsx` | matrix subcomponents if they are the actual hot path (choose ONE file region; record decision)

### Contract
ONE row-level subcomponent (the one rendering the most rows in `Es`/`Ts`) becomes
a top-level `const X = memo(function X({...}))` following the existing `TaskItem`
pattern; props kept primitive/stable so memoization actually skips. Output DOM
unchanged. Out of scope: `Xa` (p19-01), page.tsx (p19-03), other files.

### Actions
1. Identify the heaviest repeated row renderer inside `Es`/`Ts` (largest fan-out).
2. Extract/wrap it in `memo` per the existing pattern; keep handlers stable (`useCallback` only if the memo would otherwise always miss).
3. Test: re-render parent with unchanged row props -> memoized child does not re-render (render spy); rows still identical.

### Done when
- test green; `npx tsc --noEmit` clean
- re-profile shows the tab-mount segment improved or recorded reason

### Verify
- Run: `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> pass; `npx tsc --noEmit` -> 0 errors

### Handoff
views.tsx released.
Write results/p19-02.md (<=10 lines); TL alone updates TRACKER.md.

## p19-03: Ga day-step — stable deps so unchanged tabs skip recompute
Kind: mini
ID: p19-03
Parent: S15
Owner: dev
Depends: none
Criteria: PLAN #9 (P-19 fix leaf 3 — day-change refetch ~130-156 ms)
Skills: none
Budget: files=2; actions=3; changed_lines=50; minutes=6

### Goal
Changing the day (`d` identity change) no longer recomputes `Ga`'s derived aggregates that do not depend on the changed fields.

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | `Ga` body (:117-203), incl. the `useMemo` at :142 (`Va(d.table, Ka)` dep `[d]`)
- Edit: `tests/perf/tph-grid-memo.test.tsx` | extend with the `Ga` dep-stability case

### Context
- `src/features/cx-productivity/components/tph-grid-page.tsx:117-203` | `Ga` overview render; `:142` useMemo keyed on `[d]`
- `docs/PERF_PROFILE.md` | finding 3 (~130-156 ms commit on day step)
- `src/features/cx-productivity/components/tph-grid-shared.ts` | `Va`, `Ka` helpers + `TphData` shape

### Contract
`useMemo`/`useCallback` deps inside `Ga` name the specific `d.*` fields consumed
(e.g. `[d.table]` for `Va(d.table, Ka)`), not the whole `d` object — so a refetch
that returns an unchanged `d.table` skips the recompute. If `d` fields are not
referentially stable across refetches, record that and instead split the memo on
a stable primitive key (e.g. the selected date). Rendered output identical.
Out of scope: `Xa`/`Es`/`Ts` (p19-01/02), data fetching itself, Ja/Ya header fns.

### Actions
1. Audit `Ga`'s memo/callback deps; narrow `[d]` to field-level or stable keys per contract.
2. Keep `reload`/`go` handlers behaviour identical.
3. Test: simulate a `d` identity change with identical `d.table` -> memoized derivation is not recomputed; rendered rows identical.

### Done when
- test green; `npx tsc --noEmit` clean
- re-profile shows the day-step segment improved or recorded reason

### Verify
- Run: `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> pass; `npx tsc --noEmit` -> 0 errors

### Handoff
P-19 /tph-grid fixes complete; UX/UI gate runs on the render change set.
Write results/p19-03.md (<=10 lines); TL alone updates TRACKER.md.

## p19-04: /audit-queue seeded re-profile
Kind: mini
ID: p19-04
Parent: S15
Owner: dev
Depends: none
Criteria: PLAN #9 (P-19 — close the unmeasured data path)
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md
Budget: files=2; actions=4; changed_lines=80; minutes=8

### Goal
`/audit-queue` data-state render measured: queue rows actually load in the scripted profile run.

### Files
- Edit: `scripts/perf-profile.mjs` | seed/wait step so the queue payload renders before sampling (reuse existing local seed helpers if present)
- Edit: `docs/PERF_PROFILE.md` | replace the inconclusive section with measured entries + verdict

### Context
- `docs/PERF_PROFILE.md` | the inconclusive /audit-queue section (LoadError/empty seed)
- `e2e/users.ts:10-17,41-70` | seeded admin + login flow
- `scripts/perf-profile.mjs` | the instrumented run to extend
- `specs/perf-pushdown/logs/perf-profile.json` | raw entries format

### Contract
Measurement only — no app source edits. Local-only seeding via existing repo
scripts (no remote writes; if seeding needs a remote write stop with
`NEEDS_USER`). Report format identical to the existing page sections: entries
>50 ms each get a bounded fix-leaf proposal; else record a clean bill for the
data path. Out of scope: /tph-grid (already measured), one-on-ones and
quality-analytics (separate follow-up note only).

### Actions
1. Find how the local e2e/dev DB seeds queue rows (search e2e/, scripts/, package.json seed scripts); seed enough `qa_audits`/queue rows for the admin's desk to populate.
2. Extend the script (or a pre-step) so `/audit-queue` renders `.workitem`/`Seg` rows before sampling; re-run to JSON.
3. Update `docs/PERF_PROFILE.md` /audit-queue section with the measured table + verdict.
4. `node scripts/perf-profile.mjs` exit 0; JSON `audit-queue` entries present (or explicit recorded blocker).

### Done when
- docs/PERF_PROFILE.md /audit-queue section has measured entries or a recorded seeding blocker
- every >50 ms entry names a component/region + bounded fix-leaf proposal, or "no code change"

### Verify
- Run: `node scripts/perf-profile.mjs` -> exit 0; `specs/perf-pushdown/logs/perf-profile.json` `/audit-queue` key has >0 entries (or blocker recorded)

### Handoff
Any new >50 ms findings become further fix leaves filed by the TL.
Write results/p19-04.md (<=10 lines); TL alone updates TRACKER.md.

## p19-05: restore p19-01 Xa memo tests (lost to same-file race)
Kind: mini
ID: p19-05
Parent: S15
Owner: test-engineer
Depends: p19-02
Criteria: regression — p19-01's tests were overwritten by concurrent p19-03 file create
Skills: none
Budget: files=1; actions=3; changed_lines=120; minutes=6

### Goal
`tests/perf/tph-grid-memo.test.tsx` contains a working `Xa` describe block alongside the existing `Ga`/`Es`-era blocks — asserting p19-01's outcome: a re-render with an unrelated prop change does not recompute `Xa`'s memoized derivations.

### Files
- Edit: `tests/perf/tph-grid-memo.test.tsx` | append an `Xa` describe block (do not touch existing blocks)

### Context
- `specs/perf-pushdown/results/p19-01.md` | what the lost tests asserted (memoize derived rows in `Xa`, tph-grid-views.tsx:193-475)
- `tests/perf/tph-grid-memo.test.tsx` | existing React-stub harness (mock `useMemo`/render spy pattern) — REUSE its stub approach
- `src/features/cx-productivity/components/tph-grid-views.tsx:193-475` | `Xa` (deps already narrowed by p19-01)

### Contract
Test-only change. Append one `describe('Xa memo deps', ...)` block covering: (a)
the narrowed-dep memos do not recompute when `d` identity changes but the dep
fields are unchanged; (b) they DO recompute when a dep field changes; (c) output
rows identical. Reuse the file's existing stub-React harness — do not introduce
a second stubbing mechanism. Out of scope: app source edits, removing/altering
existing describe blocks.

### Actions
1. Read the existing harness + `Xa`'s deps; write the appended describe block per contract.
2. `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> all blocks green.
3. `npx tsc --noEmit` clean.

### Done when
- all describe blocks in the file pass (Xa restored + existing Ga/Es blocks)
- file contains >=3 describe blocks covering Xa, Ga, and any p19-02 block

### Verify
- Run: `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> all pass

### Handoff
P-19 test coverage complete.
Write results/p19-05.md (<=10 lines); TL alone updates TRACKER.md.

## p19-06: post-fix re-profile of /tph-grid and /audit-queue
Kind: mini
ID: p19-06
Parent: S15
Owner: dev
Depends: pk-apply-01
Criteria: PLAN #9 (verify each >50 ms finding improved; close /audit-queue data path)
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md
Budget: files=2; actions=4; changed_lines=80; minutes=8

### Goal
Re-run `node scripts/perf-profile.mjs` after p19-01..03 and pk-drift fixes; each original >50 ms /tph-grid region is re-measured and /audit-queue now has data-state entries (or a recorded blocker).

### Files
- Edit: `scripts/perf-profile.mjs` | only if a wait/seed tweak is still needed for the queue payload to render
- Edit: `docs/PERF_PROFILE.md` | append a post-fix section: before/after per region + verdicts

### Context
- `docs/PERF_PROFILE.md` | original findings: ~250 ms initial render, ~100 ms grid mount, ~130-156 ms day step; /audit-queue inconclusive (qa_queue.id drift — now fixed via queue_id override + pk-apply-01)
- `scripts/perf-profile.mjs` | instrumented run; writes specs/perf-pushdown/logs/perf-profile.json
- `results/p19-04.md` | prior audit-queue blocker evidence

### Contract
Measurement only — no app source edits, no remote writes (stop with
`NEEDS_USER` if seeding requires one). Report format identical to existing
sections; any still->50 ms region gets a bounded fix-leaf proposal or a
recorded reason. Dev-build timings inflate — compare against the same script's
prior numbers, not absolute budgets.

### Actions
1. `node scripts/perf-profile.mjs` -> exit 0; collect JSON.
2. Compare /tph-grid segments against pre-fix numbers; record improved/not + ms.
3. Verify /audit-queue entries now come from rendered data (queue rows present), else record the remaining blocker verbatim.
4. Update `docs/PERF_PROFILE.md` post-fix section.

### Done when
- post-fix section exists with per-region before/after verdicts
- every remaining >50 ms entry names a component/region + fix proposal or "no code change"

### Verify
- Run: `node scripts/perf-profile.mjs` -> exit 0; JSON has both page keys

### Handoff
Remaining >50 ms findings become TL-filed fix leaves; else S15 closes.
Write results/p19-06.md (<=10 lines); TL alone updates TRACKER.md.

## p19-07: AuditQueuePage data-state render — memoize heaviest regions
Kind: mini
ID: p19-07
Parent: S15
Owner: dev
Depends: p19-06
Criteria: PLAN #9 (measured /audit-queue payload commit LoAF ~266-292 ms >50 ms)
Skills: none
Budget: files=2; actions=3; changed_lines=80; minutes=7

### Goal
The render commit that fires when `getQaQueuePage` payload arrives is reduced: derived lists/coverage aggregates in `AuditQueuePage` are `useMemo`-wrapped with field-level deps and/or the heaviest row renderer is `memo`-extracted — DOM output identical.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | data-state render body — inventory derived values, memoize hottest
- Create: `tests/perf/audit-queue-memo.test.tsx` | render-count / memo parity test (reuse tph-grid-memo.test.tsx stub harness pattern)

### Context
- `docs/PERF_PROFILE.md` post-fix /audit-queue section | LoAF ~266-292 ms on payload render (dev-build inflated)
- `tests/perf/tph-grid-memo.test.tsx` | existing stub-React harness — REUSE its pattern, do not introduce a second mechanism
- `src/features/cx-productivity/components/tph-grid-views.tsx` | `memo`/`useMemo` precedent (TextItem/TaskItem pattern)
- Payload shape: `rows[213]`, `requests[0]`, `passed[300]`, `quota[39]`, `auditors[6]`

### Contract
Memoize the widest-fan-out derivations (coverage aggregates, per-row mapped
lists) with narrowest stable deps; `memo`-extract ONE row-level subcomponent
if one renders the 213-row list. Rendered DOM identical — same rows, same
order. No new deps, no data-fetch changes, no behaviour changes. Out of
scope: other quality pages, the perf-profile.mjs `entries` slice quirk.

### Actions
1. Inventory `AuditQueuePage`'s unmemoized derived values + row renderers; pick the heaviest.
2. Apply `useMemo`/`memo` per contract; keep handler identities stable.
3. Test: mount with a 200+ row fixture; assert identical rendered rows and that an unrelated prop change does not recompute memoized derivations.

### Done when
- new test green; `npx tsc --noEmit` clean; `npx eslint` on touched files 0 errors
- `node scripts/perf-profile.mjs` re-run recorded in results (improved or recorded reason)

### Verify
- Run: `npx vitest run tests/perf/audit-queue-memo.test.tsx` -> pass; `npx tsc --noEmit` -> 0 errors

### Handoff
S15 render-fix scope complete.
Write results/p19-07.md (<=10 lines); TL alone updates TRACKER.md.
