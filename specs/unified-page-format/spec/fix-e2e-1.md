# fix-e2e-1: page-frame.spec.ts findings (S08-01 evidence)
Kind: fix-batch
Source: results/S08-01.md — `npx playwright test e2e/page-frame.spec.ts` exit=1 on real production findings.

## e1-01: `/` (my-day) drops the lone `kicker` so h1.top matches all routes
Kind: mini
ID: e1-01
Parent: fix-e2e-1
Owner: dev
Depends: none
Criteria: PLAN #3 (identical head coordinates)
Skills: none
Budget: files=1; actions=4; changed_lines=20; minutes=5

### Goal
`/` is the only route rendering `.kicker`, pushing h1.top to 139.6/146 vs the uniform 105.6/112 on the other 36 routes (−34 px). Remove the kicker so head geometry is identical.

### Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | remove `kicker={w ? Hm(w.today) : undefined}` (~line 1046); relocate the date into the existing `status` slot content (or drop it) — dev's choice, no new markup outside slots

### Context
- `src/app/page.tsx` | `/` renders `MyDayPage` in place — this prop is why only `/` deviates
- `src/features/shared/components/ui/PageShell.tsx:55` | `{kicker ? <p className="kicker">` — the only kicker renderer; keep the prop/slot itself
- `results/S08-01.md` | measured delta

### Contract
After the change `/` and `/my-day` render no `.kicker` (only `/` was flagged, but it is the same component/prop, so fix both identically). Do NOT remove the `kicker` prop from PageShell/Vf/shared wrappers — only the my-day usage. Do NOT add a per-page CSS offset.

### Actions
1. Read my-day-page.tsx around 1046; confirm kicker is the only frame deviator.
2. Remove the kicker prop; move `Hm(w.today)` into `status` content if trivially safe, else drop it.
3. `npx tsc --noEmit` exit 0; `npx eslint src/features/cx-hub/components/my-day-page.tsx` clean.
4. Re-run the spec's geometry test filtered and record whether the h1.top finding on `/` clears.

### Done when
- No `.kicker` rendered on `/` (and `/my-day`); h1.top within ±2 px of the fleet at both widths.
- tsc + scoped eslint clean.

### Verify
- Run: `npx playwright test e2e/page-frame.spec.ts --project=chromium` — the kicker/h1.top failure gone (e1-02/e1-03 findings may persist).

### Handoff
Write results/e1-01.md (<=10 lines); TL alone updates TRACKER.md.

## e1-02: `.page-actions` right edge == `.page-head` right edge on 6 routes
Kind: mini
ID: e1-02
Parent: fix-e2e-1
Owner: dev
Depends: none
Criteria: PLAN #3 (identical head coordinates)
Skills: none
Budget: files=7; actions=5; changed_lines=120; minutes=10

### Goal
`.page-actions` right edge is off `.page-head` right edge by 384–491 px on /agents, /heatmap, /overview, /quality-analytics, /queue, /scheduler — the actions content wraps or is not pinned to the head row end. Find the shared root cause and fix it.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | actions slot content only
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | actions slot content only
- Edit: `src/features/cx-queue/components/queue-page.tsx` | actions slot content only
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | actions slot content only
- Edit: `src/features/cx-hub/components/overview-page.tsx` | actions slot content only
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | actions slot content only
- Edit: `src/features/cx-queue/components/shared.tsx` | Head actions-slot rule ONLY if the root cause is shared; else leave untouched

### Context
- `results/S08-01.md` | exact deltas (384–491 px) and route list
- `docs/PAGE-FRAME.md` | slot DOM contract — `.page-actions` must end at `.page-head` right edge
- `src/features/shared/components/ui/PageShell.tsx` | `.page-head`/`.page-actions` base layout

### Contract
Diagnose first: likely one shared pattern across the six (e.g. actions child wider than the row forcing wrap, or actions markup placed outside the slot). Fix at the root — prefer a shared-head fix or per-page actions content that fits the slot; do NOT add bespoke page-head CSS (that is what S09 removed). If the six turn out to be independent root causes needing >10 files/actions, stop at a checkpoint and return RESHARD_NEEDED listing per-route causes.

