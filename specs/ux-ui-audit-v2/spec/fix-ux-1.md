# FIX leaves: ux-ui-audit-v2 ux-1 round 1 (reports/ux-1.md)

PM declared every row of reports/ux-1.md blocking (incl. carried LOWs ux-2/ux-3
previously deferred — now assigned). One independent root-cause fix per leaf.
ux1-01 was the earlier ux-yours-1 leaf; this file continues the ux1 series.

## ux1-02: wrap the /queue "By queue" table in TableScroll (ux-4 HIGH)
Kind: mini
ID: ux1-02
Parent: ux-1 (ux-4 HIGH, reports/ux-1.md)
Owner: dev
Depends: none
Status: ready
Criteria: PLAN #5 — fixes pass gates; WCAG 1.4.10 reflow on primary route
Skills: none
Budget: files=1; actions=3; changed_lines=15; minutes=5

### Goal
/queue @390 stops overflowing the page (scrollWidth 857 vs vw 390): the
"By queue" `table.cx-table` scrolls inside an accessible `TableScroll` region
instead of forcing page-level horizontal scroll.

### Files
- Edit: `src/features/cx-queue/components/queue-page.tsx` | barrel import (:8) + `.cc-chart` table wrap (:278 through its `</table>`/`</div>`)

### Context
- `src/features/shared/components/ui/TableScroll.tsx:12-55` | props: `label` (aria-label, required), `minWidth`, `fade`; renders `.tblscroll` role=region tabIndex=0
- `src/features/cx-desk/components/mail-desk-page.tsx:456` | house pattern: `<TableScroll label="..." minWidth="44rem">` around a `.cx-table`
- `src/app/cx-kit.css:612-614` | `:root .tblscroll { overflow-x: auto; position: relative }` + `--fade` variant already exist
- `src/features/cx-queue/components/queue-page.tsx:141-142` | `const h = useRef(...); useSweep(h)` — the `.cc-chart` div keeps `ref={h}` (sweep observer)

### Contract
Inside `<div className="cc-chart" ref={h}>`, wrap ONLY the `<table className="cx-table">…</table>`
in `<TableScroll label="By queue" minWidth="52rem" fade>`. Add `TableScroll` to the
existing `'@/features/shared/components/ui'` import on :8. Do not move/remove
`ref={h}`, do not alter the table's columns/head/body, do not touch any CSS file.
Out of scope: everything else in queue-page.tsx; `.cc-chart` clip rules; other routes.

### Actions
1. Add `TableScroll` to the named import from `'@/features/shared/components/ui'` (:8).
2. Wrap the `table.cx-table` block inside `.cc-chart` (:278-…`</div>`) in `<TableScroll label="By queue" minWidth="52rem" fade>`; keep `ref={h}` on `.cc-chart`.
3. Run Verify checks; write results/ux1-02.md.

### Done when
- `npx tsc --noEmit` exit 0; `npx eslint src/features/cx-queue/components/queue-page.tsx` 0 errors.
- File contains `<TableScroll label="By queue"` around `table.cx-table` and still `ref={h}` on `.cc-chart`.
- No edits outside the listed file/regions.

### Verify
- Run: `npx tsc --noEmit` -> exit 0.
- Run: `npx eslint src/features/cx-queue/components/queue-page.tsx` -> 0 errors.

### Handoff
/queue table scroll is a labelled keyboard-reachable region; ux-4 closed pending
reviewer re-render. Write results/ux1-02.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-03: anchor sr-only boxes inside scrollable ladder segs (ux-5 MED)
Kind: mini
ID: ux1-03
Parent: ux-1 (ux-5 MED, reports/ux-1.md)
Owner: dev
Depends: none
Status: ready
Criteria: PLAN #5 — fixes pass gates; WCAG 1.4.10 phantom-scroll fix
Skills: none
Budget: files=1; actions=2; changed_lines=4; minutes=4

### Goal
/overview @390 loses its phantom 84px page scroll (scrollWidth 474): absolutely
positioned `.cx-sr`/`.sr-only` spans inside `.cx-ladder__seg` anchor to their
seg instead of escaping to the initial containing block mid-scrollport.

### Files
- Edit: `src/app/cx-kit.css` | `:root .cx-sr, :root .sr-only` rule (:653-660) + `:root .cx-ladder__seg` rule (:685-699)

### Context
- `src/app/cx-kit.css:653-660` | `.cx-sr`/`.sr-only` is `position:absolute` with no inset — sits at static position
- `src/app/cx-kit.css:685-699` | `.cx-ladder__seg` is `position:static` — abspos children escape to ICB, bypassing `.cc-chart:has(.cx-ladder){overflow-x:auto}` (:706)
- `src/features/cx-hub/components/hub-shared.tsx:495` | `<span className="sr-only">{name}</span>` inside a ladder seg (also :267,:524)
- `reports/ux-1.md` ux-5 | exact fix prescribed by reviewer

### Contract
Two additive declarations, nothing else: add `inset-inline-start: 0;` to
`:root .cx-sr, :root .sr-only` (:653-660) AND add `position: relative;` to
`:root .cx-ladder__seg` (:685-699). No selector edits, no rule moves, no other
declaration changes. Out of scope: any .tsx; the `.cc-chart:has(.cx-ladder)`
rule; media-query overrides.

