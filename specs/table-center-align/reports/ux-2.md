# ux report - table-center-align - round 2 (DELTA)
Verdict: PASS
Open: 0/0/0/2

States checked: re-verified only the delta (alignment class plumbing + selector scope). loading/empty/error/success/disabled/long text/mobile/dark/keyboard/focus unchanged from ux-1 — no new layout, color, or interactive properties introduced.

Delta verification (tl-4 fix round):
- **ux-1 (MED) — CLOSED.** cx-kit.css:660 selector is now `:is(td, tbody th):is(.cx-num, .num, .cx-num-col, .trk-num)`. `td.trk-num` (trackers-page.tsx:689) centers to match `th.trk-num` (:703, via :659). The `td`/`tbody th` element guard means `.input.trk-num` / `.cx-input.trk-num` (operations.css:76, `text-align:end` on input elements) is unreachable — numeric inputs keep end alignment per PLAN scope-out.
- **ux-2 (MED) — CLOSED.** aging-page.tsx:303 td now carries `cx-num`; the count chip centers under the centered "Status" header, matching the adjacent Age column.
- **ux-3 (LOW→fixed) — CLOSED.** queue.css:164 base `.sch-sticky` no longer declares text-align; new :165 `[data-app="queue"] tbody .sch-sticky { text-align: start !important }`. The thead corner `th.sch-sticky` (scheduler-page.tsx:650, scope="col") now centers — every column header satisfies the acceptance — while tbody sticky row labels stay forced start (the `!important` correctly beats `.sch-grid-table td`'s center; removing it outright would have broken row labels, so the scoped form is the right fix).
- Test file updated consistently: asserts `.trk-num` in the `:is()` list, base `.sch-sticky` free of text-align, and tbody-scoped `!important`. No contradictions with the shipped CSS.

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-4 | LOW | aging-page.tsx:309 | Still `colSpan={9}` vs 8 headers when `n.scope === 'agent'` (pre-existing; TL-deferred per FIX LOW policy). Harmless clamp, logged only. | `colSpan={n.scope !== 'agent' ? 9 : 8}` | dev |
| ux-5 | LOW | aging-page.tsx:214, heatmap-page.tsx:802-807 | `thead th` without `scope="col"` still present at both sites (aging "Queue" th has redundant inline `textAlign:'center'` — harmless). queue-page.tsx:294 now has `scope="col"` — that portion resolved. | Add `scope="col"` to remaining thead th's. | dev |

Not verified / assumptions:
- No rendered-browser pass; verdicts from selector specificity + markup inspection (same basis as ux-1). `.sch-sticky` thead center confirmed by both cx-kit :659 (0,2,3) and queue.css:161 center rules.
- PM-level gates (full vitest/eslint/e2e) not re-run here; TL's scoped gates reported green (tsc 0, vitest 14/14, eslint 0).
