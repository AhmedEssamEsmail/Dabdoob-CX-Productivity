# FIX leaves for reports/qa-2.md (table-center-align)

## qa2-01: restore .sch-table thead th padding
Kind: mini
ID: qa2-01
Parent: qa-3
Owner: dev
Depends: none
Criteria: PLAN non-goal "no layout/spacing change" / reports/qa-2.md finding qa-3 (MED)
Skills: none
Budget: files=2; actions=3; changed_lines=15; minutes=6

### Goal
`.sch-table` thead `<th>` cells get `padding: var(--cx-space-2) var(--cx-space-3)`
again (pre-change value), matching tbody cells; alignment rules stay as-is.

### Files
- Edit: `src/app/styles/queue.css` | add one rule after line 162
- Edit: `tests/css/table-center-align.test.ts` | add one assertion block

### Context
- `src/app/styles/queue.css:161-162` | :161 sets all `.sch-table` th/td to
  `padding: var(--cx-space-1)`; :162 overrides tbody only — thead th regressed
- `reports/qa-2.md` | finding qa-3 with exact suggested fix wording
- `tests/css/table-center-align.test.ts` | existing regex-guard suite style

### Contract
Add `[data-app="queue"] .sch-table thead th { padding: var(--cx-space-2) var(--cx-space-3) }`
immediately after the line-162 rule. Specificity (0,2,2) beats :161 (0,2,1);
no `text-align` in the new rule — thead stays centered via :161.
Out of scope: `scope="col"` additions (qa-2, deferred), any other file/rule,
markup changes, `.sch-grid-table` styles.

### Actions
1. In queue.css insert the thead-th padding rule after the tbody rule (~:163).
2. In tests/css/table-center-align.test.ts add a regex guard asserting queue.css
   contains a `.sch-table thead th` rule with the space-2/space-3 padding.
3. Run the targeted test file.

### Done when
- thead-th padding rule present; tbody rule and all other rules untouched
- new assertion passes; existing 13 tests still pass
- `npx eslint src/app/styles/queue.css tests/css/table-center-align.test.ts` -> 0 errors

### Verify
- Run: `npx vitest run tests/css/table-center-align.test.ts` -> exit 0, all pass

### Handoff
Write results/qa2-01.md (<=10 lines); TL alone updates TRACKER.md.