### Actions
1. Add `inset-inline-start: 0;` inside the `:root .cx-sr, :root .sr-only` block.
2. Add `position: relative;` inside the `:root .cx-ladder__seg` block; run Verify; write results/ux1-03.md.

### Done when
- Both declarations present in cx-kit.css (grep shows `inset-inline-start` in the cx-sr rule and `position: relative` in the seg rule).
- `npx tsc --noEmit` exit 0 (repo still compiles); diff touches only cx-kit.css.

### Verify
- Run: `npx tsc --noEmit` -> exit 0.
- Run: `git diff --stat -- src/app/cx-kit.css` -> only additive declaration lines.

### Handoff
sr-only clip boxes anchor to their containing block app-wide; ux-5 closed pending
reviewer re-render. Write results/ux1-03.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-04: delete zero-consumer NotConnected (ux-6 MED)
Kind: mini
ID: ux1-04
Parent: ux-1 (ux-6 MED, reports/ux-1.md)
Owner: dev
Depends: none
Status: ready
Criteria: PLAN #5 — fixes pass gates; DECISION "delete zero-value wrappers"
Skills: none
Budget: files=2; actions=3; changed_lines=55; minutes=5

### Goal
Resolve the half-landed HUB-H2 primitive: `NotConnected` has zero src consumers.
Per DECISION "delete zero-value wrappers", remove the component and its barrel
export so `grep NotConnected src/` returns nothing.

### Files
- Edit: `src/features/shared/components/ui/index.ts` | remove the two NotConnected lines (:77-78)
- Edit: `src/features/shared/components/ui/NotConnected.tsx` | delete the file

### Context
- `reports/ux-1.md` ux-6 | "adopt … or drop the export" — adoption evaluated and rejected: the only two candidate sites are a toast string (ecosystem-page.tsx:128 `t('That app is not connected yet…')`) and an inline `field-hint` `<p>` (admin-page.tsx:257); neither is the `.cx-empty` panel shape NotConnected renders
- `src/features/shared/components/ui/NotConnected.tsx` | `.cx-not-connected*` classes have ZERO CSS rules src-wide (grep verified) — no stylesheet cleanup needed
- `DECISION.md` module homes | "delete zero-value wrappers" clause

### Contract
Delete `NotConnected.tsx` outright (it is untracked-era new code with zero
consumers) and remove `export { NotConnected }` + `export type { NotConnectedProps }`
from ui/index.ts. Do NOT touch ecosystem-page.tsx, admin-page.tsx, or any other
file. Out of scope: adopting the component anywhere; other barrel exports.

### Actions
1. Remove the NotConnected export + type export lines from ui/index.ts (:77-78).
2. Delete `src/features/shared/components/ui/NotConnected.tsx`.
3. Run Verify checks (incl. zero-hit grep); write results/ux1-04.md.

### Done when
- `grep -rn "NotConnected" src/ tests/ e2e/` -> 0 hits.
- `npx tsc --noEmit` exit 0; `npx eslint src/features/shared/components/ui/index.ts` 0 errors.

### Verify
- Run: `npx tsc --noEmit` -> exit 0.
- Run: `npx eslint src/features/shared/components/ui/index.ts` -> 0 errors.

### Handoff
ux-6 closed via the DECISION-sanctioned drop path; barrel no longer ships a dead
primitive. Write results/ux1-04.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-05: drop aria-orientation from Tabs tabpanel (ux-7 LOW)
Kind: mini
ID: ux1-05
Parent: ux-1 (ux-7 LOW, reports/ux-1.md)
Owner: dev
Depends: none
Status: ready
Criteria: PLAN #5 — fixes pass gates; APG-valid markup (validator noise)
Skills: none
Budget: files=1; actions=2; changed_lines=2; minutes=3

### Goal
`role="tabpanel"` no longer carries `aria-orientation` (not an APG-supported
attribute on tabpanel); the attribute stays on `role="tablist"`.

### Files
- Edit: `src/features/shared/components/ui/Tabs.tsx` | :106 `aria-orientation="horizontal"` on the tabpanel div

### Context
- `src/features/shared/components/ui/Tabs.tsx:75-112` | tablist keeps `aria-orientation` (:79); only the tabpanel copy (:106) goes
- `reports/ux-1.md` ux-7 | "drop the attribute on the panel; keep it on role=tablist"
- tests | no test or golden asserts `aria-orientation`/`tabpanel` (grep verified)

### Contract
Delete exactly the `aria-orientation="horizontal"` prop on the `role="tabpanel"`
div (:106). One prop, one file. Out of scope: the tablist attribute, other Tabs
behaviour (roving tabindex, keys, aria-selected), test files.

### Actions
1. Remove `aria-orientation="horizontal"` from the tabpanel div (:106).
2. Run Verify checks; write results/ux1-05.md.

### Done when
- `npx vitest run tests/ui/tabs.test.tsx` all pass; `npx tsc --noEmit` exit 0.
- Tablist (:79) still has `aria-orientation`; tabpanel has none; no other diff.

