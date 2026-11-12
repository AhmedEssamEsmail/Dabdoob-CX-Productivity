# fix-dbg-1 — ui-shell-polish debug-1 findings (8 leaves)

Source report: `specs/ui-shell-polish/reports/debug-1.md`. Regression spec:
`e2e/ui-shell-polish.spec.ts` (failing; each leaf runs only its `-g` test).
Dev server assumed at http://localhost:3000. Playwright may resolve outside repo
deps — if `npx playwright` is unavailable, note it in results and use the
fallback checks listed in the leaf.

## dbg1-08: Unblock /api/qa/* — dev-server route crash returns 500 HTML
Kind: mini
ID: dbg1-08
Parent: fix-dbg-1
Owner: dev
Depends: none
Criteria: PLAN #1/#2 enabler (blocks their live verification)
Skills: none
Budget: files=2; actions=4; changed_lines=60; minutes=10

### Goal
Every `/api/qa/<action>` request returns a JSON response (any status) instead of
the 500 HTML "Jest worker encountered 2 child process exceptions" page.

### Files
- Edit: `src/app/api/qa/[action]/route.ts` | dispatcher/module-load fix if the crash is in this entry
- Edit: `src/features/cx-quality/lib/server.ts` | import-graph fix (e.g. lazy/heavy import) if the crash is in this barrel

### Context
- `src/app/api/qa/[action]/route.ts:1-3` | static `import * as qa from server` — worker dies before handler runs (apiError JSON never reached)
- `src/features/cx-quality/lib/server.ts:15-27` | heavy import graph: repo, notify, `jobs/sheets` (googleapis), `cx-queue/lib` barrel
- `specs/ui-shell-polish/reports/debug-1.md` dbg-8 row | `/api/bootstrap` imports the same barrel and works — crash is specific to this route entry
- `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | known dev prerender crash note — possibly related

### Contract
Fix the module-load/worker crash, not handler behaviour. If a restart + `.next`
cache clear cures it (transient Turbopack death), make no code edits and say so.
If the real fault is in a file outside Files, stop and return RESHARD_NEEDED
with the captured stack. Never edit `.env*`, manifests, or HANDLERS semantics.
Out of scope: handler logic, other routes, vitest/jest config.

### Actions
1. Reproduce: `curl -s -X POST http://localhost:3000/api/qa/getQaAccess -H "content-type: application/json" -d "{\"args\":[]}"`; capture the dev-server console/stderr stack for the real exception.
2. Stop `next dev`, remove `.next` cache, restart, re-curl — if 500 persists continue, else record transient and skip to 4.
3. Isolate the dying import (bisect the HANDLERS entry/`server` barrel imports, e.g. lazy `await import` inside `run()`); apply the minimal code fix in the listed Files only.
4. Re-curl `getQaAccess` plus one handler that hits the DB (`getQaScoresPage`) — confirm JSON, not HTML 500.

### Done when
- `POST /api/qa/getQaAccess` returns a JSON response (not the "Jest worker" HTML page)
- Dev-server console stack captured and attached/logged in results
- `npx tsc --noEmit` clean for edited files
- If no code change was needed, results state "transient — cache clear"

### Verify
- Run: `curl -s -X POST http://localhost:3000/api/qa/getQaAccess -H "content-type: application/json" -d "{\"args\":[]}"` -> JSON body (200/4xx both acceptable), not HTML 500

### Handoff
Unblocks live verification for dbg1-01 and dbg1-02 (their e2e tests need
`/api/qa/*` alive). Write results/dbg1-08.md (<=10 lines); TL alone updates TRACKER.md.


## dbg1-03: /auth/login — persistent busy overlay until navigation
Kind: mini
ID: dbg1-03
Parent: fix-dbg-1
Owner: dev
Depends: none
Criteria: PLAN #3
Skills: none
Budget: files=2; actions=3; changed_lines=90; minutes=8

### Goal
Clicking Sign in shows an overlay/dialog with `.spinner` + "Signing in…" that
stays visible until navigation completes or an error renders.

### Files
- Edit: `src/app/auth/login/page.tsx` | handleLogin + render overlay while `loading`
- Edit: `src/app/refresh.css` | `.login-*` overlay rule (near 396-460) reusing `.spinner` (cx-kit.css:231)

### Context
- `src/app/auth/login/page.tsx:36-61` | `finally{setLoading(false)}` runs right after synchronous `router.push` — busy dies ~0.5s before nav completes
- `src/app/auth/login/page.tsx:149-163` | submit Button already swaps label to "Signing in…"
- `src/app/cx-kit.css:231` | existing `.spinner` class — reuse it
- `src/app/refresh.css:396-460` | `.login-*` style block to extend

