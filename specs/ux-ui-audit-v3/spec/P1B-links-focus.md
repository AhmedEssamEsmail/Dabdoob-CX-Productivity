# P1B-05: Links, semantics & focus — B1 link styling, B15 element choice, B16 truncation, B18 focus-visible
Kind: package
ID: P1B-05
Dispatch: NEVER

## Goal and contract
Every `<a>` renders as a real link (shared `.cx-link` — added by B1-00 — or an existing feature link class like `.qa-link`); action-only "links" become `Button`, and navigation-only "buttons" become `<a>`/Link. Text truncated via ellipsis classes (`cx-clip`, `cx-list__title`, `cx-rank__name`, `trk-table`, `qa-name/qa-meta/qa-note-txt`, `wi-t/wi-s`, `tph-name`, `pw-g-label`) exposes the full string (`title` attr or accessible equivalent). Custom interactive elements (`role="button"`, `[tabindex]`) must be covered by a `:focus-visible` ring — `cx-kit.css:120` provides a universal rule; gaps (e.g. `outline:none` without replacement) get feature-scoped fixes.
Non-goals: new link color design beyond `.qa-link` parity, files not listed.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| B1-00 | dev | none | B1 foundation `.cx-link` | 1/3/30/5 |
| B1-01 | dev | B1-00, B7-07, B17-03 | B1 hub+shared links (7 files) | 7/9/70/10 |
| B1-02 | dev | B1-00, B16-01, B17-02, B4-03 | B1 people+ops+desk links (5 files) | 5/6/50/8 |
| B1-03 | dev | B1-00, B17-02, B7-02, B17-03, B4-01 | B1 quality+prod+queue links (7 files) | 7/8/60/9 |
| B15-01 | dev | B14-01, B1-01 | B15 element-misuse (4 files) | 4/5/40/8 |
| B16-01 | dev | B13-01, B7-04, B9-01 | B16 truncation quality+people+ops (7 files) | 7/8/50/9 |
| B16-02 | dev | B4-01, B4-02, B4-03, B4-04 | B16 truncation queue+hub+prod (7 files) | 7/8/50/9 |
| B18-01 | dev | B8-07, B1-00, B4-04 | B18 shared components + global ring | 7/7/60/9 |
| B18-02 | dev | B8-02, B8-05, B17-03, B1-03, B5-02 | B18 queue+productivity focus (9 files) | 9/9/60/10 |
| B18-03 | dev | B8-04, B8-01, B8-03, B17-02, B1-03, B5-02, B18-01 | B18 quality+people+hub focus (10 files) | 10/10/70/10 |

## B1-00: shared `.cx-link` style foundation
Kind: mini
ID: B1-00
Parent: P1B-05
Owner: dev
Depends: none
Criteria: PLAN B1
Skills: none
Budget: files=1; actions=3; changed_lines=30; minutes=5

### Goal
`cx-kit.css` ships a `.cx-link` class giving any `<a>` the design-system link treatment (color, underline, hover, focus-visible) — the target consumers B1-01/02/03 apply.

### Files
- Edit: `src/app/cx-kit.css` | add `.cx-link` block near the `.qa-link`-equivalent/link utilities (~:664 `.cx-clip` region)

### Context
- `src/app/styles/quality.css:190-192` | `.qa-link` definition to model (all:unset → use normal link styles instead: `.cx-link` must not `all:unset`)

### Contract
`.cx-link`: `color:var(--cx-accent)` (or `var(--cx-ink)` + underline when accent is wrong contextually — keep one canonical rule), `text-decoration:underline`, `text-underline-offset:2px`, `cursor:pointer`, `:hover` thickens/marks, `:focus-visible` ring via `var(--cx-focus)` (2px outline, offset 2px — consistent with cx-kit.css:120).
Out of scope: consumers (B1-01/02/03); `.qa-link` refactor.

### Actions
1. Add `.cx-link` + `:hover` + `:focus-visible` rules to `cx-kit.css` under `:root` near the `.cx-clip` region (~:664).
2. Verify against the `.qa-link` model (quality.css:190-192) — no `all:unset`; accent color + underline + focus ring.
3. `npx eslint` (n/a css) + visual check on one migrated link.

