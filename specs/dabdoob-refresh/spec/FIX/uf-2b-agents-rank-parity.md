# FUX-12: agents rank table — Trend·8w spark column, avatar initials, behaviour pill, team delta
Kind: mini
ID: FUX-12
Parent: FIX-UF
Owner: dev
Depends: FUX-11 (needs `agents[i].trend` + `data.prevTeam` in the payload)
Criteria: reports/user-fix-round.md UF-2 (HIGH); mockups/pages/08-agents.html
Skills: none
Budget: files=1; actions=5; changed_lines=120; minutes=9

## Goal
Bring the stack-ranking table to mockup parity within real data wiring: add
the "Trend · 8w" `.spark` column (between Behaviour and KPI score, fed by
`a.trend` from FUX-11), avatar-initials in the Agent cell, band chips
(clean / N cases / op-loss) in the Behaviour column, and a `.delta` chip on
the "Team KPI score" stat fed by `data.prevTeam`.

## Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | rank-table head/rows (~L674-745), `ScoreCells` (~L71-114), `Val` usage stays, team `.stat` (~L591-598)

## Context
- `mockups/pages/08-agents.html:73-137` | contract: `.tbl` cols `# | Agent(avatar+lead) | Team lead | Days | Productivity | Quality | FCR | Behaviour(pill) | Trend·8w(.spark 8 bars) | KPI score | band pill`; `.avatar` 1.7rem initials + `.lead` name; Behaviour `.pill` = clean/1 case/op-loss
- `agents-page.tsx:71-114` | `ScoreCells` renders the 8 KPI `<td>`s as one fragment — add an optional slot/prop so a `<td>` can be inserted between Behaviour (td 7) and KPI score (td 8)
- `agents-page.tsx:526-538` | `vsTeamDelta` + `bandPill` helpers already exist
- `src/app/refresh.css:380-387` | `.spark` + `.spark i` styles + `.spark.gray` variant already global
- `agents-page.tsx:25` | `COLUMNS` maps to ScoreCells' 8 cells; headers `#`, `Agent` are raw strings (no D()) — match that convention for the new `Trend · 8w` `<th>`

## Contract
- Trend cell: `<td><div className="spark" role="img" aria-label={…}>{8 × <i>}</div></td>`
  placed between Behaviour and KPI score. Each `<i style={{height:'<v>%'}}>`
  where `v` = the bucket value clamped 4..100; `null` bucket renders a stub
  bar (height ~6%, `background:'var(--cx-line-2)'` inline style). If
  `a.trend` is absent/not an array render `–`. aria-label summarises the
  real series (e.g. `Trend: 40, 55, 50 …` naming the values/`no data`).
- Agent cell keeps the existing detail-jump `Button` for teamView; wrap the
  name in the mockup `.flex` + `.avatar` (1.7rem, font-size .65rem inline
  style) initials pattern. Initials = first letters of first+last name
  tokens, uppercase.
- Behaviour cell (inside ScoreCells): replace the `Val` chip with a `.pill`:
  `a.kpi.olDeduction` -> `pill bad` "op-loss"; `t.behaviorCases > 0` ->
  `pill warn` "1 case"/"N cases"; `t.behavior === null` -> `pill` "no log";
  else `pill ok` "clean". Keep the `payLine(t.kpi,'behavior')` `dq-sub`
  line under it (real data kept). This change applies to every ScoreCells
  consumer (rank + detail totals + day rows) — same behaviour everywhere.
- Team stat `.stat-d`: when `data.prevTeam` is a number and `teamScore` is
  not null, render `<span className={delta}>` with `d = teamScore -
  prevTeam` rounded 0.1: `d > 0` -> `delta up good` `▲ d`; `d < 0` ->
  `delta up` `▼ |d|`; `d === 0` -> `delta flat` `=`; followed by
  ` D('vs prior period')` text (AR key lands via FUX-15; English fallback
  acceptable until then). When prevTeam is null keep the existing
  "{n} agents scored" line.
- Column count: add `Trend · 8w` `<th>` (raw string, not D()); bump the
  empty-state `colSpan` 14 -> 15. Do NOT drop the
  Inbound/Texting/Waiting Addr columns (real data; mock parity is
  structural, not column-deletion).
- Out of scope: tab/view restructure (FUX-13), page-head/stat-card changes
  beyond the delta chip, any data-layer edits (done in FUX-11), new deps.

## Actions
1. Extend `ScoreCells` with an optional insertion point between the
   Behaviour and KPI-score `<td>`s; add the `.spark` trend `<td>` in the
   rank rows wired to `a.trend` per contract, plus the `Trend · 8w` header
   and colSpan bump.
2. Add the `.avatar` initials + `.flex` wrapper in the Agent cell.
3. Swap the Behaviour cell to the `.pill` precedence per contract (keep the
   `dq-sub` pay line).
4. Add the `.delta` chip + `D('vs prior period')` in the Team-KPI `.stat-d`.
5. `npx eslint src/features/cx-people/components/agents-page.tsx` +
   `npx tsc --noEmit` clean.

## Done when
- Rank table shows a `Trend · 8w` column between Behaviour and KPI score
  with 8 bars per agent (null buckets = gray stubs, missing trend = `–`),
  `role="img"` + aria-label on each `.spark`.
- Agent cells show `.avatar` initials next to the name; Behaviour column
  shows the clean/1 case/N cases/op-loss `.pill`; Team-KPI stat shows a
  `.delta` chip vs `prevTeam` when available.
- `npx tsc --noEmit` clean; eslint 0 errors on the file.

## Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n 'className="spark"\|Trend' src/features/cx-people/components/agents-page.tsx` -> hits for spark td + th

## Handoff
Rank view visually complete vs mockups/pages/08-agents.html; FUX-13 finishes
the 4-tab chrome (Stack ranking / Agent detail / Workbook imports /
How scoring works).
Write results/FUX-12.md (<=10 lines); TL alone updates TRACKER.md.