### Contract
Presentational only: no change to the fetch, credentials, error text, or
`router.push`/`router.refresh` calls. Keep `setLoading(false)` only on the error
path (catch) so the overlay persists through navigation; page unmounts on nav
so no reset needed on success. Honour `prefers-reduced-motion` for any new
animation (spinner already handles or is exempt per existing usage).
Out of scope: auth API route, Google button flow, other pages.

### Actions
1. In `handleLogin`, remove `setLoading(false)` from `finally`; keep it in `catch` (error path) only.
2. While `loading`, render a blocking overlay (e.g. `role="status"`/`aria-live` polite, `aria-busy`) containing `.spinner` and "Signing in…" covering the card or viewport.
3. Add the `.login-overlay` (or similar `.login-*` named) rule in refresh.css: fixed/absolute cover, centred spinner+label, dim backdrop; respects `prefers-reduced-motion`.

### Done when
- Overlay with `.spinner` appears on submit and persists until route change or error
- On failed login the overlay clears and the error alert shows (existing semantics)
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item3"` passes
- `npx tsc --noEmit` clean

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item3"` -> pass

### Handoff
None. Write results/dbg1-03.md (<=10 lines); TL alone updates TRACKER.md.


## dbg1-04: Nav rail — immediate click feedback + visible calm entry animation
Kind: mini
ID: dbg1-04
Parent: fix-dbg-1
Owner: dev
Depends: none
Criteria: PLAN #4
Skills: none
Budget: files=2; actions=4; changed_lines=140; minutes=10

### Goal
Clicking a nav link produces immediate visual feedback (pending state /
indicator / progress) and the incoming page gets a real entry animation after
the first route (`data-entry="calm"`), honouring `prefers-reduced-motion`.

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | navigate() pending state + view-transition handling (regions 216-221, 350-371)
- Edit: `src/app/cx-kit.css` | `[data-entry="calm"]` entry rule + pending-link styling (regions 1494, 1559-1568, .nav-link/.nav-ind 1028-1050)

### Context
- `src/features/shared/components/shell/AppShell.tsx:350-371` | `startViewTransition(go)` snapshots before async `router.push` paints — animates identical frames
- `src/features/shared/components/shell/AppShell.tsx:216-221` | `data-entry` flips to `calm` after first nav; only `[data-entry="first"]` has a CSS rule
- `src/app/cx-kit.css:1559-1568` | dead `::view-transition-old/new(page)` rules — `view-transition-name` set nowhere
- `src/features/shared/components/shell/AppShell.tsx:28` | `prefersReducedMotion()` helper already imported
- `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` | Next 16 view-transition guidance (required reading per .devin/workflow.md)

### Contract
Minimal honest fix per debug report: (i) pending affordance on the clicked
`.nav-link` or sliding `.nav-ind`/progress bar starting on click; (ii) a
`[data-entry="calm"]` variant rule so post-first navigations animate (subtler
than "first" is fine); (iii) either drop the useless `startViewTransition`
wrapper or give the page a `view-transition-name` so 1566-1568 actually runs —
pick one per the Next doc, don't ship half of both. All new animation gated by
`prefers-reduced-motion`. Keep `navigate()` guard clauses and Link markup.
Out of scope: Topbar, palette, mobile nav behaviour, other CSS sections.

### Actions
1. Add pending state: on accepted nav click mark the clicked `.nav-link` (e.g. `data-pending`/`aria-busy`, cleared on `path` change) or move `.nav-ind` immediately; style it in cx-kit.css.
2. Add `:root[data-entry="calm"]` entry rule (shorter/subtler variant of the `first` animation) with `@media (prefers-reduced-motion: reduce)` disabling it.
3. Resolve the view-transition half-fix: either remove `startViewTransition` (plain `router.push`) or set `view-transition-name` so the CSS rules engage — follow the Next doc.
4. Re-run the item4 spec; attach a click+250ms screenshot or computed-style probe showing the feedback in results.

### Done when
- Clicked nav link shows visible feedback within ~250ms of click
- Post-first navigations run a visible (reduced-motion-aware) entry animation
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item4"` passes
- `npx tsc --noEmit` clean; no new `view-transition-name` dead rules left behind
- `prefers-reduced-motion` respected (no animation when reduced)

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item4"` -> pass

### Handoff
Unblocks dbg1-06 (same file) and dbg1-07 (same CSS file) — they were held only
to serialise shared-file writes. Write results/dbg1-04.md (<=10 lines); TL
alone updates TRACKER.md.


