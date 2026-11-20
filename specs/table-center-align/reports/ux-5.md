# ux report - table-center-align - round 9 (DELTA vs reports/ux-4.md residual)

Verdict: PASS
Open: 0B/0H/0M/0L
States checked: per-row variant flips (chip vs text), cascade/specificity across `cx-kit.css` + `refresh.css`, bare-table coverage. Not verified: live render/screenshots.

Scope reviewed: `cx-kit.css:662` (widened `td.cx-txt` opt-out), `tests/css/table-center-align.test.ts:141-148` (updated regex + source-order assertion), `trackers-page.tsx:699-731` (the `.trk-table` "Added by" cell), `refresh.css:566-574` (`.trk-table` base rules).

## Prior findings — verification

| ID | Status | Evidence |
|---|---|---|
| ux-4 (LOW) trackers "Added by" residual | FIXED | `cx-kit.css:662` now `:root :is(.cx-table, table) td.cx-txt { text-align: start }`. `.trk-table` is a bare `<table>` (trackers-page:699) so `table` in `:is()` matches; specificity (0,3,1) ties the chip rule (:661) and is declared after → opt-out wins. Chip rows ("Entered in the sheet", :724) now stay start-aligned like the name+`trk-when` rows (:727-728) — per-row flip resolved. |

## Open

None.

## Verified OK (delta)

- Cascade chain re-checked end-to-end: `refresh.css:567` `:root .trk-table td { text-align:start }` (0,2,1) < chip rule (0,3,1) = `td.cx-txt` (0,3,1, later). Both branches of the cell render start-aligned; `.trk-by span{display:block}` (operations.css:24) stacking unaffected.
- No overreach: the widened selector is dormant everywhere else — all 8 other `cx-txt` sites sit inside `.cx-table` (grep src, 9 total), and non-`.cx-table` bare tables (`.dk-table`, `.oo-table`, `.sch-table`, `.hm-grid`, `.md-table`) contain no `cx-txt` cells. Chip-primary cells untouched.
- `text-align: start` is logical — RTL safe; consistent with the base rule at cx-kit.css:644.
- Header alignment unchanged: `.trk-table thead th` centered by both refresh.css:570 and cx-kit.css:659 — consistent.
- Tests: `vitest run tests/css/table-center-align.test.ts` → exit=0, 22/22 pass (regex at test:143 matches literal `:root :is(.cx-table, table) td.cx-txt`; source-order assertion test:144-147 holds, 661<662).
- Web Interface Guidelines (fetched): semantic `<table>`/`<td>` retained; no focus/motion/color/interaction changes in this delta — no applicable violations.

## Not verified / assumptions

- No runtime screenshots; alignment judged from cascade math and DOM markup (both branches confirmed in source).
- Foreign dirty-tree edits still present repo-wide — outside this task's leaves, not reviewed.
