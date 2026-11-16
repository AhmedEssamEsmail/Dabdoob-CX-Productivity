# fix-debug-1 — holform-overlap-sweep

Fixes for blocking findings in `reports/debug-1.md` (13 sites, one root cause:
missing scoped `min-inline-size:0` control guard on grid/flex form rows).
Convention to copy (canonical): `src/app/styles/quality.css:144`
`<row> :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
Regression test (already exists, do NOT edit): `tests/css-form-guards.test.ts` —
each site has one `it` check; all 13 site checks must end green, 9 anchor checks must stay green.
CSS-only. No markup, no selector renames, no track/breakpoint changes.

## dbg1-01: guard refresh.css form rows (.dq-holform, .dq-editor, .aging-page-head .page-actions)
Kind: mini
ID: dbg1-01
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #1, #2, #3 (findings dbg-1, dbg-2, dbg-12)
Skills: none
Budget: files=1; actions=3; changed_lines=40; minutes=6

### Goal
Add the scoped control-shrink guard to the three unguarded form rows in `src/app/refresh.css` so hosted inputs/selects cannot overflow their grid tracks into sibling buttons.

### Files
- Edit: `src/app/refresh.css` | add one guard rule per site (sites at ~:30, ~:541-548)

### Context
- `specs/holform-overlap-sweep/reports/debug-1.md` rows dbg-1, dbg-2, dbg-12 | exact fix + evidence
- `src/app/styles/quality.css:144` | canonical guard shape; this file uses the `:root` prefix convention
- `src/app/refresh.css:29-38` | `.aging-page-head .page-actions` rules (`:root` convention, one-line rules)
- `src/app/refresh.css:541-548` | `.dq-editor` / `.dq-holform` rules + 900px collapse

### Contract
Insert (adjacent to each site's existing rules, matching file style):
`:root .dq-holform :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`:root .dq-editor :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`:root .aging-page-head .page-actions :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
Out of scope: every other file/rule; `.dq-days`; markup; test file; breakpoints; grid-template-columns values.

### Actions
1. Add the `.dq-holform` guard rule next to `.dq-holform` (~:545).
2. Add the `.dq-editor` guard rule next to `.dq-editor` (~:541).
3. Add the `.aging-page-head .page-actions` guard rule after the `.page-actions` rules (~:34).

### Done when
- All three guard rules exist exactly as specified above.
- `npx vitest run tests/css-form-guards.test.ts`: checks containing `dq-holform`, `dq-editor`, `aging-page-head` pass; all 9 `stays guarded` anchor checks still pass (other sites may still fail — sibling leaves own them).
- No other line in the file changed.

### Verify
- Run: `npx vitest run tests/css-form-guards.test.ts -t "dq-holform|dq-editor|aging-page-head"` -> 3 passing

### Handoff
None. Write results/dbg1-01.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-02: guard people.css form rows (.pw-new-action, .pw-inline, .oo-proj-grid)
Kind: mini
ID: dbg1-02
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #2 (findings dbg-3, dbg-7, dbg-8)
Skills: none
Budget: files=1; actions=3; changed_lines=40; minutes=6

### Goal
Add the scoped control-shrink guard to the three unguarded form rows in `src/app/styles/people.css`.

### Files
- Edit: `src/app/styles/people.css` | add one guard rule per site (sites at :30, :57, :226)

### Context
- `specs/holform-overlap-sweep/reports/debug-1.md` rows dbg-3, dbg-7, dbg-8 | exact fix + evidence
- `src/app/styles/quality.css:144` | canonical guard shape; this file uses the `[data-app="people"]` prefix convention
- `src/app/styles/people.css:30-33` | `.pw-inline` flex rows + 720px collapse
- `src/app/styles/people.css:57-59,226` | `.pw-new-action` grid + collapse; `.oo-proj-grid`
- `src/app/styles/people.css:220-221` | `.oo-period-custom` guarded anchor — do not touch