### Verify
- Run: `npx vitest run tests/ui/tabs.test.tsx` -> all pass.
- Run: `npx tsc --noEmit` -> exit 0.

### Handoff
ux-7 closed; APG-clean tabpanel. Write results/ux1-05.md (<=10 lines); TL alone
updates TRACKER.md.

## ux1-06: cx-empty paragraph margin + in-panel variant (ux-2 LOW)
Kind: mini
ID: ux1-06
Parent: ux-1 (ux-2 LOW, reports/ux-1.md — carried, blocking)
Owner: dev
Depends: ux1-03 (same file cx-kit.css — serial)
Status: ready
Criteria: PLAN #5 — fixes pass gates; box-in-box empty state fix
Skills: none
Budget: files=1; actions=2; changed_lines=6; minutes=4

### Goal
`.cx-empty` inside `.cx-panel` stops rendering box-in-box (double border/background),
and `.cx-empty p` text gets its margin reset + 34ch measure back.

### Files
- Edit: `src/app/cx-kit.css` | add two rules immediately after the `.cx-empty` block (:804-819)

### Context
- `src/app/cx-kit.css:804-819` | `.cx-empty` rule + `.cx-icon`/`strong` children — append the new rules right after :819
- `reports/ux-1.md` ux-2 | prescribes `:root .cx-empty p{margin:0;max-width:34ch}` and `:root .cx-panel > .cx-empty{border:0;background:transparent}`
- `src/features/cx-quality/components/audit-queue-page.tsx:364-365` + `src/features/cx-people/components/my-actions-page.tsx:140-141` | the in-panel `.cx-empty` sites the variant heals

### Contract
Add exactly two rules after the `.cx-empty` family (:819):
`:root .cx-empty p { margin: 0; max-width: 34ch; }` and
`:root .cx-panel > .cx-empty { border: 0; background: transparent; }`.
Additive only — edit no existing declaration/selector. Out of scope: any .tsx;
`.cx-panel` itself; other sheets.

### Actions
1. Insert `:root .cx-empty p { margin: 0; max-width: 34ch; }` after :819.
2. Insert `:root .cx-panel > .cx-empty { border: 0; background: transparent; }` next; run Verify; write results/ux1-06.md.

### Done when
- Both rules present verbatim in cx-kit.css after the `.cx-empty` family.
- `npx tsc --noEmit` exit 0; diff touches only cx-kit.css.

### Verify
- Run: `npx tsc --noEmit` -> exit 0.
- Run: `git diff --stat -- src/app/cx-kit.css` -> only the two additive rules.

### Handoff
ux-2 closed pending reviewer re-render; Empty in panels renders flat.
Write results/ux1-06.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-07: trk-outside chip dot back to currentColor (ux-3 LOW)
Kind: mini
ID: ux1-07
Parent: ux-1 (ux-3 LOW, reports/ux-1.md — carried, blocking)
Owner: dev
Depends: none
Status: ready
Criteria: PLAN #5 — fixes pass gates; legacy `.pill::before` parity
Skills: none
Budget: files=1; actions=2; changed_lines=3; minutes=4

### Goal
The grey dashed "Entered in the sheet" chip on /trackers shows a grey
(currentColor) dot again — not the info-blue `--st-edge` dot `.cx-chip::before`
now resolves.

### Files
- Edit: `src/app/styles/operations.css` | add one rule after `.trk-outside` (:26)

### Context
- `src/app/styles/operations.css:26` | `[data-app="operations"] .trk-outside {…}` — the grey dashed override skin
- `src/app/cx-kit.css:787` | `:root .cx-chip::before { … background: var(--st-edge, var(--cx-ink-3)) }` — the blue dot it must beat
- `src/features/cx-operations/components/trackers-page.tsx:732` | `<Chip status="info" className="trk-outside">` — the single site
- `reports/ux-1.md` ux-3 | prescribes `.trk-outside::before{background:currentColor}`

### Contract
Add `[data-app="operations"] .cx-chip.trk-outside::before { background: currentColor; }`
directly after the `.trk-outside` rule (:26). The `.cx-chip.trk-outside` compound
(0,3,0) beats `:root .cx-chip::before` (0,2,0) regardless of sheet order — do NOT
use bare `.trk-outside::before` (ties on specificity, order-dependent). Additive
only. Out of scope: trackers-page.tsx, Chip.tsx, other operations rules.

### Actions
1. Insert the `[data-app="operations"] .cx-chip.trk-outside::before` rule after :26.
2. Run Verify checks; write results/ux1-07.md.

### Done when
- The compound-selector rule exists in operations.css; `.cx-chip::before` untouched.
- `npx tsc --noEmit` exit 0; diff touches only operations.css.

### Verify
- Run: `npx tsc --noEmit` -> exit 0.
- Run: `git diff --stat -- src/app/styles/operations.css` -> only the additive rule.

### Handoff
ux-3 closed pending reviewer re-render; chip skin parity with legacy `.pill`.
Write results/ux1-07.md (<=10 lines); TL alone updates TRACKER.md.
