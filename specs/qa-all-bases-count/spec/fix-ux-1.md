# fix-ux-1 — UX gate round 1 findings (qa-all-bases-count)

Source: `specs/qa-all-bases-count/reports/ux-1.md` (FAIL, 3 MED).
All fixes are copy-only; no class, token, layout or data changes.

## ux1-01: stale "Pending disputes" sub copy (finding ux-1)
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: ux-1 report row ux-1
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
"Pending disputes" sub no longer claims disputed audits "return" — they are
counted immediately under the new all-bases rule.

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | line ~138, the `{n.notFinal ? ... : 'Final'}` span

### Context
- `src/features/cx-quality/components/quality-analytics-page.tsx:130-140` | the stat block
- `specs/qa-all-bases-count/reports/ux-1.md` | finding ux-1 exact fix

### Contract
Copy-only string change; keep the `n.notFinal` conditional and the `'Final'`
else-branch untouched.
Out of scope: any other line, data logic, markup, styles.

### Actions
1. Replace `'Not final: these return when decided'` with copy stating disputed
   audits are already counted but not final, e.g.
   `'Not final: counted already; the score can still move when decided'`.

### Done when
- No `return when decided` string remains in the file.
- Conditional still renders `'Final'` when `!n.notFinal`.

### Verify
- Run: `npx tsc --noEmit` -> clean
- Run: `grep -n "return when decided" src/features/cx-quality/components/quality-analytics-page.tsx` -> no match

### Handoff
None. Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-02: "Counted, by basis" tail lists uncounted blanks (finding ux-2)
Kind: mini
ID: ux1-02
Parent: fix-ux-1
Owner: dev
Depends: ux1-01 (same file, serial)
Criteria: ux-1 report row ux-2
Skills: none
Budget: files=1; actions=1; changed_lines=4; minutes=5

### Goal
The `Counted, by basis:` line marks blank-score audits as NOT counted instead
of appending them under the "Counted" heading.

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | lines ~146-148, the `t.blankScores ? ... : ''` tail

### Context
- `src/features/cx-quality/components/quality-analytics-page.tsx:142-154` | the `qa-bases` paragraph
- `specs/qa-all-bases-count/reports/ux-1.md` | finding ux-2 exact fix

### Contract
Copy-only string change inside the existing `t.blankScores` conditional; do not
alter `a.map(...)`, the `unknown`-basis sentence, or surrounding markup.
Out of scope: any other line, data logic, styles.

### Actions
1. Reword the tail so exclusion is explicit, e.g.
   `` `${a.length ? ' · not counted: ' : 'Not counted: '}${t.blankScores} with no score` ``.

### Done when
- With `a.length===0` and `t.blankScores>0` the line reads
  `Counted, by basis: Not counted: N with no score.` (no bare "N with no score"
  under "Counted").
- With `a.length>0` the tail starts with `· not counted:`.

### Verify
- Run: `npx tsc --noEmit` -> clean
- Run: `grep -n "not counted" src/features/cx-quality/components/quality-analytics-page.tsx` -> match present

### Handoff
None. Write results/ux1-02.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-03: "Sample mix" panel title vs non-random content (finding ux-3)
Kind: mini
ID: ux1-03
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: ux-1 report row ux-3
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
Panel title matches its content (non-random bases only), instead of claiming
the full sample mix. Chosen fix per report option B: retitle, keep
`d.others` filter unchanged (empty-state copy stays accurate).

### Files
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | line ~213, `cx-section__title` div

### Context
- `src/features/cx-quality/components/quality-scores-page.tsx:210-230` | the panel
- `src/features/cx-quality/lib/analytics.ts:1217-1223` | `others` excludes `random` — do NOT change it
- `specs/qa-all-bases-count/reports/ux-1.md` | finding ux-3

### Contract
Copy-only title change, e.g. `Beyond the random sample`. Do not touch
`analytics.ts`, `d.others`, the list rendering, or the `Empty` message
"Only random-sample audits in these dates." (still accurate).
Out of scope: any other line, data logic, styles.

### Actions
1. Replace title text `Sample mix` with `Beyond the random sample`.

### Done when
- Title no longer reads `Sample mix`.
- `analytics.ts` untouched; empty-state string untouched.

### Verify
- Run: `npx tsc --noEmit` -> clean
- Run: `grep -n "Sample mix" src/features/cx-quality/components/quality-scores-page.tsx` -> no match

### Handoff
None. Write results/ux1-03.md (<=10 lines); TL alone updates TRACKER.md.
