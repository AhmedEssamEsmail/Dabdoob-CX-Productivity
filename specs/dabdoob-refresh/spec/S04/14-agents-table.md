# S04-14: agents — roster table card with pills + spark cells
Kind: mini
ID: S04-14
Parent: S04
Owner: dev
Depends: S04-13
Criteria: PLAN #5
Skills: none
Status: superseded — replaced by S04-22. The page payload has no per-agent series (results/S04-14.md), so the `.spark` cell is out; S04-22 ships the same card with a real `.delta` vs-team chip. No code was changed under this leaf.
Budget: files=1; actions=4; changed_lines=240; minutes=10

## Goal
`agents-page.tsx`'s per-agent table matches mock 08: a `.card` containing
`.tbl` rows — agent (`.lead` + `.sub`), metric `.num` cells, `.pill`
coverage/band, `.spark` trend cell.

## Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | agent table region

## Context
- `mockups/pages/08-agents.html:73-140` | table card anatomy (pills ok/info/warn/bad, spark cells)
- `src/features/cx-people/components/agents-page.tsx` | current agent rows + per-agent metric/trend data
- `mockups/assets/mock.css:317-350` | .tbl + .spark

## Contract
- Wrap the agent table in `.card` (+ `.card-head` title `card-hint`
  period if a head row exists in mock — mock shows the table inside the
  card directly; add `.card-head` with title `D('Agents')` only if the
  layout needs it).
- `.tbl`: agent cell `.lead` name + `.sub` (group/TL), metric cells
  `.num`, coverage column `.pill` (`.ok` clean / `.warn` cases / `.bad`
  op-loss — the page's real statuses), band column `.pill` (`.ok` 100%
  / `.info` 75% / `.warn` 50% / `.bad` below — real band logic), trend
  cell `.spark` (existing weekly series).
- Keep sort/filter/drill wiring + `D()`.

## Actions
1. Wrap the table in `.card`.
2. Restyle agent + metric cells (`.lead`/`.sub`/`.num`).
3. Render `.pill` coverage + band cells from real statuses.
4. Render `.spark` cells from the real weekly series; `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Table card matches mock 08 (pills + sparks) with real data.
- Existing interactions unchanged; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — agents done.
Write results/S04-14.md (<=10 lines); TL alone updates TRACKER.md.
