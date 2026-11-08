# FUX-13: agents page — mockup 4-tab chrome (rank / detail / workbook imports / scoring)
Kind: mini
ID: FUX-13
Parent: FIX-UF
Owner: dev
Depends: FUX-12 (same file — serial after the table parity lands)
Criteria: reports/user-fix-round.md UF-2 (HIGH); mockups/pages/08-agents.html:66-71
Skills: none
Budget: files=1; actions=5; changed_lines=110; minutes=9

## Goal
Replace the two-option `Seg` view switch with the mockup's `.tabs` row of
FOUR tabs: **Stack ranking**, **Agent detail**, **Workbook imports**,
**How scoring works**. "Workbook imports" mounts the existing
`ScorecardAdmin` block (admin-gated); "How scoring works" mounts the
existing scoring-explainer paragraph lifted out of the Period section.

## Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | view switch (~L642-662), Period section explainer (~L627-635), `ScorecardAdmin` mount (L852), `view` state (~L429)

## Context
- `mockups/pages/08-agents.html:66-71` | `.tabs` + `a.on` contract
- `src/app/refresh.css:319-331` | `.tabs`/`.tabs a`/`.tabs a.on` styles already global (style `button` inside `.tabs` the same or render anchors per existing app patterns — your call, keep `.tabs` + `.on`)
- `agents-page.tsx:284-421` | `ScorecardAdmin` component (admin-only content) currently mounted at L852 gated by `boot?.user.role === 'admin'`
- `agents-page.tsx:627-635` | the `.cx-hint` scoring-explainer `<p>` inside the Period `cx-section`
- `agents-page.tsx:429,663-754` | `view` state ('rank'/'detail') and the conditional rank/detail render branches

## Contract
- `view` gains 'workbook' and 'scoring'. Render a `.tabs` row (role/tablist
  semantics: buttons `role="tab"` + `aria-selected`, or follow whatever the
  file's existing Seg/`aria-pressed` pattern closest maps to — mock parity
  is the visual contract, ARIA must stay honest) with exactly these tabs in
  order: Stack ranking -> rank, Agent detail -> detail (teamView only),
  Workbook imports -> workbook (visible only when
  `boot?.user.role === 'admin'`), How scoring works -> scoring.
- 'workbook' pane renders `<ScorecardAdmin />`; delete the bottom mount at
  L852 (the admin gate moves into tab visibility).
- 'scoring' pane renders the scoring-explainer paragraph MOVED from the
  Period `cx-section` (Period section keeps its head/period hint and the
  `warnNotes` block; only the `<p className="cx-hint">` explainer moves).
- Keep the "My team only" `cx-switch` beside the tabs (visible on rank view
  when `data.scope === 'tl'`). Keep rank/detail panes working exactly as
  today (detail fetch effect guard stays `view === 'detail'`).
- `!teamView` (agent scope): unchanged — own scorecard renders directly as
  today; document the choice in results (mock is the TL/admin view).
- Out of scope: rank-table internals (FUX-12 done), data layer, other pages,
  D() additions — tab labels are raw strings like the existing Seg options
  (record any new user-facing string in results for the i18n sweep).

## Actions
1. Extend `view` to four values and render the `.tabs` row with the gated
   tab list per contract (replacing the `Seg` block; keep `cx-filters` row
   for the team-only switch if helpful).
2. Move the scoring-explainer `<p>` into the 'scoring' pane and mount
   `ScorecardAdmin` inside the 'workbook' pane (remove the L852 mount).
3. Wire rank/detail/scoring/workbook panes under the active tab; keep
   `aria-pressed`/`aria-selected` + keyboard focus consistent with the
   file's existing controls.
4. Keep agent-scope (`!teamView`) rendering unchanged.
5. `npx eslint src/features/cx-people/components/agents-page.tsx` +
   `npx tsc --noEmit` clean.

## Done when
- `.tabs` row shows Stack ranking / Agent detail / Workbook imports /
  How scoring works (workbook tab admin-gated); each tab renders its pane.
- `ScorecardAdmin` renders only inside the workbook tab; the explainer
  paragraph only inside the scoring tab; Period section no longer carries it.
- Agent scope page behaviour unchanged; `npx tsc --noEmit` clean, eslint 0
  errors on the file.

## Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n 'className="tabs"\|ScorecardAdmin' src/features/cx-people/components/agents-page.tsx` -> tabs row + single ScorecardAdmin mount inside the workbook pane

## Handoff
Agents page completes UF-2 mockup parity; note any new raw user-facing tab
labels in results for the i18n sweep.
Write results/FUX-13.md (<=10 lines); TL alone updates TRACKER.md.
