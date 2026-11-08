# S02-03: refresh.css — cards, stats, deltas, pills, tags, tables, seg/tabs
Kind: mini
ID: S02-03
Parent: S02
Owner: dev
Depends: S02-02
Criteria: PLAN #4
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1; actions=6; changed_lines=300; minutes=10

## Goal
`refresh.css` gains the data-surface families: `.card` shell, `.grid-*`,
`.stat` with tone strips + `.delta` chips, `.pill`/`.tag`/`.agechip`,
compact `.tbl`, mock `.seg` and `.tabs`, `.icon-btn`.

## Files
- Edit: `src/app/refresh.css` | append "CARDS / STATS" … "TABLES / SEG" blocks

## Context
- `mockups/assets/mock.css:175-235` | .btn-adjacent controls: .seg, .tabs, .icon-btn
- `mockups/assets/mock.css:237-282` | .card/.card-pad/.card-head/.grid-*/.stat/.delta
- `mockups/assets/mock.css:284-334` | .pill/.tag/.agechip/.tbl

## Contract
Append `:root .cls` rules (tokens only): `.card`, `.card-pad`, `.card-head`,
`.card-title`, `.card-hint`; `.grid` + `.grid-2..5` (responsive: collapse to
1-col ≤820px, 2-col 821-1200px for grid-4/5); `.stat` family
(`.stat .stat-l .stat-v .stat-d`, `data-tone` left strips + tone-colored
`.stat-v` for bad); `.delta` (+ `.up .down .flat .up.good`, dark-safe via
status tokens); `.pill` (+ `.ok .warn .bad .info .acc .no-dot`, leading dot
`::before`); `.tag`; `.agechip` `.d0..d3` mapped to `--cx-age-*`/`--cx-age-ink-*`
tokens; `.tbl` (+ uppercase `th`, `.num`, `.sub`, `.lead`, `.rowlink`, row
hover, row ≤36px so the density contract holds); `.seg` (pill group, `.on`
button = surface+shadow) and `.seg button`; `.tabs` + `.tabs a.on`;
`.icon-btn` (+ `.dot` badge).
Out of scope: viz/list/md/agenda/login families (S02-04), existing class
reskins (S02-05/06).

## Actions
1. Card family block.
2. `.grid` + `.grid-2..5` with the responsive collapse.
3. `.stat` family + `data-tone` strips + `.delta`.
4. `.pill` tones + `.tag` + `.agechip` tones.
5. `.tbl` + helpers (keep td font ≈13px, row ≤36px).
6. `.seg` + `.tabs` + `.icon-btn`.

## Done when
- All families present; `data-tone="warn|ok|bad"` on `.stat` renders strip colors.
- `.pill` dot + tones map to `--cx-status-*` tokens (dark-safe).
- `.tbl` th uppercase + row height stays ≤36px.

## Verify
- Run: `grep -c "^:root \.\(card\|stat\|delta\|pill\|tag\|agechip\|tbl\|seg\|tabs\|icon-btn\|grid\)" src/app/refresh.css` -> >= 40

## Handoff
Classes consumed by every S04 page leaf and S05 normalization leaves.
Write results/S02-03.md (<=10 lines); TL alone updates TRACKER.md.
