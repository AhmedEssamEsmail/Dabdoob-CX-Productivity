# S05-17: UnbuiltPage — designed empty state for every unbuilt registry page
Kind: mini
ID: S05-17
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=80; minutes=8

## Goal
`UnbuiltPage` in `StateScreen.tsx` — the placeholder every unbuilt
registry page renders (hard-cases, kpi-close, escalation-matrix, fcr, …) —
becomes a designed `.empty` state inside the shared head pattern instead
of bare text.

## Files
- Edit: `src/features/shared/components/shell/StateScreen.tsx` | UnbuiltPage placeholder body

## Context
- `src/features/shared/components/shell/StateScreen.tsx:31-35` | current `.page-head` + `.page-purpose` block
- `src/app/[...slug]/page.tsx:10-19` | who renders UnbuiltPage
- `mockups/pages/09-tph.html:118-122` | `.empty` reference

## Contract
- Keep the `.page-head` (title + one-line purpose) — trim nothing else.
- Replace the bare "Not built yet." body with `.empty` markup: icon svg
  + `.t` (e.g. `D('Not built yet')`) + `.s` (short hint).
- `D()` on new strings; `.state-screen` semantics unchanged.

## Actions
1. Swap the placeholder body for `.empty` (icon + title + hint).
2. Keep `.page-head` + purpose one line.
3. `npx eslint` the file.
4. `npx tsc --noEmit` clean.

## Done when
- Unbuilt pages render head + designed `.empty` state.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — covers every unbuilt registry route at once.
Write results/S05-17.md (<=10 lines); TL alone updates TRACKER.md.
