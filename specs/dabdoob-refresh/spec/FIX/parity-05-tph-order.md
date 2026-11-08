# PX-05: /tph — move `.tph-tabs` above the summary block (head→tabs→note→stats→cards)
Kind: mini
ID: PX-05
Parent: FIX-PARITY
Owner: dev
Depends: none
Criteria: reports/ux-parity.md H9 (HIGH)
Skills: none
Budget: files=1; actions=4; changed_lines=80; minutes=8

## Goal
Mock 09 `/tph` renders `.tabs` directly under the page head, governing
the whole page; the app renders warn note + 5 stats + (inside `Ga`) lock
notices before `tph-tabs`, and the Overview tab (`Xa`) then repeats the
same cap chart + attention — reading as duplicated summary. Reorder to
`head → tabs → summary(note+stats) → tab panels` so tabs own the page.

## Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | `Ga` (~L1910-1990) gains a `summary` slot rendered after `<Ya>`; the page component (~L2140-2260) moves its note+`grid grid-5` stats into that slot

## Context
- `mockups/pages/09-tph.html` | order: head → tabs → note → stats → cards
- `tph-grid-page.tsx:1910-1988` | `Ga`: lock notices → `<Ya>` tabs →
  `panel()` for each tab (overview=`Xa` which includes cap chart +
  attention card — keep as the Overview tab's own content, NOT a page
  summary)
- `tph-grid-page.tsx:2140-2260` | page: `.page-head` → touches-warn
  `note warn` → `grid grid-5` stats → `<Ga>` — `sum`/`touchesPending`
  computed here already
- `tph-grid-page.tsx:408-430` | `Ya` — `.tph-tabs` button row; do not
  change its internals (`Yt` hash-state, `select` incl. `?tab=` replace)

## Contract
- `Ga` signature: `{ d, reload, go, summary }` where
  `summary?: ReactNode`. Inside `Ga`'s returned fragment the order is:
  1. storeErrors lock panel + read-only `tph-lock` notice (unchanged —
     additive, may stay before tabs as they gate the whole view)
  2. `<Ya>` tabs
  3. `{summary}`
  4. the tab panels (unchanged; `Xa` keeps its own cap-chart/attention
     content)
- Page: build `summary={<>{touchesPending ? warnNote : null}{grid5}</>}`
  (the EXISTING elements moved verbatim, `mb-3` kept) and pass it to
  `Ga`; remove them from the page's own JSX so they render inside `Ga`
  after the tabs.
- No duplicate render: the stats/`Xa` cap-chart appear exactly once
  (stats inside `summary`, chart inside the Overview tab).
- Keep `sum`/`badges`/`select`/`panel`/`Yt` logic, all ids
  (`tph-tab-*`, `tph-panel-*`, `page-title`), `hidden` toggles, hash
  sync, `key={d.date}` on `Es`.
- Non-`d` render paths (`LoadError`, skeleton) unchanged — `summary`
  only renders when `d && sum` as before.

## Actions
1. Add `summary?: ReactNode` to `Ga`'s props; render `{summary}` between `<Ya>` and the overview panel.
2. In the page, wrap the warn-note + `grid grid-5` block into `const summary = …` and pass it to `<Ga summary={summary} …>`; delete the inline render.
3. Confirm `Xa`/panels unchanged (cap chart + attention stay the Overview tab's content only).
4. `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- DOM order: `.page-head` → lock notices (if any) → `.tph-tabs` →
  warn note (if pending) → `grid grid-5` stats → active `tph-panel`.
- Each stat + the cap chart + attention card render exactly once.
- Tab switching + `?tab=` hash + `See Overview` button still work.

## Verify
- Run: `npx eslint src/features/cx-productivity/components/tph-grid-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "summary\|<Ya\|tph-tabs" src/features/cx-productivity/components/tph-grid-page.tsx` -> `summary` prop + slot after Ya present

## Handoff
none.
Write results/PX-05.md (<=10 lines); TL alone updates TRACKER.md.