### Actions
1. Reproduce: measure `.page-actions` vs `.page-head` right edges on /queue at 1024 (playwright evaluate or devtools).
2. Diff a failing page's actions markup vs a passing page (e.g. /aging) to isolate the pattern.
3. Apply the minimal fix across the six routes.
4. `npx tsc --noEmit`; scoped eslint on edited files.
5. Re-run the spec — record the six routes now within ±2 px.

### Done when
- `.page-actions` right edge == `.page-head` right edge ±2 px on all six routes at 1024 and 1440.
- No new bespoke head CSS introduced; tsc + scoped eslint clean.

### Verify
- Run: `npx playwright test e2e/page-frame.spec.ts --project=chromium` — the six actions-edge failures gone.

### Handoff
Write results/e1-02.md (<=10 lines); TL alone updates TRACKER.md.

## e1-03: `/ctls` has no horizontal scroll at 375 px
Kind: mini
ID: e1-03
Parent: fix-e2e-1
Owner: dev
Depends: none
Criteria: PLAN #3 (375 px no h-scroll, stack order)
Skills: none
Budget: files=2; actions=5; changed_lines=40; minutes=6

### Goal
`/ctls` overflows the viewport by 328 px at 375 px width — the only route failing the no-h-scroll assertion. Fix the overflowing element in page code/styles.

### Files
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | the overflowing structure (`qa-ctls-layout`/`qa-ctlside` region)
- Edit: `src/app/styles/quality.css` | the ctls rule producing fixed width — only if the fix is a rule change

### Context
- `results/S08-01.md` | 328 px h-scroll @375 on /ctls only
- `e2e/page-contract.spec.ts` | `hScrollPx` convention — `scrollWidth - innerWidth <= 0`
- `src/features/cx-quality/components/qa-shared.tsx` | QaPage wrapper used by ctls

### Contract
Find the element producing 328 px overflow (likely a fixed-width table/filters row without wrap/scroll) and make it fit: min-width removal, `overflow-x:auto` on a bounded container, or `flex-wrap` — matching how other QA pages handle narrow widths. Do NOT hide content or set `overflow-x:hidden` on `.main`/body (that masks rather than fixes). If the overflow comes from a shared QA component used by passing pages, return RESHARD_NEEDED instead of touching it.

### Actions
1. Reproduce at 375 px; identify the offending element via `page.evaluate` bounding boxes.
2. Apply the minimal containment fix in the page file or its scoped quality.css rule.
3. Re-measure h-scroll = 0 at 375 px; confirm no regression at 1024/1440.
4. `npx tsc --noEmit`; scoped eslint on edited files.
5. Re-run the spec's 375 px test — /ctls passes.

### Done when
- `/ctls` `scrollWidth - innerWidth <= 0` at 375 px; desktop widths unchanged.

### Verify
- Run: `npx playwright test e2e/page-frame.spec.ts --project=chromium` — /ctls no longer listed in the 375 px failures.

### Handoff
Write results/e1-03.md (<=10 lines); TL alone updates TRACKER.md.

## e1-04: `margin-inline-start:auto` on `:root .page-actions` (refresh.css) — implements e1-02 diagnosis
Kind: mini
ID: e1-04
Parent: fix-e2e-1
Owner: dev
Depends: e1-02 diagnosis (results/e1-02.md)
Criteria: PLAN #3 (identical head coordinates)
Skills: none
Budget: files=1; actions=4; changed_lines=5; minutes=5

### Goal
`.page-head` is `display:flex;flex-wrap:wrap;justify-content:space-between`; a `.page-actions` that wraps to its own flex line aligns flex-start instead of row-end (off 384–491 px on /agents /heatmap /overview /quality-analytics /queue /scheduler). Pin it right with one declaration.

### Files
- Edit: `src/app/refresh.css` | `:root .page-actions` rule (~line 26) — add `margin-inline-start:auto` inside the existing declaration block; no other rule changes