### Done when
- `.cx-link` exists in cx-kit.css; applying it to an `<a>` produces styled+focusable link

### Verify
- Run: `npx tsc --noEmit` -> clean

### Handoff
`.cx-link` is the published link class for B1-01, B1-02, B1-03.
Write results/B1-00.md (<=10 lines); TL alone updates TRACKER.md.

## B1-01: link styling — cx-hub + shared
Kind: mini
ID: B1-01
Parent: P1B-05
Owner: dev
Depends: B1-00, B7-07, B17-03
Criteria: PLAN B1
Skills: none
Budget: files=7; actions=9; changed_lines=70; minutes=10

### Goal
Every `<a>` in the listed files has real link styling (`.cx-link` or an existing feature link class); action-only anchors convert to `Button`.

### Files
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | `<a>` :60
- Edit: `src/features/cx-hub/components/hub-shared.tsx` | `<a>` :616
- Edit: `src/features/cx-hub/components/ecosystem-page.tsx` | `<a>` :131,145,158
- Edit: `src/features/cx-hub/components/overview-page.tsx` | `<a>` :76,95,361,515,541,608,623
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | `<a>` :178,293,428,523
- Edit: `src/features/shared/components/ui/SettingsSection.tsx` | `<a>` :53
- Edit: `src/features/shared/components/shell/AppShell.tsx` | `<a>` :515 (skip nav-internal anchors already styled by `.nav-*` rules — verify only)

### Context
- `src/app/styles/quality.css:190-192` | existing link-style precedent
- `src/features/cx-operations/components/trackers-page.tsx:689-692` | precedent: table link (has `title` context; verify styling)

### Contract
For each `<a href>` without a styling class: add `className="cx-link"` (or the local feature link class where one exists and matches context). For `<a>` that performs an action (no href/`href="#"`), convert to shared `Button` with a quiet variant. Keep `target`/`rel`/`title` intact.
Out of scope: `Link`/`router` components (already app links); files not listed.

### Actions
1. `people-holidays-page.tsx`: audit `<a>` :60 — apply `.cx-link` or convert action-anchor to `Button`.
2. `hub-shared.tsx`: audit `<a>` :616.
3. `ecosystem-page.tsx`: audit `<a>` :131,145,158.
4. `overview-page.tsx`: audit `<a>` :76,95,361,515,541,608,623.
5. `my-day-page.tsx`: audit `<a>` :178,293,428,523.
6. `SettingsSection.tsx`: audit `<a>` :53.
7. `AppShell.tsx`: verify `<a>` :515 — nav-internal anchors already styled by `.nav-*`; verify only.
8. Re-grep listed files: every `<a` carries a class or is nav-internal.
9. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "<a " <listed files>` → every hit carries a class or is nav-internal
- links are visibly styled (underline/color) at 375/1024px

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-hub/components src/features/shared/components` -> clean

### Handoff
B15-01 fixes remaining element-misuse (ecosystem-page anchor onClick, AppShell router.push).
Write results/B1-01.md (<=10 lines); TL alone updates TRACKER.md.

## B1-02: link styling — cx-people + cx-operations + cx-desk
Kind: mini
ID: B1-02
Parent: P1B-05
Owner: dev
Depends: B1-00, B16-01, B17-02, B4-03
Criteria: PLAN B1
Skills: none
Budget: files=5; actions=6; changed_lines=50; minutes=8

### Goal
Every `<a>` in the listed files has real link styling or is converted to `Button`.

### Files
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | `<a>` :721
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | `<a>` :132,284,688
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | `<a>` :691,839 (table links — verify `.trk-table a` coverage or add `.cx-link`)
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | `<a>` :319
- Edit: `src/features/cx-desk/components/mail-desk-page.tsx` | `<a>` :173,243

### Context
- `src/app/cx-kit.css` | `.cx-link` (added by B1-00)

### Contract
As B1-01.

