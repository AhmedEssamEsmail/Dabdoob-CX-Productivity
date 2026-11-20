# FIX leaves for reports/ux-3.md (table-center-align)

Blocking findings routed: ux-1, ux-2, ux-3 (MED — per-row alignment flips in
label/note columns), ux-4 (LOW — PM direction: opt out ALL four flip-flop
sites with `cx-txt`), ux-5 (LOW — PM direction: actually fix the `.qa-whylist`
no-op with `justify-content:center`).

PM mechanism: opt-out class `cx-txt` via
`:root .cx-table td.cx-txt { text-align: start; }` placed AFTER the
`td:has(.cx-chip)` rule in cx-kit.css (equal specificity (0,3,1) — source order
decides). The numeric rule (0,3,2) still wins over `cx-txt`, which is correct:
`cx-txt` is only a chip-rule opt-out.

## ux3-01: add cx-txt opt-out rule and apply it to the 8 text-primary tds
Kind: mini
ID: ux3-01
Parent: ux-3
Owner: dev
Depends: none
Criteria: PLAN-R2 / reports/ux-3.md findings ux-1..ux-4
Skills: none
Budget: files=9; actions=9; changed_lines=50; minutes=9

### Goal
Text-primary `<td>`s that happen to contain a `.cx-chip` keep
`text-align: start` like their sibling rows, ending the per-row alignment
flip in name/note/mixed columns.

### Files
- Edit: `src/app/cx-kit.css` | add `cx-txt` rule right after line 661
- Edit: `tests/css/table-center-align.test.ts` | add assertion for the new rule
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | "Status given" td ~:208
- Edit: `src/features/cx-queue/components/queue-page.tsx` | "By queue" name td ~:326
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | "Agent" td ~:417
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | `cx-muted` tlEmail td ~:453 AND country td ~:468
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | critical-note td ~:991
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | deltaPp/bandChange td ~:169
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | `trk-by` td ~:722

### Context
- `src/app/cx-kit.css:659-662` | chip rule at :661; insert `cx-txt` rule at :662
- `tests/css/table-center-align.test.ts:128-139` | "R2 chip-cell" describe block to extend
- `reports/ux-3.md` | findings ux-1..ux-4 evidence

### Contract
New rule exactly: `:root .cx-table td.cx-txt { text-align: start; }` on the
line immediately after the `td:has(.cx-chip)` rule (source order is the
tiebreaker — equal specificity). Each listed td gains `cx-txt` in its
className (create `className="cx-txt"` where none exists; append to existing
`cx-muted` / `trk-by`). Nothing else changes in the markup. PM direction:
`cx-txt` on ALL four LOW sites — do NOT add `cx-num` to
productivity-analytics ~:169. Out of scope: qa-whylist (ux3-02), any other
td/rule/file.

### Actions
1. cx-kit.css: insert the `cx-txt` rule immediately after the `td:has(.cx-chip)`
   rule; add a test asserting the rule and that it follows the chip rule in
   source order (regex/source-index style matching the suite).
2. checkins ~:208: `cx-txt` on the td holding `<Chip>{A.status}</Chip>` + `cx-statusline`.
3. queue-page ~:326: `cx-txt` on the td holding `.lead` + `.sub` + StatusChip.
4. audit-queue-page ~:417: `cx-txt` on the td holding `{w.agentName}` + `qa-sub` + warn Chip.
5. people-holidays ~:453: append `cx-txt` to `className="cx-muted"` tlEmail td.
6. people-holidays ~:468: `cx-txt` on the `basedInCountry`/"Not set" td.
7. quality-analytics ~:991: `cx-txt` on the `'–'/text/Chip` td.
8. productivity-analytics ~:169: `cx-txt` on the `deltaPp`/`bandChange` td (no `cx-num`).
9. trackers ~:722: append `cx-txt` to `className="trk-by"` td; run the targeted test.

### Done when
- `cx-txt` rule present after the chip rule; all 8 tds carry `cx-txt`; no other edits
- `npx vitest run tests/css/table-center-align.test.ts` -> exit 0
- `npx eslint src/app/cx-kit.css tests/css/table-center-align.test.ts` -> 0 errors

### Verify
- Run: `npx vitest run tests/css/table-center-align.test.ts` -> exit 0

### Handoff
Write results/ux3-01.md (<=10 lines); TL alone updates TRACKER.md.

## ux3-02: center .qa-whylist li content so the Why-cell centering is real
Kind: mini
ID: ux3-02
Parent: ux-3
Owner: dev
Depends: ux3-01 (shares tests/css/table-center-align.test.ts)
Criteria: PLAN-R2 SC1 / reports/ux-3.md finding ux-5
Skills: none
Budget: files=2; actions=2; changed_lines=15; minutes=5

### Goal
`.qa-whylist li` is `display:flex`, so the td's `text-align:center` never
centered its chip+reason content; `justify-content:center` makes the Why
cell's centered intent actually render.

### Files
- Edit: `src/app/styles/quality.css` | `.qa-whylist li` rule at :208
- Edit: `tests/css/table-center-align.test.ts` | add assertion

### Context
- `src/app/styles/quality.css:207-208` | `.qa-whylist` grid + `li` flex rule
- `tests/css/table-center-align.test.ts:128-156` | R2 describe blocks to extend
- `reports/ux-3.md` | finding ux-5

### Contract
`[data-app="quality"] .qa-whylist li` gains `justify-content:center` in its
existing single-line rule (keep `display:flex;flex-wrap:wrap;align-items:baseline;gap:...`).
No other declaration or rule changes; no markup changes.

### Actions
1. quality.css:208: add `justify-content:center;` to the `.qa-whylist li` rule.
2. Add a test asserting `.qa-whylist li` declares `justify-content:center`;
   run the targeted test.

### Done when
- rule carries `justify-content:center`; no other quality.css edits
- `npx vitest run tests/css/table-center-align.test.ts` -> exit 0
- `npx eslint src/app/styles/quality.css tests/css/table-center-align.test.ts` -> 0 errors

### Verify
- Run: `npx vitest run tests/css/table-center-align.test.ts` -> exit 0

### Handoff
Write results/ux3-02.md (<=10 lines); TL alone updates TRACKER.md.