### Contract
Insert (adjacent to each site's existing rules, matching file style):
`[data-app="people"] .pw-new-action :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`[data-app="people"] .pw-inline :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`[data-app="people"] .oo-proj-grid :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
Out of scope: every other file/rule; `.oo-period-custom`; markup; test file; breakpoints; flex/track values (keep `.pw-inline .field` 8rem bound as-is).

### Actions
1. Add the `.pw-new-action` guard rule after :57 rule.
2. Add the `.pw-inline` guard rule after :31 rule.
3. Add the `.oo-proj-grid` guard rule after :226 rule.

### Done when
- All three guard rules exist exactly as specified above.
- `npx vitest run tests/css-form-guards.test.ts`: checks containing `pw-new-action`, `pw-inline`, `oo-proj-grid` pass; all 9 anchor checks still pass including `oo-period-custom` (other sites may still fail — sibling leaves own them).
- No other line in the file changed.

### Verify
- Run: `npx vitest run tests/css-form-guards.test.ts -t "pw-new-action|pw-inline|oo-proj-grid|oo-period-custom"` -> 4 passing

### Handoff
None. Write results/dbg1-02.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-03: guard styles/*.css form rows (.qa-bq, .sch-edit-row, .trk-dep-row, .tph-taskform)
Kind: mini
ID: dbg1-03
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #2 (findings dbg-4, dbg-5, dbg-6, dbg-13)
Skills: none
Budget: files=4; actions=4; changed_lines=50; minutes=8

### Goal
Add the scoped control-shrink guard to four unguarded form rows, one per stylesheet, each under its `[data-app="…"]` prefix convention.

### Files
- Edit: `src/app/styles/quality.css` | `.qa-bq` guard (site at :93)
- Edit: `src/app/styles/queue.css` | `.sch-edit-row` guard (site at :214)
- Edit: `src/app/styles/operations.css` | `.trk-dep-row` guard (site at :53)
- Edit: `src/app/styles/productivity.css` | `.tph-taskform` guard (site at :116)

### Context
- `specs/holform-overlap-sweep/reports/debug-1.md` rows dbg-4, dbg-5, dbg-6, dbg-13 | exact fix + evidence
- `src/app/styles/quality.css:144` | canonical guard shape and this file's `[data-app="quality"]` convention
- `src/app/styles/productivity.css:116-117` | `.tph-taskform` + its 9rem `.cx-field` bound (keep bound as-is)

### Contract
Insert (adjacent to each site's existing rules, matching file style):
`[data-app="quality"] .qa-bq :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`[data-app="queue"] .sch-edit-row :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`[data-app="operations"] .trk-dep-row :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`[data-app="productivity"] .tph-taskform :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
Out of scope: every other file/rule; existing `.qa-*` guards and `.hm-num`; markup; test file; breakpoints; track/flex values.

### Actions
1. Add the `.qa-bq` guard rule after quality.css:93 rule.
2. Add the `.sch-edit-row` guard rule after queue.css:214 rule.
3. Add the `.trk-dep-row` guard rule after operations.css:53 rule.
4. Add the `.tph-taskform` guard rule after productivity.css:117 rule.

### Done when
- All four guard rules exist exactly as specified above.
- `npx vitest run tests/css-form-guards.test.ts`: checks containing `qa-bq`, `sch-edit-row`, `trk-dep-row`, `tph-taskform` pass; all 9 anchor checks still pass (other sites may still fail — sibling leaves own them).
- No other line in any file changed.

### Verify
- Run: `npx vitest run tests/css-form-guards.test.ts -t "qa-bq|sch-edit-row|trk-dep-row|tph-taskform|qa-|hm-num"` -> 10 passing (4 sites + 6 anchors in these files)

### Handoff
None. Write results/dbg1-03.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-04: guard cx-kit.css + desk.css form rows (.cx-queuerow, .cx-filters, .dk-otd__grid)
Kind: mini
ID: dbg1-04
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #2 (findings dbg-9, dbg-10, dbg-11)
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=6

### Goal
Add the scoped control-shrink guard to `.cx-queuerow` and `.cx-filters` in `src/app/cx-kit.css`, and extend the existing `.dk-otd__grid` control rule in `src/app/styles/desk.css`.

### Files
- Edit: `src/app/cx-kit.css` | two new guard rules (sites at :587, :765-793)
- Edit: `src/app/styles/desk.css` | extend existing multi-selector rule at :79

### Context
- `specs/holform-overlap-sweep/reports/debug-1.md` rows dbg-9, dbg-10, dbg-11 | exact fix + evidence
- `src/app/styles/quality.css:144` | canonical guard shape; cx-kit.css uses the `:root` prefix convention
- `src/app/cx-kit.css:587-589,765-793` | `.cx-filters` bar; `.cx-queuerow` + its ≤1180px collapses
- `src/app/styles/desk.css:78-79` | `.dk-otd__grid` 110px tracks + existing `.input/.cx-input` rule to extend

### Contract
Insert in cx-kit.css (adjacent to each site's rules, matching file style):
`:root .cx-queuerow :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
`:root .cx-filters :is(input:not([type=checkbox]):not([type=radio]),select,textarea) { box-sizing:border-box;min-inline-size:0;max-inline-size:100% }`
In desk.css append to the existing :79 declaration block (which also covers `.dk-kb-form` controls — intended, per report):
`box-sizing:border-box;min-inline-size:0;max-inline-size:100%`
Out of scope: every other file/rule; `.cx-settings-section` and other guarded rules; markup; test file; breakpoints; track values (keep 110px density).

### Actions
1. Add the `.cx-filters` guard rule after cx-kit.css:587-589 block.
2. Add the `.cx-queuerow` guard rule after the `.cx-queuerow` base block (~:773).
3. Extend the desk.css:79 rule's declaration with `box-sizing:border-box;min-inline-size:0;max-inline-size:100%`.

### Done when
- Both cx-kit.css guard rules and the desk.css:79 extension exist exactly as specified.
- `npx vitest run tests/css-form-guards.test.ts`: checks containing `cx-queuerow`, `cx-filters`, `dk-otd__grid` pass; all 9 anchor checks still pass including `cx-settings-section` (other sites may still fail — sibling leaves own them).
- No other line in either file changed.

### Verify
- Run: `npx vitest run tests/css-form-guards.test.ts -t "cx-queuerow|cx-filters|dk-otd__grid|cx-settings-section"` -> 4 passing

### Handoff
None. Write results/dbg1-04.md (<=10 lines); TL alone updates TRACKER.md.