## dbg1-05: /admin Reminders — compact hint-left/Toggle-right row
Kind: mini
ID: dbg1-05
Parent: fix-dbg-1
Owner: dev
Depends: none
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=3; changed_lines=60; minutes=8

### Goal
`Rb` renders one compact row — hint text left, `Toggle` anchored far right —
instead of full-width section with Chip + "Turn on/off" Button.

### Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `Rb` JSX only (318-364)

### Context
- `src/features/cx-hub/components/admin-page.tsx:318-364` | current `Rb`: SettingsSection + hint + Chip + Button block to replace
- `src/features/shared/components/ui/Toggle.tsx` | `Toggle` props: `checked`, `onChange(checked)`, `disabled`; already imported in admin-page.tsx:9
- `src/app/refresh.css:53` | `.flex { display:flex; align-items:center; gap }` — reuse for the row wrapper

### Contract
Keep: `#reminders` id (TOC anchor), loading/error Chip states and retry Button,
`Ln.saveConfigSetting('reminders_enabled', !on)` + `Ti` toast + `busy` logic
(existing handler body reusable — move `onChange` onto Toggle). Row = one
wrapper (`className="flex"` + `style={{justifyContent:'space-between'}}` or an
existing equivalent class — no new CSS files in this leaf) containing the hint
and a right-anchored `<Toggle checked={on} disabled={busy||!row} …/>`. Keep the
off/on Chip if space allows, else drop the status Chip only — never the
loading/error states.
Out of scope: SettingsSection component, other admin sections, CSS files.

### Actions
1. Replace the Chip + Button block in `Rb` with the single flex row: hint (`cx-section__hint`) left, `<Toggle>` far right bound to `on`/`busy`/`row`, calling the existing save+toast handler via `onChange`.
2. Keep loading (`<Chip>loading</Chip>`) and error (Chip + Try again) branches intact; keep `aria-pressed`/label semantics on the Toggle (`checked` already conveys state; keep a11y label via children or aria-label).
3. Verify at 1024px and 375px that the row stays on one line with the toggle far right (hint may wrap).

### Done when
- `#reminders` renders hint-left / Toggle-right single row; no "Turn on/off" Button
- Toggle calls `saveConfigSetting('reminders_enabled', !on)` + toast, disabled while busy/no row
- Loading and error states unchanged
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item5"` passes
- `npx tsc --noEmit` clean

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item5"` -> pass

### Handoff
None. Write results/dbg1-05.md (<=10 lines); TL alone updates TRACKER.md.


## dbg1-06: Rail footer — remove avatar circle and dead initials code
Kind: mini
ID: dbg1-06
Parent: fix-dbg-1
Owner: dev
Depends: dbg1-04
Criteria: PLAN #6
Skills: none
Budget: files=1; actions=2; changed_lines=20; minutes=5

### Goal
`.rail-foot` shows no `.avatar` circle left of the user name; the now-unused
`whoParts`/`initials` computation is deleted.

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | rail-foot avatar block (640-642) + `whoParts`/`initials` (388-392)

### Context
- `src/features/shared/components/shell/AppShell.tsx:639-650` | `.avatar` div to remove; `rail-who` block stays
- `src/features/shared/components/shell/AppShell.tsx:388-392` | `whoParts`/`initials` feed only the avatar — dead after removal
- `src/features/shared/components/shell/AppShell.tsx:396-401` | `topName`/`topParts`/`topInitials` (Topbar) are separate — must stay
- `src/app/refresh.css:94` | `.avatar` rule must stay (still used by Topbar.tsx:95, agents-page.tsx:730, status-validation-page.tsx:385)

### Contract
Delete the avatar `<div>` and the `whoParts`/`initials` lines only. Do not
touch `.avatar` CSS, `topInitials`, Topbar, or any other AppShell region.
Out of scope: everything not listed — this leaf is a deletion only.

### Actions
1. Remove `<div className="avatar" …>{initials}</div>` from `.rail-foot` and delete the `whoParts`/`initials` computation.
2. Confirm no other reference to `initials`/`whoParts` remains in the file; `rail-who` name/meta still render.