### Actions
1. `tl-tasks-page.tsx`: audit `<a>` :721 — apply `.cx-link` or convert to `Button`.
2. `one-on-ones-views.tsx`: audit `<a>` :132,284,688.
3. `trackers-page.tsx`: audit `<a>` :691,839 — verify `.trk-table a` coverage or add `.cx-link`.
4. `tl-performance-page.tsx`: audit `<a>` :319.
5. `mail-desk-page.tsx`: audit `<a>` :173,243.
6. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "<a " <listed files>` → every hit carries a class

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-people/components src/features/cx-operations/components src/features/cx-desk/components` -> clean

### Handoff
None.
Write results/B1-02.md (<=10 lines); TL alone updates TRACKER.md.

## B1-03: link styling — cx-quality + cx-productivity + cx-queue
Kind: mini
ID: B1-03
Parent: P1B-05
Owner: dev
Depends: B1-00, B17-02, B7-02, B17-03, B4-01
Criteria: PLAN B1
Skills: none
Budget: files=7; actions=8; changed_lines=60; minutes=9

### Goal
Every `<a>` in the listed files has real link styling or is converted to `Button`.

### Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | `<a>` :248,1468 (verify `.qa-link` coverage; apply where missing)
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | `<a>` :1193
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | `<a>` :125
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | `<a>` :176
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | `<a>` :960,963,966
- Edit: `src/features/cx-queue/components/aging-page.tsx` | `<a>` :308
- Edit: `src/features/cx-queue/components/queue-page.tsx` | `<a>` :355

### Context
- `src/app/cx-kit.css` | `.cx-link` (B1-00)

### Contract
As B1-01; `.qa-link` stays where already applied in quality files.

### Actions
1. `qa-shared.tsx`: audit `<a>` :248,1468 — verify `.qa-link` coverage; apply where missing.
2. `quality-analytics-page.tsx`: audit `<a>` :1193.
3. `pv-shared.tsx`: audit `<a>` :125.
4. `status-validation-page.tsx`: audit `<a>` :176.
5. `scheduler-page.tsx`: audit `<a>` :960,963,966.
6. `aging-page.tsx`: audit `<a>` :308.
7. `queue-page.tsx`: audit `<a>` :355.
8. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "<a " <listed files>` → every hit carries a class

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components src/features/cx-productivity/components src/features/cx-queue/components` -> clean

### Handoff
None.
Write results/B1-03.md (<=10 lines); TL alone updates TRACKER.md.

## B15-01: element choice — links vs buttons
Kind: mini
ID: B15-01
Parent: P1B-05
Owner: dev
Depends: B14-01, B1-01
Criteria: PLAN B15
Skills: none
Budget: files=4; actions=5; changed_lines=40; minutes=8

### Goal
Anchors acting as buttons and buttons acting as navigation use the correct element.

### Files
- Edit: `src/app/auth/login/page.tsx` | `router.push`/`location.href` :54,75 — if on a `<button onClick>` doing navigation, swap to `<a className="cx-link">`/`Link`; if it's a programmatic redirect in an effect/handler, keep
- Edit: `src/features/cx-hub/components/ecosystem-page.tsx` | `<a onClick` :141 — action anchor → `Button`
- Edit: `src/features/shared/components/shell/AppShell.tsx` | `router.push` :359 — verify element; nav-click should stay anchor
- Edit: `src/features/shared/components/shell/CommandPalette.tsx` | navigation :149 — verify keyboard-nav path uses anchors/Link where a location change results

### Context
- `src/features/shared/components/ui/Button.tsx` | action element
- `src/features/shared/lib/use-search-param-state.ts:7,35` + `HashShim.tsx:16` | hits are lib-level URL APIs — NOT in scope (recorded so nobody re-flags them)

### Contract
Navigation (URL change) → `<a>`/`Link`; action (mutation/toggle/submit) → `button`. `router.push` inside an event handler that *is* navigation keeps a button ONLY if the element is genuinely an action with a side-effect navigation — prefer the honest element. `use-search-param-state.ts` and `HashShim.tsx` are out of scope.
Out of scope: non-listed files.

