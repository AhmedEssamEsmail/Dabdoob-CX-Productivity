# fix-qa-1: page-contract.spec.ts findings (reports/qa-1.md)
Kind: fix-batch
Source: reports/qa-1.md — `npx playwright test e2e/page-contract.spec.ts --project=chromium` 12 fails on 6 routes (qa-1 HIGH, qa-2 HIGH) + LOW nits qa-3/qa-4. qa-5 deferred (accepted trade-off — PM decision needed if the `/` date eyebrow must return).

## qa1-01: stable label-swap primaries on /meetings + /tl-tasks (toolbar stability)
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: reports/qa-1.md qa-1 (toolbar stability must hold when a safe primary toggles label)
Skills: none
Budget: files=2; actions=4; changed_lines=20; minutes=6

### Goal
`/meetings` (+52.8px) and `/tl-tasks` (+8.3px) fail the toolbar-stability contract: the `.page-actions` box is content-sized and right-pinned, so when the primary button's label swaps ("Set up a meeting series"→"Close the form"; "Assign/Add a task"→"Close the form") the box x shifts. Both clicks are safe (form open/close only, no POST) so keep contract coverage: pin the button width instead of skipping the route.

### Files
- Edit: `src/features/cx-people/components/meetings-page.tsx` | the `actions=` primary Button (~line 815-821) only
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | the `actions=` primary Button (~line 919-927) only

### Context
- `reports/qa-1.md` qa-1 row | measured deltas (+52.8px meetings, +8.3px tl-tasks) and the two sanctioned fix options
- `src/app/refresh.css:25-29` | `.page-actions` rule — content-sized, right-pinned via `margin-inline-start:auto` (e1-04)
- `e2e/page-contract.spec.ts:124-151` | the ±1px box-stability assertion

### Contract
Give each toggle primary a fixed `min-inline-size` that fits its LONGEST label at both states (compute from the longer string, e.g. "Set up a meeting series" / "Close the form"), using an inline style or an existing utility — no new page-head CSS, no `.page-actions` changes. Do NOT touch `e2e/routes.ts` (these routes keep full contract coverage) and do NOT touch the Button component or any other page. If a stable width cannot hold the box to ±1px, stop and report `RESHARD_NEEDED` with the measured residual delta.

### Actions
1. Add `min-inline-size` sized for the longest label to the meetings primary Button.
2. Same for the tl-tasks primary Button (longest of "Assign a task"/"Add a task"/"Close the form").
3. `npx tsc --noEmit` exit 0; scoped `npx eslint` on both files clean.
4. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "meetings|tl-tasks"` — box x/y within ±1px after click at both widths.

### Done when
- /meetings and /tl-tasks contract cases pass the toolbar-stability assertion at 375 and 1024.
- tsc + scoped eslint clean; no route added to QUIRKS.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "meetings|tl-tasks"` — 4 cases pass.

### Handoff
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-02: QUIRKS.skipToolbar for routes whose primary click must never fire (`/`, /audit-queue, /people-holidays, /qa-forms)
Kind: mini
ID: qa1-02
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: reports/qa-1.md qa-1 + qa-2 (console-500 on `/`)
Skills: none
Budget: files=1; actions=4; changed_lines=40; minutes=5

### Goal
Four routes fail page-contract because the spec clicks a primary the contract must never click — same class as the existing `/my-day` and `/kb-tracker` precedents. Register all four in `QUIRKS` with accurate notes.

### Files
- Edit: `e2e/routes.ts` | `QUIRKS` map (~lines 45-60) — add four entries with comments+notes matching the existing style; no other edits

### Context
- `reports/qa-1.md` qa-1/qa-2 rows | qa-2's console-500 on `/` reproduced in 2 runs at both widths
- `src/app/page.tsx` | `/` renders `MyDayPage` in place — same primary as `/my-day` ("Book focus block")
- `src/app/api/hub/my-day/route.ts:30-55` | `POST {action:focusBlock}` → `createFocusBlock` writes a real Google Calendar event; `specs/e2e-contract-green` documents it 500s on re-book — this pre-existing mutating API is the `/` console-500 source, surfaced only because migration gave `/` a `.page-head .page-actions` the spec now clicks
- `src/features/cx-quality/components/audit-queue-page.tsx:317-337` + `src/features/cx-hub/components/people-holidays-page.tsx:350-354` | primaries fire mutating POSTs (importNow / HCT sync), labels swap to "Importing…"/"Syncing…"
- `src/features/cx-quality/components/qa-forms-page.tsx:364-379` | `actions={n && !i ? … : undefined}` — clicking "New form" sets the editing state and unmounts `.page-actions` entirely (exact /kb-tracker precedent)

