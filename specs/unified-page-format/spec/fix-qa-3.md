# fix-qa-3: qa-3 review findings (reports/qa-3.md)
Kind: fix-batch
Source: reports/qa-3.md — qa-7 LOW (dead `.grid-4`/`.grid-5` utility rules + media mentions in refresh.css; ux1-01 removed the last `grid-4` consumer, `grid-5` never had one). Only approved finding this round.

## qa3-01: remove dead `.grid-4`/`.grid-5` rules and media mentions
Kind: mini
ID: qa3-01
Parent: fix-qa-3
Owner: dev
Depends: none
Criteria: reports/qa-3.md qa-7
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=5

### Goal
`refresh.css` still ships the `.grid-4`/`.grid-5` utilities after ux1-01 removed the only `grid-4` consumer (Home stats wrapper); `grid-5` has no consumer anywhere in `src/`/`tests/`/`e2e/`/`docs/`. Remove both rules and their mentions in the 1180px and 820px media queries — dead CSS, same class as qa-3. `.grid`, `.grid-2`, `.grid-3`, `.cols-32`, `.cols-75` stay (grid-2/grid-3 still used by admin-config, admin-roster, overview, status-validation).

### Files
- Edit: `src/app/refresh.css` | GRID block lines ~175-189 only

### Context
- `reports/qa-3.md` qa-7 row | finding + exact fix
- `src/app/refresh.css:173-189` | current GRID block: rules at :177-178, 1180px media block :181-183, 820px selector list :185-186
- `src/features/cx-hub/components/admin-config-page.tsx`, `admin-roster-page.tsx`, `overview-page.tsx`, `src/features/cx-productivity/components/status-validation-page.tsx` | remaining `grid-2`/`grid-3` consumers that must keep working

### Contract
After the edit the GRID block reads: `.grid`, `.grid-2`, `.grid-3`, `.cols-32`, `.cols-75` rules unchanged; the `@media (max-width: 1180px) and (min-width: 821px)` block is deleted entirely (it only contained grid-4/grid-5); the `@media (max-width: 820px)` block keeps collapsing `:root .grid-2, :root .grid-3, :root .cols-32, :root .cols-75` to `1fr`. Out of scope: everything else — do NOT touch grid-2/grid-3/cols-* rules, do NOT re-add the `/` kicker or touch my-day/overview markup, no other file.

### Actions
1. Delete lines `:root .grid-4 {…}` and `:root .grid-5 {…}` (~:177-178).
2. Delete the whole `@media (max-width: 1180px) and (min-width: 821px) { :root .grid-4, :root .grid-5 {…} }` block (~:181-183).
3. In the 820px media selector list remove `, :root .grid-4, :root .grid-5` so it reads `:root .grid-2, :root .grid-3,\n  :root .cols-32, :root .cols-75 { grid-template-columns: 1fr; }` (keep existing formatting style).

### Done when
- `grep -rn "grid-4\|grid-5" src/ tests/ e2e/ docs/` → 0 hits.
- `grep -n "grid-2\|grid-3\|cols-32\|cols-75" src/app/refresh.css` still shows the kept rules + 820px collapse.
- The 1180px media query is gone; the 820px media query still exists.

### Verify
- Run: `npx vitest run tests/css-form-guards.test.ts` → 22/22 PASS; `npx tsc --noEmit` → exit 0.

### Handoff
None — dead-code removal, no selector/API changes downstream.
Write results/qa3-01.md (<=10 lines); TL alone updates TRACKER.md.
