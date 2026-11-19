# fix-ux-1: ux review findings (reports/ux-1.md)
Kind: fix-batch
Source: reports/ux-1.md — ux-1 MED (Home stats slot keeps a manual `.grid grid-4 mb-3` wrapper, breaks the one-grid contract + ~3rem stats→body gap) + cheap LOWs ux-2 (inline minInlineSize magic values) / ux-3 (`.page-loading` animation ungated by reduced-motion). ux-4 LOW (`BootSplash` img missing `alt=""`) deferred per PM scope.

## ux1-01: drop the manual grid wrapper inside Home's `stats` slot (ux-1)
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: reports/ux-1.md ux-1; PLAN #2 (stats row = one grid via `.page-stats`)
Skills: none
Budget: files=1; actions=3; changed_lines=8; minutes=4

### Goal
`overview-page.tsx` passes its four `.stat` cards to PageShell's `stats` slot wrapped in `<div className="grid grid-4 mb-3">`. `.page-stats` is already `display:grid` (`auto-fit minmax(11rem,1fr)`), so the wrapper replaces the contract grid with `.grid-4` media steps (4→2 @821-1180px→1) and adds ~1.5rem `mb-3` inside the slot — Home's KPI row wraps 2×2 and sits ~3rem above body while every sibling page is one auto-fit row with a 1.5rem gap. Remove the wrapper so `.page-stats` governs.

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | `stats=` prop ~lines 456-493 only — unwrap, nothing else

### Context
- `reports/ux-1.md` ux-1 row | measured consequences (2×2 wrap inside the 1024 band; ~3rem stats→body gap vs 1.5rem)
- `src/app/refresh.css:47-49` | `.page-stats` — the contract grid that must govern the slot
- `src/app/refresh.css:175-183` | `.grid-4` media steps — the behaviour being removed from this slot
- `docs/PAGE-FRAME.md:61` + `:92` | contract recipe: "keep the `.stat` markup verbatim, drop the manual grid wrapper"

### Contract
`stats` children = the four existing `.stat` divs verbatim (`.stat`, `data-tone`, `stat-l`/`stat-v num`/`stat-d` untouched) inside a JSX fragment `<>…</>` — no `.grid`, `grid-4`, `mb-3` or any classed wrapper in the slot. Do NOT touch the `.grid-4`/`.grid` CSS rules (body content on other pages still uses them), any other prop, or any other file. If the diff shows anything beyond the wrapper removal, it is out of scope.

### Actions
1. Replace `<div className="grid grid-4 mb-3">`…`</div>` with `<>`…`</>`; fix indentation; keep `.stat` markup byte-identical.
2. `npx tsc --noEmit` exit 0; `npx eslint src/features/cx-hub/components/overview-page.tsx` clean.
3. `grep -c "grid grid-4\|mb-3" src/features/cx-hub/components/overview-page.tsx` → 0 in the stats prop.

### Done when
- The four `.stat` divs are direct `stats` children under `.page-stats`; no wrapper classes remain in the prop.
- tsc exit 0 + scoped eslint clean.

### Verify
- Run: `npx tsc --noEmit` → exit 0; `grep -n "grid grid-4\|mb-3" src/features/cx-hub/components/overview-page.tsx` → no hits.

### Handoff
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-02: pin meetings/tl-tasks primaries via refresh.css classes, not inline style (ux-2)
Kind: mini
ID: ux1-02
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: reports/ux-1.md ux-2; PLAN Conventions ("no hardcoded px/colours", token/rule convention)
Skills: none
Budget: files=3; actions=5; changed_lines=14; minutes=6

### Goal
qa1-01 pinned the two label-swap primaries with inline `style={{ minInlineSize: '14rem' | '10rem' }}` — magic lengths in TSX, against the convention used by `.roster-add-btn`. Move both widths into named `.page-actions` rules in refresh.css (same values, same effect on the actions-box pin) and swap the inline styles for classNames.

### Files
- Edit: `src/app/refresh.css` | add two rules directly after line 31 (`.roster-add-btn` precedent) — no other CSS edits
- Edit: `src/features/cx-people/components/meetings-page.tsx` | `actions=` Button ~lines 817-823 only
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | `actions=` Button ~lines 921-928 only