### Done when
- `.rail-foot .avatar` count is 0 in the DOM
- No unused vars/ts errors; `npx tsc --noEmit` clean
- item6 portion of `npx playwright test e2e/ui-shell-polish.spec.ts -g "items6"` passes (name-size assertion belongs to dbg1-07 and may still fail)

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "items6"` -> avatar assertion passes; remaining failure, if any, is only the who-name size/overflow owned by dbg1-07

### Handoff
None. Write results/dbg1-06.md (<=10 lines); TL alone updates TRACKER.md.


## dbg1-07: Rail footer — smaller, single-line truncated user name
Kind: mini
ID: dbg1-07
Parent: fix-dbg-1
Owner: dev
Depends: dbg1-04
Criteria: PLAN #7
Skills: none
Budget: files=1; actions=1; changed_lines=15; minutes=5

### Goal
`.who-name` renders at ~`--cx-text-xs`/`--cx-text-sm`, single line with
ellipsis truncation; role line and rail buttons stay aligned/readable.

### Files
- Edit: `src/app/cx-kit.css` | `.who-name` rule only (inside `.who` block ~1136)

### Context
- `src/app/cx-kit.css:1136-1140` | `.who`/`.who-meta` rules; name currently `--cx-text-md` (14px) `white-space:normal` `text-overflow:clip` → wraps to 2-3 lines
- `src/app/cx-kit.css:1127` | `.rail-who` already has `min-width:0` so ellipsis can work
- `src/features/shared/components/shell/AppShell.tsx:644-645` | elements are `who who-name` / `who-meta who-role` — no markup change needed

### Contract
Change only the name styling: `font-size:var(--cx-text-xs)` (or `--cx-text-sm`),
`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`. Leave `.who`,
`.who-meta`, and role styles unchanged; no markup edits.
Out of scope: all other cx-kit rules, AppShell.tsx.

### Actions
1. Update the `.who-name` rule in the `.who` block: smaller font token + nowrap + overflow hidden + ellipsis.

### Done when
- `.who-name` computed font-size ≤ ~12.5px (`--cx-text-xs`) or ~13px (`--cx-text-sm`), `text-overflow:ellipsis`, no wrapping
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "items6"` passes (with dbg1-06 landed; if run before, only its avatar assertion may fail)
- Rail foot buttons still aligned at 375px (visual check via the spec screenshot or computed layout)

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "items6"` -> name assertions pass (avatar assertion owned by dbg1-06)

### Handoff
None. Write results/dbg1-07.md (<=10 lines); TL alone updates TRACKER.md.


## dbg1-02: /calibration AssignForm — stop grid-field border overlap
Kind: mini
ID: dbg1-02
Parent: fix-dbg-1
Owner: dev
Depends: dbg1-08
Criteria: PLAN #2
Skills: none
Budget: files=1; actions=2; changed_lines=20; minutes=5

### Goal
`.qa-grid` controls (selects/inputs/button) get `min-inline-size:0` + border-box
sizing so field borders no longer overlap at desktop width.

### Files
- Edit: `src/app/styles/quality.css` | `.qa-grid` rules only (~line 85)

### Context
- `src/app/styles/quality.css:85` | `.qa-grid{grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}` — tracks fine, children overflow
- `src/app/cx-kit.css:277-291` | `.cx-select`/`.cx-input` are `width:100%` + `min-inline-size:auto` — min-content of a long `<option>` escapes the track
- `src/app/cx-kit.css:536-537` | proven sibling fix: `.cx-settings-section :is(input,select,textarea){box-sizing:border-box;min-inline-size:0;max-inline-size:100%;inline-size:100%}`
- `src/app/styles/quality.css:52-55` | same pattern already in `.qa-ctl`/`.qa-ctlform`
- `src/features/cx-quality/components/calibration-page.tsx:170-269` | AssignForm fields; same `.qa-grid` also in kb-gaps-page.tsx:71, qa-forms-page.tsx:113 — one CSS fix covers all

### Contract
CSS-only: add `.qa-grid>*{min-inline-size:0}` (covers the direct-child submit
Button) and `.qa-grid :is(input:not([type=checkbox]):not([type=radio]),select,textarea){box-sizing:border-box;min-inline-size:0;max-inline-size:100%}` —
mirroring the proven cx-kit pattern. No markup edits, no other selectors.
Out of scope: the kb-gaps/qa-forms pages themselves (same class fixes them);
any other quality.css rules.

### Actions
1. Add the two `.qa-grid` scoped rules above to quality.css near line 85.
2. Verify no `.qa-grid` field overflows its track at 1440px and 375px on /calibration (e2e item2), and spot-check kb-gaps/qa-forms fields do not regress.

### Done when
- `.qa-grid` children computed `min-inline-size:0`; borders no longer overlap
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item2"` passes
- 375px + 1440px evidence captured (spec screenshots or probe) per PLAN #2

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item2"` -> pass