### Actions
1. `src/app/auth/login/page.tsx` :54,75 — if on a `<button onClick>` doing navigation, swap to `<a className="cx-link">`/`Link`; programmatic redirects in handlers stay.
2. `ecosystem-page.tsx` :141 — action anchor `<a onClick` → `Button`.
3. `AppShell.tsx` :359 — verify element; nav-click stays anchor.
4. `CommandPalette.tsx` :149 — verify keyboard-nav path uses anchors/Link where a location change results.
5. `npx eslint` + `npx tsc --noEmit`.

### Done when
- no `<a onClick` without href remains; no `<button>` whose sole job is navigation remains in listed files

### Verify
- Run: `npx tsc --noEmit && npx eslint src/app/auth src/features/cx-hub/components/ecosystem-page.tsx src/features/shared/components/shell` -> clean

### Handoff
None.
Write results/B15-01.md (<=10 lines); TL alone updates TRACKER.md.

## B16-01: truncation titles — cx-quality + cx-people + cx-operations
Kind: mini
ID: B16-01
Parent: P1B-05
Owner: dev
Depends: B13-01, B7-04, B9-01
Criteria: PLAN B16
Skills: none
Budget: files=7; actions=8; changed_lines=50; minutes=9

### Goal
Every element rendered with an ellipsis/truncation class exposes the full text via `title` (or an accessible alternative).

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | `.qa-name`/`.qa-meta` :344,347
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | truncating classes :390,392,409
- Edit: `src/features/cx-quality/components/disputes-page.tsx` | :153,154
- Edit: `src/features/cx-quality/components/my-audits-page.tsx` | :57,60
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | `.qa-*`/`cx-clip` sites :404,523
- Edit: `src/features/cx-people/components/meetings-page.tsx` | truncating classes :332-610 (8 hits)
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | `.trk-table` cells :703-704 (`td` already has `title` at :690,694 — verify remaining)

### Context
- `src/app/styles/quality.css:254-262` / `src/app/refresh.css:78,261,505,526` / `src/app/cx-kit.css:664,881` | the truncating class definitions
- `src/features/cx-operations/components/trackers-page.tsx:688-694` | precedent: `title={n}` on truncated cells

### Contract
For each element whose class truncates, add `title={fullValue}` (or `aria-label` when `title` duplicates visible tooltip). Skip cells already carrying `title`.
Out of scope: adding new truncation, files not listed.

### Actions
1. `audit-queue-page.tsx`: pair `.qa-name`/`.qa-meta` :344,347 with `title`.
2. `ctls-page.tsx`: pair truncating elements :390,392,409.
3. `disputes-page.tsx`: pair :153,154.
4. `my-audits-page.tsx`: pair :57,60.
5. `tl-tasks-page.tsx`: pair `.qa-*`/`cx-clip` sites :404,523.
6. `meetings-page.tsx`: pair truncating classes :332-610 (8 hits).
7. `trackers-page.tsx`: verify `.trk-table` cells :703-704 (skip cells already carrying `title`).
8. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every truncating element in listed files exposes full text (hover shows it)

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components src/features/cx-people/components src/features/cx-operations/components` -> clean

### Handoff
None.
Write results/B16-01.md (<=10 lines); TL alone updates TRACKER.md.

## B16-02: truncation titles — cx-queue + cx-hub + cx-productivity
Kind: mini
ID: B16-02
Parent: P1B-05
Owner: dev
Depends: B4-01, B4-02, B4-03, B4-04
Criteria: PLAN B16
Skills: none
Budget: files=7; actions=8; changed_lines=50; minutes=9

### Goal
Every truncating-class element in the listed files exposes full text.

### Files
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | `cx-clip`/truncating class :62
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | :235
- Edit: `src/features/cx-hub/components/overview-page.tsx` | `.cx-clip`/`wi-*` :520-523
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | truncating classes :293-808 (13 hits)
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | `.tph-name`/`wi-*` :625,1230
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | `wi-t`/`wi-s` :386,392,397
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | `wi-*` :52,218

### Context
- `src/app/styles/productivity.css:15,97` / `cx-kit.css:664` | truncating class defs

### Contract
As B16-01.

### Actions
1. `heatmap-page.tsx`: pair truncating element :62 with `title`/accessible full text.
2. `analytics-page.tsx`: pair :235.
3. `overview-page.tsx`: pair `.cx-clip`/`wi-*` :520-523.
4. `my-day-page.tsx`: pair truncating classes :293-808 (13 hits).
5. `tph-grid-views.tsx`: pair `.tph-name`/`wi-*` :625,1230.
6. `status-validation-page.tsx`: pair `wi-t`/`wi-s` :386,392,397.
7. `my-status-page.tsx`: pair `wi-*` :52,218.
8. `npx eslint` + `npx tsc --noEmit`.

### Done when
- every truncating element in listed files exposes full text

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components src/features/cx-hub/components src/features/cx-productivity/components` -> clean

