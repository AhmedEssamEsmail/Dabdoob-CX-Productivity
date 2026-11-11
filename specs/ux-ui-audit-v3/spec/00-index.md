# Spec index: ux-ui-audit-v3 — Phase 1B (rows B1–B18)
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| P1B-01 | package | spec/P1B-chrome.md | - | none | B12 page-heads, B8 headings | not dispatchable |
| P1B-02 | package | spec/P1B-controls.md | - | P1B-01 | B10 labels, B9 dialogs, B2, B14 | not dispatchable |
| P1B-03 | package | spec/P1B-states.md | - | P1B-02 | B3 empty, B13 CLS, B7 tables | not dispatchable |
| P1B-04 | package | spec/P1B-styles.md | - | P1B-03 | B4 inline styles, B5 colors, B6, B11 | not dispatchable |
| P1B-05 | package | spec/P1B-links-focus.md | - | P1B-04 | B1 links, B15, B16, B18 | not dispatchable |
| P1B-06 | package | spec/P1B-format.md | - | P1B-05 | B17 format helpers | not dispatchable |

Canonical same-file order: B12 → B10 → B9 → B3 → B7 → B13 → B4 → B5 → B16 → B17 → B1 → B15 → B8 → B18 → B11/B14. Leaf `Depends` fields encode the chain; two leaves never write the same file concurrently.
Zero-hit rows (no-op verify leaves): B2 (icon-only buttons — `variant="icon"`/`<Button>`-icon grep = 0 hits), B6 (`transition: all` = 0 hits). B14 residual: 3 raw disabled controls, all covered by B10 migration — verify-only leaf.
Ready work (no deps): B12-01..06, B5-01, B5-02, B1-00, B11-01, B2-01, B6-01 — max 4 workers.
Gates per leaf: residual grep → 0 (or documented dynamic-only), `npx eslint <files>` 0 warnings, `npx tsc --noEmit`, page at 375/1024px no h-scroll; ux-ui-expert gate at package level.
Size gate evidence: manual review vs LIMITS.md — every leaf <=10 files / <=10 actions / <=2000 lines / <=10 min; largest: B7-02 (~9 sites, 10 min). Run check_shards.py before dispatch.
