# S04-22: agents — roster `.card` + `.tbl`; `.delta` vs-team cell replaces `.spark`
Kind: mini
ID: S04-22
Parent: S04
Owner: dev
Depends: none
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=6; changed_lines=170; minutes=8

## Goal
The agents "Stack Ranking" table matches mock 08 inside a `.card` —
`.tbl` rows with `.lead`/`.sub`, `.num` cells, `.delta` vs-team chip and a
status `.pill`. The page payload (`getScorecardPage` `agents[]`) carries
only period aggregates — NO per-agent series exists and data-layer
changes are out of scope — so the mock's `.spark` "Trend · 8w" column is
replaced by a real `.delta` chip (`a.overall − teamScore`, both already
computed on the page). This supersedes S04-14 (needs-split: `.spark`
needed a series).

## Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | rank-table region only (~L662-728: `cx-section`/`sc-rank` + table; plus `ScoreCells` td classes ~L82-110)

## Context
- `mockups/pages/08-agents.html:73-137` | table card anatomy (`#`, Agent, Team lead, Days, metric `.num`, `.pill`, `.delta`-equivalent slot, KPI score + band pill)
- `src/features/cx-people/components/agents-page.tsx:72-114` | `Val` + `ScoreCells` — keep `.cx-chip[data-status]` (preserved hook); shared with detail tables
- `src/features/cx-people/components/agents-page.tsx:529-537` | `scoredAgents`, `teamScore` already computed — the delta inputs
- `src/features/cx-people/lib/scorecard/index.ts:270-296` | row fields: `rank name tlName days overall kpi{total,incomplete,ineligible,olDeduction,probationMonth}` — no series
- `src/app/refresh.css:213-227,279-302,380-387` | `.delta up|down|flat`, `.tbl`, `.spark` (not used)

## Contract
- `section.cx-section` (labelledby `sc-rank`) → `section.card` with
  `.card-head`: `.card-title` `id="sc-rank"` keeps existing text
  ("Stack Ranking"/"Your scorecard"), `.card-hint` keeps the
  `{agents.length} agent(s)` count.
- `div.cx-panel.cx-tablewrap` → `div.cx-tablewrap` (keep scroll, drop
  panel); `table.cx-table.cx-table--nowrap` → `table.tbl`.
- thead: `#` `.num` | `Agent` | `Team lead` | `Days` `.num` | `COLUMNS`
  map unchanged | `D('vs team')` `.num` | `<th>` empty (band pill).
- Body rows: `#` `.num` (`a.rank ?? '–'`); agent `<th scope="row">` =
  `.lead` wrapping the existing drill `Button variant="quiet"`
  (teamView → `setAgent`+`setView('detail')`) or the plain name — no
  `.sub` under the name; NEW `<td>` `.sub` `a.tlName || '–'` (the
  "reports to" `dq-sub` line is removed — TL now has its own column);
  `a.days` `.num`; then `<ScoreCells t={a} />` unchanged except
  `className="num"` added to its `<td>`s; then vs-team
  `<td className="num">` and band `<td className="num">`.
- vs-team cell: when `typeof a.overall === 'number' && teamScore !== null
  && scoredAgents.length > 1` render
  `<span className={\`delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}\`}>`
  showing `d = Math.round((a.overall - teamScore) * 10) / 10` with `+`
  prefix when positive; otherwise `–`.
- band/status cell `.pill` from `a.kpi` (first match wins):
  `ineligible` → `.pill.bad` "Not eligible"; `olDeduction` → `.pill.bad`
  `OL x50%`; `probationMonth` → `.pill.info` "Probation";
  `incomplete` → `.pill.warn` "Incomplete"; else `.pill.ok` "Full pay".
  `a.kpi` absent/`overall` null → `–`.
- Empty row `colSpan` 11 → 14; keep "No data in this period."
- Keep `D()` on new labels; `aria-labelledby="sc-rank"`; sort/drill
  wiring; `.cx-chip[data-status]` via `Val` untouched. The "incomplete"
  footnote `<p className="cx-hint">` stays.
- Out of scope: `scorecard-server.ts`, `lib/scorecard/*`, `view=detail`
  calls, the detail/day tables' `cx-table` markup, `Seg`/filters, any
  new query. NO `.spark` (no real series — do not fabricate).

## Actions
1. Swap `cx-section` → `.card` + `.card-head` (title `sc-rank` + count hint); `cx-panel cx-tablewrap` → `cx-tablewrap`; `cx-table` → `tbl`.
2. Restyle the row head: `.lead` name (keep drill Button) and move `a.tlName` into its own `.sub` `Team lead` column; add `vs team` + empty band `<th>`s.
3. Add `className="num"` to `ScoreCells` `<td>`s (harmless in detail `cx-table`s) and keep `Val` chips.
4. Add the vs-team `.delta` cell per the contract.
5. Add the `a.kpi`-flags `.pill` cell; update `colSpan` to 14.
6. `npx eslint src/features/cx-people/components/agents-page.tsx` + `npx tsc --noEmit` clean.

## Done when
- Rank table is a `.card` containing `.tbl` with `.lead`/`.sub`/`.num` cells, `.delta` vs-team and the kpi-flags `.pill` — all from already-loaded page data, zero new queries.
- Drill to detail, mineOnly filter, seg and `D()` unchanged; `.cx-chip[data-status]` cells still render.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — agents page done (supersedes S04-14).
Write results/S04-22.md (<=10 lines); TL alone updates TRACKER.md.