### Handoff
None.
Write results/B16-02.md (<=10 lines); TL alone updates TRACKER.md.

## B18-01: focus-visible — shared components + global ring audit
Kind: mini
ID: B18-01
Parent: P1B-05
Owner: dev
Depends: B8-07, B1-00, B4-04
Criteria: PLAN B18
Skills: none
Budget: files=7; actions=7; changed_lines=60; minutes=9

### Goal
The universal `:focus-visible` rule provably covers every shared custom control; any `outline:none`/`outline:0` site has a replacement ring (or gets one).

### Files
- Edit: `src/features/shared/components/ui/Tabs.tsx` | tabIndex/role :92,106 — verify `.cx-tab:focus-visible` (cx-kit.css:508) covers
- Edit: `src/features/shared/components/ui/PaintGrid.tsx` | :205 — verify `.cx-paintgrid-cell:focus-visible` (:905)
- Edit: `src/features/shared/components/ui/ConfirmInline.tsx` | :42
- Edit: `src/features/shared/components/ui/TableScroll.tsx` | :46 — `.tblscroll:focus-visible` (:626)
- Edit: `src/features/shared/components/shell/AppShell.tsx` | :674
- Edit: `src/features/shared/components/layout/SiteChrome.tsx` | :41
- Edit: `src/app/styles/people.css` | `.nt-capture-box:focus-visible{outline:none}` :238 — add replacement ring (box-shadow) if none

### Context
- `src/app/cx-kit.css:120-128` | universal `:is(a,button,input,select,textarea,summary,[tabindex]):focus-visible` rule
- `src/app/refresh.css:120-123` | `.cpk-input` already replaces outline with box-shadow — OK precedent

### Contract
Each `role="button"`/`tabIndex` element in listed files must produce a visible ring on keyboard focus. Where a rule sets `outline:none` without a replacement indicator, add a feature-scoped `:focus-visible` box-shadow/outline using `var(--cx-focus)`/`--cx-focus-ring`. Native `<button>`/`<a>` elements are already covered — verify only.
Out of scope: feature-page files (B18-02/03).

### Actions
1. `Tabs.tsx` :92,106 — verify `.cx-tab:focus-visible` (cx-kit.css:508) covers; add rule if missing.
2. `PaintGrid.tsx` :205 — verify `.cx-paintgrid-cell:focus-visible` (:905).
3. `ConfirmInline.tsx` :42 — match control to a focus rule.
4. `TableScroll.tsx` :46 — verify `.tblscroll:focus-visible` (:626).
5. `AppShell.tsx` :674 — match control to a focus rule.
6. `SiteChrome.tsx` :41 — match control to a focus rule.
7. `people.css` :238 — fix `.nt-capture-box:focus-visible{outline:none}` gap with a `var(--cx-focus)` box-shadow ring; then `npx eslint` + `npx tsc --noEmit` and keyboard-tab through one page.