### Context
- `results/e1-02.md` | full measured diagnosis (deltas, flex layout) — the agreed root fix
- `src/app/refresh.css:21-26` | `.page-head` flex rule and the `.page-actions` rule to amend
- `e2e/page-frame.spec.ts` | the geometry spec that verifies the fix

### Contract
Add exactly `margin-inline-start:auto` to the existing `:root .page-actions` block (keeps space-between behaviour when it shares the title line; pins right when wrapped). No new selectors, no per-page overrides, no other refresh.css edits.

### Actions
1. Read refresh.css `.page-actions` rule; add the declaration.
2. `npx tsc --noEmit` (CSS-only, baseline gate).
3. Run `npx playwright test e2e/page-frame.spec.ts --project=chromium` — the six routes now within ±2 px at 1024 and 1440 (e1-01/e1-03 findings may still fail).
4. Confirm no non-listed route regressed (spec asserts cross-page equality, so a regression shows as a new delta).

### Done when
- All six flagged routes: `.page-actions` right edge == `.page-head` right edge ±2 px at both widths.
- No new geometry failures introduced; tsc exit 0.

### Verify
- Run: `npx playwright test e2e/page-frame.spec.ts --project=chromium` — actions-edge failures for the six routes gone.

### Handoff
Write results/e1-04.md (<=10 lines); TL alone updates TRACKER.md.

## e1-05: retarget `css-form-guards` SITES entry off deleted `.aging-page-head`
Kind: mini
ID: e1-05
Parent: fix-e2e-1
Owner: dev
Depends: S09-01 (deleted `.aging-page-head`), e1-04
Criteria: vitest green (regression caused by S09-01's intentional deletion)
Skills: none
Budget: files=2; actions=4; changed_lines=15; minutes=5

### Goal
`npx vitest run` fails 1 test: `tests/css-form-guards.test.ts` SITES entry `.aging-page-head .page-actions` (queue search+refresh row) — the selector was deleted by S09-01. Retarget the guard to the unified `.page-actions` so the queue actions-row controls stay shrink-guarded.

### Files
- Edit: `tests/css-form-guards.test.ts` | SITES entry ~line 117: `sel: '.aging-page-head .page-actions'` -> `sel: '.page-actions'` (keep refresh.css file + where note updated to 'unified page-actions row')
- Edit: `src/app/refresh.css` | `:root .page-actions` block (~lines 25-30) — add the scoped control guard `min-inline-size:0` on `:is(input:not([type=checkbox]):not([type=radio]),select,textarea)` ONLY if `siteOk` fails for `.page-actions` after retarget

### Context
- `tests/css-form-guards.test.ts:107-117` | `siteOk` passes via `hasControlGuard` OR all `gridDecls` tracks bounded
- `src/app/refresh.css:25-30` | current `.page-actions` rule (e1-04 added `margin-inline-start:auto`)
- Deleted `.aging-page-head .page-actions :is(input...)` guard | was the only shrink guard for the queue actions row — moving it to `.page-actions` guards every frame page

### Contract
Preserve the guard's intent (controls inside their track) on the unified slot class, not a page-specific selector. Do NOT resurrect `.aging-page-head`. If the retargeted entry passes via existing rules, the refresh.css edit is skipped — report which branch was taken. No other test entries touched.

### Actions
1. Retarget the SITES entry to `.page-actions`.
2. `npx vitest run tests/css-form-guards.test.ts` — if the entry fails, add the control guard to `:root .page-actions` and re-run.
3. `npx vitest run tests/css-form-guards.test.ts` exit 0; `npx tsc --noEmit` exit 0.
4. `npx playwright test e2e/page-frame.spec.ts --project=chromium -g "1024"` on /queue (or the full spec if quick) — confirm the added guard didn't shift actions geometry.

### Done when
- `css-form-guards.test.ts` green with the guard on `.page-actions`; no `.aging-page-head` reference remains; tsc + frame geometry still pass.

### Verify
- Run: `npx vitest run tests/css-form-guards.test.ts` -> all pass.

### Handoff
Write results/e1-05.md (<=10 lines); TL alone updates TRACKER.md.