### Handoff
Unblocks dbg1-01 (serialises quality.css writes). Write results/dbg1-02.md
(<=10 lines); TL alone updates TRACKER.md.


## dbg1-01: /quality-scores TL-drill — fix "labels wrongly positioned" in agents table
Kind: mini
ID: dbg1-01
Parent: fix-dbg-1
Owner: dev
Depends: dbg1-02
Criteria: PLAN #1
Skills: none
Budget: files=2; actions=4; changed_lines=60; minutes=10

### Goal
In the agents-for-TL table under `All team leads / <TL>` crumbs, column labels
and cell content are correctly positioned/aligned — no sub-lines reading as
misplaced labels.

### Files
- Edit: `src/app/styles/quality.css` | scoped fix for `.qa-sub`/`.qa-range`/cell alignment inside the drilled table
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | only if the live pin-down proves a class/markup change is needed (BreakdownTable 265-389, ScoreCell 236-262)

### Context
- `specs/ui-shell-polish/reports/debug-1.md` dbg-1 row | markup verified 1:1 with legacy — suspect is CSS; thead 5×`SortTh` + 1 plain `th`, cells align 6/6
- `src/features/cx-quality/components/quality-scores-page.tsx:236-262` | `ScoreCell` wraps chip + `.qa-range` + `.qa-sub{display:block}` → second block line under each score looks like a misplaced label
- `src/app/cx-kit.css:645` | `vertical-align:middle` centres two-line cells against one-line headers — candidate contributor
- `src/app/styles/quality.css` | `.qa-sub` (80), `.qa-range` (183), `.qs-crumbs` (232) rules to re-scope, e.g. under `section[aria-labelledby="qs-tbl-h"]`

### Contract
FIRST pin the computed positions live (dev server fixed by dbg1-08): screenshots
at ~1440px and 375px of the drilled table per PLAN #1, then apply the minimal
re-scope — likely `.qa-sub` inline or `display:block` only where intended, or
cell `vertical-align:top` — inside the drilled-table section only. Do not
restructure the table markup (legacy-verified); a tsx edit is allowed only if
the live evidence demands a class hook.
Out of scope: header sort behaviour, other quality pages, ScoreCell data.

### Actions
1. Log in (e2e.admin@dabdoob.com / E2E-cx-local-2026!), open /quality-scores, drill into a TL row; capture 1440px + 375px screenshots and computed styles of `.qa-sub`/`.qa-range`/`.qa-sort` in the agents table.
2. Identify which element reads as the misplaced label (per debug suspects) and write the minimal scoped CSS fix.
3. Edit quality.css (and the tsx only if a class hook is strictly needed).
4. Re-run item1 spec; attach before/after evidence in results.

### Done when
- Agents table headers and cells align at 1440px and 375px; no sub-line reads as a misplaced column label
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item1"` passes
- 375px + 1440px screenshots captured per PLAN #1
- `npx tsc --noEmit` clean if the tsx was touched

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item1"` -> pass

### Handoff
Final leaf — completes fix-dbg-1. Write results/dbg1-01.md (<=10 lines); TL
alone updates TRACKER.md.


## dbg1-09: Regression spec — replace es2018 regex flag breaking tsc
Kind: mini
ID: dbg1-09
Parent: fix-dbg-1
Owner: test-engineer
Depends: none
Criteria: gate repair (tsc clean)
Skills: none
Budget: files=1; actions=1; changed_lines=5; minutes=5

### Goal
`npx tsc --noEmit` passes with the repo's <es2018 target: the spec's `/is`
flag regex compiles without TS1501.

### Files
- Edit: `e2e/ui-shell-polish.spec.ts` | api-probe regex, line ~29

### Context
- `e2e/ui-shell-polish.spec.ts:29` | `t.match(/.{0,600}error.{0,600}/is)` — `s` flag needs es2018; repo tsconfig target is lower and `**/*.ts` covers e2e
- `specs/ui-shell-polish/results/gate-tsc.log` | the single tsc error

### Contract
Preserve matching semantics exactly: case-insensitive, dot-matches-newline
(`[\s\S]` idiom). Do not touch any other spec logic or other files.

### Actions
1. Replace the `/is`-flagged regex with an es2017-safe equivalent (e.g. `[\s\S]` + `i` flag only).

### Done when
- `npx tsc --noEmit` exits 0 (no TS1501)
- The probe still extracts an error window from 500-HTML bodies (same semantics)

### Verify
- Run: `npx tsc --noEmit` -> exit 0

### Handoff
None. Write results/dbg1-09.md (<=10 lines); TL alone updates TRACKER.md.
