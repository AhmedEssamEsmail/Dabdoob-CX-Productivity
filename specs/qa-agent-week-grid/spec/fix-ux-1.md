# fix-ux-1: UX report round 1 — blocking fix leaves
Report: `reports/ux-1.md` (FAIL; 1 MED blocking -> ux1-01; ux-2/ux-3 LOW -> deferred)

## ux1-01: `AgentWeeks` agent-name cell -> `<th scope="row">` + regression test
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: reports/ux-1.md finding ux-1 (WCAG 1.3.1 row-header association; restores established sticky-name styling)
Skills: none
Budget: files=2; actions=3; changed_lines=80; minutes=8

### Goal
In `AgentWeeks` each body row's agent-name cell is a real row header
`<th scope="row" className="qa-cov__name">`, matching the codebase's
scrolling-grid pattern, guarded by a descriptor-tree regression test.

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | `AgentWeeks` (~line 453 add `export`; ~line 483 the cell element)
- Create: `tests/quality/qa-agent-weeks-rowhead.test.tsx` | row-header regression test only

### Context
- `src/features/cx-quality/components/quality-analytics-page.tsx:452-508` | `AgentWeeks` — target `<td>{g.label}</td>` ~483; `thead` already uses `scope="col"`
- `src/features/cx-quality/components/quality-analytics-charts.tsx:502` | sibling pattern `<th scope="row" className="qa-cov__name">`
- `src/app/styles/quality.css:161` | `.qa-cov__name` is scoped to `[data-app="quality"]` only (not `.qa-cov`) — safe reuse; gives sticky first column + strong weight
- `tests/ui/autosave-input.test.tsx:69-78` | `vi.mock('react/jsx-runtime' + 'jsx-dev-runtime')` element-descriptor pattern; `AgentWeeks` uses no hooks so invoke it directly and walk `props.children` recursively (arrays allowed)
- `tests/quality/audit-form-controls.test.tsx` | same pattern already importing from `./qa-shared`; if `./quality-analytics-charts` or shared/ui module imports break the test, `vi.mock` them to stubs — do not edit them

### Contract
Change only the row-identifying cell: `<td>{g.label}</td>` ->
`<th scope="row" className="qa-cov__name">{g.label}</th>`. Everything else
unchanged: `thead` `scope="col"` headers and `title`s, the 12
`<td className="cx-num">` score cells, and the empty-state
`<td colSpan={13}>` (still 13 — row header `th` + 12 `td` = 13 cells).
`AgentWeeks` gains `export` solely so the test can invoke it; render call
and signature unchanged.
Out of scope: ux-2/ux-3 (deferred LOW), any CSS file, other
sections/components, payload/server code, drill wiring, new deps.

### Actions
1. In `AgentWeeks` change the cell to `<th scope="row" className="qa-cov__name">{g.label}</th>` and make `AgentWeeks` an exported function.
2. Create `tests/quality/qa-agent-weeks-rowhead.test.tsx`: mock `react/jsx-runtime`/`jsx-dev-runtime` per the autosave pattern (no react stub needed — no hooks); invoke `AgentWeeks({ d })` with `d = { columns: { agentWeeks: { periods: [12 'YYYY-MM-DD' keys], agents: [{ key:'a', label:'Ann', cells: [12 {avg,audits,history}] }] } }, weekStartsOn: 0 }`; recursively collect `type === 'tr'` descriptor nodes under `tbody` and assert each agent row's first child is `type 'th'` with `props.scope === 'row'`, `props.className === 'qa-cov__name'` and child text `'Ann'`.
3. In the same file assert: `thead` `th` cells keep `scope === 'col'`; with `agents: []` the single body row is `<td colSpan={13}>` (not a `th`).

### Done when
- Body-row agent cell renders `<th scope="row" className="qa-cov__name">`; `thead`, score cells and `colSpan={13}` empty row unchanged
- New test passes and would fail on the old `<td>` markup (record evidence: run once against pre-fix line or state why traversal proves it)
- `npx eslint` clean on both touched files; `npx tsc --noEmit` clean

### Verify
- Run: `npx vitest run tests/quality/qa-agent-weeks-rowhead.test.tsx` -> all tests pass
- Run: `npx eslint src/features/cx-quality/components/quality-analytics-page.tsx tests/quality/qa-agent-weeks-rowhead.test.tsx` -> exit 0

### Handoff
Resolves ux-1 finding ux-1 (MED). ux-2/ux-3 remain deferred LOW per report.
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.