### Contract
Add `skipToolbar: true` + a one-line `note` (mirroring existing entries) for `/`, `/audit-queue`, `/people-holidays`, `/qa-forms`. The `/` note must say it renders MyDayPage whose primary books a real calendar event via mutating POST /api/hub/my-day. Do NOT change app code, the spec file, or CONSOLE_ALLOWLIST — the 500 is the real mutating endpoint responding to a click that must not happen; skipping the click resolves it. Do NOT add /meetings or /tl-tasks (qa1-01 keeps their coverage).

### Actions
1. Add the four QUIRKS entries with notes (match existing comment style).
2. `npx tsc --noEmit` exit 0; `npx eslint e2e/routes.ts` clean.
3. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "audit-queue|people-holidays|qa-forms"` — toolbar assertion now skipped with annotation; h-scroll/console/names still pass.
4. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "^/ contract"` — `/` passes both widths with zero console errors (proves the click, not a load-time resource, caused the 500). If a 500 persists on `/` after the click is skipped, STOP and report the resource URL in results — that is a different bug.

### Done when
- The four routes skip the click with a recorded annotation; `/` console-500 is gone at both widths.
- No app-code edits; tsc + scoped eslint clean.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "^/ |audit-queue|people-holidays|qa-forms"` — all pass (toolbar-skip annotations on the four).

### Handoff
Write results/qa1-02.md (<=10 lines) including whether the `/` 500 cleared once the click was skipped; TL alone updates TRACKER.md.

## qa1-03: delete dead `.hm-head-actions` and `.sch-controls` rules (qa-3)
Kind: mini
ID: qa1-03
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: reports/qa-1.md qa-3 (LOW)
Skills: none
Budget: files=1; actions=3; changed_lines=4; minutes=3

### Goal
S09-01 removed the last TSX refs but two dead rules survived in queue.css — delete them.

### Files
- Edit: `src/app/styles/queue.css` | line ~17 `[data-app="queue"] .hm-head-actions {…}` and line ~152 `[data-app="queue"] .sch-controls {…}` — delete those two rules only

### Context
- `reports/qa-1.md` qa-3 row | zero TSX refs remain after migration
- Sibling rules `.hm-head`, `.hm-source`, `.sch-head`, `.sch-month` still have refs — keep them

### Contract
Delete exactly the two named rules. Verify with `grep -rn "hm-head-actions\|sch-controls" src/ --include=*.tsx` that no TSX ref exists before deleting; if a ref appears, keep that rule and report it.

### Actions
1. Confirm zero TSX refs to both classes.
2. Delete the two rules.
3. `npx vitest run tests/css-form-guards.test.ts` exit 0 (guard suite references queue.css selectors).

### Done when
- Both rules gone; no TSX refs broken; css-form-guards green.

### Verify
- Run: `npx vitest run tests/css-form-guards.test.ts` → all pass; `grep -c "hm-head-actions\|sch-controls" src/app/styles/queue.css` → 0.

### Handoff
Write results/qa1-03.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-04: reduced-motion guard covers every `.spinner`, not only `.page-loading` (qa-4)
Kind: mini
ID: qa1-04
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: reports/qa-1.md qa-4 (LOW)
Skills: none
Budget: files=1; actions=3; changed_lines=8; minutes=4

### Goal
The reduced-motion stop is scoped to `.page-loading .spinner`, so a standalone `<Spinner>` would still spin under `prefers-reduced-motion`/`data-reduce-motion`, contrary to the contract wording. Rescope the guard to `.spinner` itself.

### Files
- Edit: `src/app/refresh.css` | the reduced-motion block ~lines 593-597 — change selectors from `.page-loading .spinner` to `.spinner`; no other rule changes

### Context
- `reports/qa-1.md` qa-4 row | sole consumer today is `loading.tsx`, but the contract says "Spinner … respects" reduced motion
- `src/features/shared/components/ui/Spinner.tsx` | renders `.spinner` with role=status
- `e2e/nav-no-splash.spec.ts` | covers the loading path — must stay green

### Contract
Replace both scoped selectors so the guard reads `:root .spinner` (inside the media query) and `:root[data-reduce-motion] .spinner` — keep the existing structure/comments, no new rules, no markup changes.

### Actions
1. Update the two selectors.
2. `npx tsc --noEmit` exit 0 (CSS-only baseline gate).
3. `npx playwright test e2e/nav-no-splash.spec.ts --project=chromium` exit 0.

### Done when
- `.spinner` stops under reduced motion regardless of container; nav-no-splash green; tsc exit 0.

### Verify
- Run: `npx playwright test e2e/nav-no-splash.spec.ts --project=chromium` → pass.

### Handoff
Write results/qa1-04.md (<=10 lines); TL alone updates TRACKER.md.