### Done when
- every custom control in listed files shows a focus ring; `outline:none` sites all have replacements

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/shared` -> clean

### Handoff
B18-03 may write people.css after this leaf (serialized via Depends).
Write results/B18-01.md (<=10 lines); TL alone updates TRACKER.md.

## B18-02: focus-visible — cx-queue + cx-productivity
Kind: mini
ID: B18-02
Parent: P1B-05
Owner: dev
Depends: B8-02, B8-05, B17-03, B1-03, B5-02
Criteria: PLAN B18
Skills: none
Budget: files=9; actions=9; changed_lines=60; minutes=10

### Goal
Every `role="button"`/`tabIndex` custom control in the listed files is covered by a `:focus-visible` ring.

### Files
- Edit: `src/features/cx-queue/components/shared.tsx` | :430
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | :684
- Edit: `src/features/cx-queue/components/aging-page.tsx` | :168,169
- Edit: `src/features/cx-queue/components/queue-page.tsx` | :229,230
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | :137,138,199
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | :169
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | :303
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | :99,152,185
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | :262

### Context
- `src/app/cx-kit.css:120-128` | universal focus rule
- `src/app/styles/queue.css` / `productivity.css` | feature-scoped additions

### Contract
As B18-01; fixes go to the feature css under `[data-app="queue"]`/`[data-app="productivity"]`.

### Actions
1. `queue/components/shared.tsx` :430 — match control to a focus rule; add feature-scoped rule if missing.
2. `heatmap-page.tsx` :684 — same check.
3. `aging-page.tsx` :168,169 — same check.
4. `queue-page.tsx` :229,230 — same check.
5. `analytics-page.tsx` :137,138,199 — same check.
6. `tph-grid-views.tsx` :169 — same check.
7. `pv-shared.tsx` :303 — same check.
8. `tph-grid-page.tsx` :99,152,185 — same check.
9. `my-status-page.tsx` :262 — same check; then `npx eslint` + `npx tsc --noEmit` and keyboard-tab through one page per feature.

### Done when
- every listed custom control shows a focus ring on keyboard focus

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components src/features/cx-productivity/components` -> clean

### Handoff
None.
Write results/B18-02.md (<=10 lines); TL alone updates TRACKER.md.

## B18-03: focus-visible — cx-quality + cx-people + cx-hub
Kind: mini
ID: B18-03
Parent: P1B-05
Owner: dev
Depends: B8-04, B8-01, B8-03, B17-02, B1-03, B5-02, B18-01
Criteria: PLAN B18
Skills: none
Budget: files=10; actions=10; changed_lines=70; minutes=10

### Goal
Every `role="button"`/`tabIndex` custom control in the listed files is covered by a `:focus-visible` ring.

### Files
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | :137
- Edit: `src/features/cx-quality/components/audit-queue-coverage.tsx` | :48
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | :171,795,1381
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | :963
- Edit: `src/features/cx-quality/components/calibration-page.tsx` | :137
- Edit: `src/features/cx-quality/components/quality-analytics-charts.tsx` | :138,353,525
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | :426,454,467,517
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | :424
- Edit: `src/features/cx-hub/components/hub-shared.tsx` | :451,604
- Edit: `src/features/cx-hub/components/ecosystem-page.tsx` | :131,158

### Context
- `src/app/cx-kit.css:120-128` | universal focus rule
- `src/app/styles/quality.css` / `people.css` / `hub.css` | feature-scoped additions

### Contract
As B18-01.

### Actions
1. `quality-scores-page.tsx` :137 — match control to a focus rule; add feature-scoped rule if missing.
2. `audit-queue-coverage.tsx` :48 — same check.
3. `qa-shared.tsx` :171,795,1381 — same check.
4. `quality-analytics-page.tsx` :963 — same check.
5. `calibration-page.tsx` :137 — same check.
6. `quality-analytics-charts.tsx` :138,353,525 — same check.
7. `tl-tasks-page.tsx` :426,454,467,517 — same check.
8. `one-on-ones-views.tsx` :424 — same check.
9. `hub-shared.tsx` :451,604 — same check.
10. `ecosystem-page.tsx` :131,158 — same check; then `npx eslint` + `npx tsc --noEmit`.

### Done when
- every listed custom control shows a focus ring on keyboard focus

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components src/features/cx-people/components src/features/cx-hub/components` -> clean

### Handoff
None.
Write results/B18-03.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
All 10 child leaves done; `.cx-link` exists and every `<a>` is styled or correctly a button; truncating elements expose full text; every custom control has a visible focus ring.
