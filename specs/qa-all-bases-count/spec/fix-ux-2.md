# fix-ux-2 — UX gate round 2 findings (qa-all-bases-count)

Source: `specs/qa-all-bases-count/reports/ux-2.md` (FAIL, 1 MED + 1 LOW).
All fixes are copy-only; no class, token, layout or data changes.
- ux-4 (MED) -> leaf ux2-01
- ux-5 (LOW) -> deferred per FIX rules; logged in TRACKER.

## ux2-01: explainer references renamed "sample-mix" panel (finding ux-4)
Kind: mini
ID: ux2-01
Parent: fix-ux-2
Owner: dev
Depends: none
Criteria: ux-2 report row ux-4
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
The scores-page explainer no longer points at a "sample-mix panel" name that
does not exist; it names (or descriptively identifies) the panel now titled
"Beyond the random sample".

### Files
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | lines ~672-673, `The sample-mix panel and the &quot;every audit counted once&quot; line are shown for context.`

### Context
- `src/features/cx-quality/components/quality-scores-page.tsx:665-679` | the `cx-muted` explainer paragraph
- `src/features/cx-quality/components/quality-scores-page.tsx:210-230` | the panel now titled "Beyond the random sample"
- `specs/qa-all-bases-count/reports/ux-2.md` | finding ux-4 exact fix

### Contract
Copy-only string change inside the existing `cx-muted` paragraph; keep the
`&quot;` entity style for quoted names in JSX. Do not touch the panel title,
any other sentence, markup, or styles.
Out of scope: any other line, data logic, styles.

### Actions
1. Replace `The sample-mix panel and the &quot;every audit counted once&quot; line are shown for context.` with text naming the real panel, e.g.
   `The &quot;Beyond the random sample&quot; panel and the &quot;every audit counted once&quot; line are shown for context.`

### Done when
- No `sample-mix` string remains in the file.
- The sentence references a panel name present on the page
  (`Beyond the random sample`) or otherwise clearly identifies it.

### Verify
- Run: `npx tsc --noEmit` -> clean
- Run: `grep -n "sample-mix" src/features/cx-quality/components/quality-scores-page.tsx` -> no match

### Handoff
None. Write results/ux2-01.md (<=10 lines); TL alone updates TRACKER.md.
