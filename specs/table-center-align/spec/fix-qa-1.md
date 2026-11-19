# FIX leaves for reports/qa-1.md (table-center-align)

## qa1-01: restore start alignment on .sch-table tbody row-label th
Kind: mini
ID: qa1-01
Parent: qa-1
Owner: dev
Depends: none
Criteria: PLAN #5 / reports/qa-1.md finding qa-1 (HIGH)
Skills: none
Budget: files=2; actions=3; changed_lines=30; minutes=8

### Goal
`.sch-table` tbody row-label `<th scope="row">` cells (TL/agent/day names in
scheduler-page.tsx:159,274,491) render `text-align: start` again while thead
`th`s stay centered; regression test guards the rule.

### Files
- Edit: `src/app/styles/queue.css` | rule at ~line 162 only
- Edit: `tests/css/table-center-align.test.ts` | add one assertion block

### Context
- `src/app/styles/queue.css:160-163` | line 161 centers `.sch-table th`; line 162
  restores start only on `td`; `.sch-sticky` (:163) has `!important` start already
- `src/features/cx-queue/components/scheduler-page.tsx:155-165,270-280,488-495` |
  tbody `<th scope="row">` labels with no sch-sticky class
- `reports/qa-1.md` | finding qa-1 and suggested fix wording

### Contract
Restore the pre-change behaviour: tbody cells (th and td) in `.sch-table` are
start-aligned with the same padding the td rule already sets; thead `th`s and
`.sch-grid-table` remain untouched and centered.
Out of scope: `scope="col"` additions (finding qa-2, deferred), any other file,
any markup change in scheduler-page.tsx, `.sch-grid-table` styles.

### Actions
1. In queue.css change the line-162 rule to target
   `[data-app="queue"] .sch-table tbody :is(th, td)` keeping `text-align: start`
   and the existing `padding: var(--cx-space-2) var(--cx-space-3)` (or add a
   `.sch-table tbody th { text-align: start }` rule — first form preferred).
2. In tests/css/table-center-align.test.ts add an assertion that queue.css
   contains a `.sch-table tbody` rule with `text-align: start` covering `th`
   (regex guard matching existing suite style).
3. Run the targeted test file.

### Done when
- queue.css tbody-th rule present; thead still centered; no other rules touched
- new test assertion passes; existing 12 tests still pass
- `npx eslint src/app/styles/queue.css tests/css/table-center-align.test.ts` -> 0 errors

### Verify
- Run: `npx vitest run tests/css/table-center-align.test.ts` -> exit 0, all pass

### Handoff
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