### Context
- `reports/ux-1.md` ux-2 row | reviewer-sanctioned fix = shared class in refresh.css (primary option chosen here)
- `src/app/refresh.css:25-31` | `.page-actions` block + `.roster-add-btn` naming/scoping precedent
- `src/features/cx-hub/components/admin-roster-page.tsx:96` | `className="roster-add-btn"` usage precedent
- `src/features/shared/components/ui/Button.tsx:8-27` | Button forwards `className` via `cx(...)`
- `spec/fix-qa-1.md#qa1-01` + `reports/qa-1.md` qa-1 | why the pins exist — 14rem/10rem fit the longest labels ("Set up a meeting series" / "Close the form", "Assign a task" / "Add a task" / "Close the form"); values must stay identical or the box shifts again

### Contract
Add `:root .page-actions .meetings-form-btn { min-inline-size: 14rem; }` and `:root .page-actions .tl-task-form-btn { min-inline-size: 10rem; }` next to `.roster-add-btn`; on each Button replace `style={{ minInlineSize: '…' }}` with the matching `className="…"`. Values byte-identical (14rem / 10rem). Do NOT touch the Button component, `e2e/routes.ts` QUIRKS, any other CSS rule, or any other file. This leaf edits refresh.css; ux1-03 edits it too — TL serialises, do not touch the reduced-motion block (~lines 593-597).

### Actions
1. Add the two `:root .page-actions .…-btn` rules after line 31.
2. meetings-page.tsx: drop `style`, add `className="meetings-form-btn"`.
3. tl-tasks-page.tsx: drop `style`, add `className="tl-task-form-btn"`.
4. `npx tsc --noEmit` exit 0; `npx eslint` on both tsx files clean.
5. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "meetings|tl-tasks"` → toolbar stability ±1px holds at both widths (proves the pin moved, not vanished).

### Done when
- No `minInlineSize` inline style remains on either primary; both pinned via the new classes.
- Contract toolbar-stability cases for both routes still pass; tsc + scoped eslint clean.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "meetings|tl-tasks"` → pass; `grep -rn "minInlineSize" src/features/cx-people/components/meetings-page.tsx src/features/cx-people/components/tl-tasks-page.tsx` → no hits.

### Handoff
Write results/ux1-02.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-03: gate `.page-loading` reveal animation under reduced-motion (ux-3)
Kind: mini
ID: ux1-03
Parent: fix-ux-1
Owner: dev
Depends: ux1-02
Criteria: reports/ux-1.md ux-3; PLAN #6 (loading cue respects `prefers-reduced-motion` and `data-reduce-motion`)
Skills: none
Budget: files=1; actions=3; changed_lines=6; minutes=4

### Goal
`.page-loading` runs `animation: page-loading-in .15s ease .15s backwards` unconditionally — the reduced-motion block only stops `.spinner`, so reduced-motion users still get the delayed opacity fade of the container. Extend the existing guards to the container, per the reviewer's exact fix.

### Files
- Edit: `src/app/refresh.css` | reduced-motion block + standalone rule ~lines 593-597 only — no other edits

### Context
- `reports/ux-1.md` ux-3 row | exact fix prescribed: media-query + `data-reduce-motion` rules for `.page-loading`
- `src/app/refresh.css:584-597` | current `.page-loading` rule + existing `.spinner` guards (`:root .spinner` inside `@media (prefers-reduced-motion:reduce)`, `:root[data-reduce-motion] .spinner` standalone)
- `src/app/loading.tsx` (root) | sole consumer renders `.page-loading` + `Spinner`
- `e2e/nav-no-splash.spec.ts` | covers the loading path — must stay green

### Contract
Add `:root .page-loading` inside the existing `@media (prefers-reduced-motion: reduce)` block and a standalone `:root[data-reduce-motion] .page-loading { animation: none; }` beside the existing standalone spinner rule — mirror the `.spinner` pattern exactly (same selectors structure, `animation: none`). Keep every existing rule verbatim; no markup changes; no other CSS edits.

### Actions
1. Extend the media block with `:root .page-loading` and add the standalone `data-reduce-motion` rule.
2. `npx tsc --noEmit` exit 0 (CSS-only baseline gate).
3. `npx playwright test e2e/nav-no-splash.spec.ts --project=chromium` exit 0.

### Done when
- `.page-loading` computes `animation: none` under both `prefers-reduced-motion` and `data-reduce-motion`; nav-no-splash green; tsc exit 0.

### Verify
- Run: `npx playwright test e2e/nav-no-splash.spec.ts --project=chromium` → pass; `grep -n "page-loading" src/app/refresh.css` shows both new guards.

### Handoff
Write results/ux1-03.md (<=10 lines); TL alone updates TRACKER.md.
