# fix-ux-2: UX report round 2 — blocking fix leaves
Report: `reports/ux-2.md` (FAIL; 1 MED blocking -> ux2-01; ux-2/ux-3 remain deferred LOW)

## ux2-01: `AgentWeeks` corner header gets `qa-cov__name` + regression assertion
Kind: mini
ID: ux2-01
Parent: fix-ux-2
Owner: dev
Depends: none
Criteria: reports/ux-2.md finding ux-4 (corner `th` must stay pinned above the sticky name column, matching sibling grid)
Skills: none
Budget: files=2; actions=2; changed_lines=40; minutes=5

### Goal
In `AgentWeeks` the `thead` corner cell is
`<th scope="col" className="qa-cov__name">Agent</th>` so it pins with the
sticky name column like the sibling coverage grid, guarded by extending the
existing descriptor-tree regression test.

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | `AgentWeeks` thead corner cell (~line 466)
- Edit: `tests/quality/qa-agent-weeks-rowhead.test.tsx` | add corner-header assertion only

### Context
- `src/features/cx-quality/components/quality-analytics-page.tsx:464-477` | `AgentWeeks` thead: corner `<th scope="col">Agent</th>` lacks the class; 12 week `<th scope="col" className="cx-num">` follow
- `src/features/cx-quality/components/quality-analytics-charts.tsx:477` | sibling pattern `<th scope="col" className="qa-cov__name">Agent</th>`
- `src/app/styles/quality.css:161-166` | `.qa-cov__name` (sticky, opaque `--cx-surface`, `min-inline-size:10rem`, strong weight) applies to `th` regardless of `scope`; thead cells stay static per `cx-kit.css:647-656` so it paints above scrolling headers via its z-index
- `tests/quality/qa-agent-weeks-rowhead.test.tsx:134-141` | existing `'keeps thead headers as scope="col"'` test — extend/augment there (walk already available)

### Contract
Change only the corner header element: `<th scope="col">Agent</th>` ->
`<th scope="col" className="qa-cov__name">Agent</th>`. Everything else in
`AgentWeeks` unchanged: the 12 week `<th scope="col" className="cx-num" title>`,
body `<th scope="row" className="qa-cov__name">`, score cells, empty-state
`<td colSpan={13}>`. The file contains unrelated uncommitted `qa-active-toggle`
edits — do NOT touch or revert them; scope the diff to the one line.
Out of scope: ux-2/ux-3 (deferred LOW), any CSS file, other
sections/components, new deps.

### Actions
1. In `AgentWeeks` change the corner cell to `<th scope="col" className="qa-cov__name">Agent</th>` — exactly the sibling pattern; no other source edits.
2. In `tests/quality/qa-agent-weeks-rowhead.test.tsx` add an assertion (new `it` or extend the `scope="col"` test): the first `thead` `th` has `props.className === 'qa-cov__name'` and text `Agent`; the remaining 12 `thead` `th`s keep `className === 'cx-num'`.

### Done when
- Corner header renders `<th scope="col" className="qa-cov__name">Agent</th>`; week headers, body cells and `colSpan={13}` empty row unchanged
- Test passes and would fail on the old classless markup (state why the assertion proves it)
- `npx eslint` clean on both touched files; `npx tsc --noEmit` clean
- `git diff` on the page file shows only the one-line className addition on top of the pre-existing qa-active-toggle edits

### Verify
- Run: `npx vitest run tests/quality/qa-agent-weeks-rowhead.test.tsx` -> all tests pass
- Run: `npx eslint src/features/cx-quality/components/quality-analytics-page.tsx tests/quality/qa-agent-weeks-rowhead.test.tsx` -> exit 0

### Handoff
Resolves reports/ux-2.md finding ux-4 (MED). ux-2/ux-3 remain deferred LOW.
Write results/ux2-01.md (<=10 lines); TL alone updates TRACKER.md.
