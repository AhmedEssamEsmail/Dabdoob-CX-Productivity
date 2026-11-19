# FIX leaves for reports/ux-1.md (table-center-align)

Blocking findings routed: ux-1 (MED), ux-2 (MED), ux-3 (LOW — PM intent call:
user wants ALL column headers centered, so the sticky corner header centers).
Deferred per LOW policy: ux-4 (aging colSpan), ux-5 (scope="col" x3).

## ux1-01: add .trk-num to the cx-kit numeric-cell centering selector
Kind: mini
ID: ux1-01
Parent: ux-1
Owner: dev
Depends: none
Criteria: PLAN #5 / reports/ux-1.md finding ux-1 (MED)
Skills: none
Budget: files=2; actions=3; changed_lines=15; minutes=6

### Goal
`/trackers` records-table cells carrying `.trk-num` (td at
trackers-page.tsx:689, th at :703) center like every other numeric cell; the
input rule at operations.css:76 is untouched because the selector only matches
`td`/`tbody th`.

### Files
- Edit: `src/app/cx-kit.css` | the `:is(td, tbody th):is(...)` rule at ~line 660
- Edit: `tests/css/table-center-align.test.ts` | the numeric-cell assertion ~line 33-38

### Context
- `src/app/cx-kit.css:655-665` | numeric centering rule `:is(td, tbody th):is(.cx-num, .num, .cx-num-col)`
- `src/features/cx-operations/components/trackers-page.tsx:685-705` | `trk-num` on td/th
- `reports/ux-1.md` | finding ux-1 evidence and suggested fix

### Contract
`td.trk-num` and `th.trk-num` are caught by the numeric-cell centering rule;
`.input.trk-num` (operations.css:76) is unaffected; no other selector changes.
Out of scope: any markup change, trackers-page.tsx edits, other css files.

### Actions
1. In cx-kit.css add `.trk-num` to the `:is()` class list in the numeric-cell
   rule (keep the existing `td, tbody th` element guard unchanged).
2. In tests/css/table-center-align.test.ts update the numeric-cell regex
   assertion (~line 36) to expect `.trk-num` in the `:is()` list.
3. Run the targeted test file.

### Done when
- cx-kit.css numeric rule lists `.trk-num`; element guard still `td, tbody th`
- updated assertion passes; all other tests in the file still pass
- `npx eslint src/app/cx-kit.css tests/css/table-center-align.test.ts` -> 0 errors

### Verify
- Run: `npx vitest run tests/css/table-center-align.test.ts` -> exit 0

### Handoff
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-02: center the status chip cell on aging-page
Kind: mini
ID: ux1-02
Parent: ux-2
Owner: dev
Depends: none
Criteria: PLAN #5 / reports/ux-1.md finding ux-2 (MED)
Skills: none
Budget: files=1; actions=2; changed_lines=4; minutes=4

### Goal
The "Status" column `<td>` holding the `<span className="cx-chip">` count
(aging-page.tsx ~line 303) centers under the now-centered header, matching the
adjacent `cx-num` Age cell.

### Files
- Edit: `src/features/cx-queue/components/aging-page.tsx` | the cx-chip td only

### Context
- `src/features/cx-queue/components/aging-page.tsx:298-310` | row cells; chip td
  has no class, neighbors show the `cx-num`/`cx-muted` convention
- `reports/ux-1.md` | finding ux-2 evidence and suggested fix

### Contract
`<td className="cx-num"><span className="cx-chip" ...>` — class added, nothing
else changes (span props, siblings, colSpan empty-state all untouched).
Out of scope: ux-4 colSpan fix (deferred LOW), any other file/rule.

### Actions
1. Add `className="cx-num"` to the td wrapping `cx-chip` (~line 303).
2. Run the targeted css test file to confirm no regression.

### Done when
- chip td carries `cx-num`; no other edits in the file
- `npx eslint src/features/cx-queue/components/aging-page.tsx` -> 0 errors

### Verify
- Run: `npx vitest run tests/css/table-center-align.test.ts` -> exit 0

### Handoff
Write results/ux1-02.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-03: let the .sch-sticky corner header center, keep tbody sticky cells start
Kind: mini
ID: ux1-03
Parent: ux-3
Owner: dev
Depends: ux1-01 (shares tests/css/table-center-align.test.ts)
Criteria: PLAN #5 / reports/ux-1.md finding ux-3 (PM decision: center it)
Skills: none
Budget: files=2; actions=4; changed_lines=20; minutes=7

### Goal
The `scope="col"` `.sch-sticky` "Team lead" corner header
(scheduler-page.tsx:650) centers like all other column headers, while tbody
`.sch-sticky` row-label cells keep forced `text-align: start`.

### Files
- Edit: `src/app/styles/queue.css` | `.sch-sticky` rule at ~line 164
- Edit: `tests/css/table-center-align.test.ts` | the `.sch-sticky` guard ~line 80-84

### Context
- `src/app/styles/queue.css:160-166` | line 161 centers `.sch-grid-table`/`.sch-table`
  cells; line 164 `.sch-sticky { ... text-align: start !important; ... }`
- `src/features/cx-queue/components/scheduler-page.tsx:648-655` | thead
  `th.sch-sticky`; tbody sticky row labels elsewhere in the file
- `reports/ux-1.md` | finding ux-3 and PM intent (center ALL headers)

### Contract
Do NOT just delete `!important`: `[data-app="queue"] .sch-grid-table td`
(specificity 0,2,1) would then beat `.sch-sticky` (0,2,0) and wrongly center
tbody sticky labels. Required shape: remove `text-align: start !important;`
from the base `[data-app="queue"] .sch-sticky` rule (keep position/background/
padding/z-index there) and add `[data-app="queue"] tbody .sch-sticky { text-align: start !important; }`.
Out of scope: padding-inline, white-space, markup, any other file/rule.

### Actions
1. In queue.css remove the `text-align: start !important;` declaration from the
   base `.sch-sticky` rule only.
2. Add `[data-app="queue"] tbody .sch-sticky { text-align: start !important; }`
   immediately after it.
3. Update the test-file `.sch-sticky` guard to assert the `tbody .sch-sticky`
   rule carries `text-align: start !important` and the base `.sch-sticky` rule
   body no longer declares `text-align` (regex capture style of the suite).
4. Run the targeted test file.

### Done when
- base `.sch-sticky` rule has no `text-align`; `tbody .sch-sticky` rule keeps
  `text-align: start !important`; no other rule touched
- updated guard passes; all other tests in the file still pass
- `npx eslint src/app/styles/queue.css tests/css/table-center-align.test.ts` -> 0 errors

### Verify
- Run: `npx vitest run tests/css/table-center-align.test.ts` -> exit 0

### Handoff
Write results/ux1-03.md (<=10 lines); TL alone updates TRACKER.md.
