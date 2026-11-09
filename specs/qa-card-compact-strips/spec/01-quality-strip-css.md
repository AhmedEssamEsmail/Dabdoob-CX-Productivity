# S01: `qa-card--strip` CSS family in quality.css
Kind: mini
ID: S01
Parent: none (root)
Owner: dev
Depends: none
Criteria: PLAN #4 (new CSS only in quality.css under `[data-app="quality"]`, token-based, both themes)
Skills: none
Budget: files=1; actions=3; changed_lines=70; minutes=8

## Goal
Append the compact-strip rule family to `src/app/styles/quality.css` so the
three page leaves (S02–S04) can render the approved Option A strips. Purely
additive — no existing rule is edited or removed.

## Files
- Edit: `src/app/styles/quality.css` | append one commented block at EOF (after line 212)

## Context
- `src/app/styles/quality.css:32-35` | existing `.qa-cards`/`.qa-card`/`data-late`/`data-picked`/`qa-card__head` rules — keep untouched; the new block wins equal-specificity overrides by source order
- `mockups/ctl-compact/mock.css:55-99` | `.ctl-list`/`.ctl-name`/`.ctl-who`/`.ctl-acts`/`.mk-item`/`.va-item`/`.meta`/`.sep`/`.closed-note` + 64rem wrap media query — port, renamed
- `mockups/disputes-compact/mock.css:4-45` | `summary` mechanics, `.chev`, `.dsp-detail`, `.fails-cap`/`.dec-cap`, `.da-item` — port, renamed
- `src/app/refresh.css:162-166` | `.card`/`.card-pad` carry shadow + 1.1rem pad — strips deliberately do NOT use them (`.mk-item` parity)

## Contract
New selectors (all scoped `[data-app="quality"]`, all colors/spacing `--cx-*`
tokens; rem only where the mock uses rem for fonts/icons):
- `.qa-list` — `display:grid; gap:var(--cx-space-2)` (replaces `grid`/`qa-cards` as the strip list container)
- `.qa-card--strip` — `background:var(--cx-surface); border:1px solid var(--cx-line); border-radius:var(--cx-radius-object)`; `display:flex; align-items:center; gap:var(--cx-space-2); padding:var(--cx-space-1) var(--cx-space-3)` (overrides `.qa-card`'s grid by source order)
- `details.qa-card--strip` — `display:block; padding:0` (the `<summary>` is the row)
- `.qa-card--strip > summary` — `list-style:none; cursor:pointer`; plus the same flex/gap/padding row props via shared selector; `::-webkit-details-marker{display:none}`
- `.qa-chev` — `.9rem` square, `flex:none`, `color:var(--cx-ink-3)`, `transition:transform .15s`; `details.qa-card--strip[open] > summary .qa-chev{transform:rotate(90deg)}`; `summary:hover .qa-chev{color:var(--cx-ink)}`
- `.qa-card--strip .qa-name` — `font-weight:var(--cx-weight-strong); white-space:nowrap`; and `.qa-name`, `.pill`, `.cx-chip`, `.qa-acts` inside a strip get `flex:none`
- `.qa-meta` — `display:flex; align-items:center; gap:var(--cx-space-1); min-width:0; flex:1; font-size:var(--cx-text-xs); color:var(--cx-ink-3); white-space:nowrap; overflow:hidden`; `.qa-meta > span{min-width:0; overflow:hidden; text-overflow:ellipsis}`; `.qa-meta .qa-sep{opacity:.55; flex:none}`
- `.qa-note-txt` — `font-size:var(--cx-text-xs); color:var(--cx-ink-2); nowrap+ellipsis truncation; min-width:0; flex:1`
- `.qa-acts` — `display:flex; gap:var(--cx-space-2); flex:none; margin-inline-start:auto`
- `.qa-detail` — `display:grid; gap:var(--cx-space-2); border-top:1px solid var(--cx-line); padding:var(--cx-space-2) var(--cx-space-3) var(--cx-space-3)`; `.qa-detail .qa-reason{margin:0}`; `.qa-detail .qa-ctlform{gap:var(--cx-space-2)}`
- `.qa-cap` — `font-size:var(--cx-text-xs); font-weight:var(--cx-weight-strong); letter-spacing:.05em; text-transform:uppercase; color:var(--cx-ink-3)`
- `@media (max-width:64rem)`: `.qa-card--strip` and `.qa-card--strip > summary` get `flex-wrap:wrap`; `.qa-card--strip .qa-meta` gets `flex-basis:100%; order:5`

Out of scope: editing/removing existing rules (`.qa-card`, `qa-card__head`,
`.qa-cards`, `.qa-actions`, etc. all stay); any other stylesheet; `.mk-*`,
`.va-*`, `.da-*`, `.ctl-*`, `.dsp-*` names must not appear (rename to the
`qa-*` contract above); no `cx-kit.css`/`refresh.css`/`legacy-apps.css` edits.

## Actions
1. Append the strip row + collapse mechanics block: `.qa-list`, `.qa-card--strip` (+`details.` variant), `> summary` + marker, `.qa-chev` (+`[open]` rotate, hover), `.qa-name`/`flex:none` group.
2. Append the truncating-region + actions block: `.qa-meta` (+`> span`, `.qa-sep`), `.qa-note-txt`, `.qa-acts`.
3. Append the expansion block: `.qa-detail` (+`.qa-reason`, `.qa-ctlform` children), `.qa-cap`, and the `64rem` wrap media query.

## Done when
- All Contract selectors present at EOF of quality.css, each under `[data-app="quality"]`, colors/spacing exclusively `--cx-*` tokens
- `.qa-card--strip` row props equal mock `.va-item`/`.da-item > summary`; details marker hidden; chev rotates on `[open]`
- No existing line of the file modified; `git diff` shows append-only

## Verify
- Run: `npx tsc --noEmit` -> exit 0 (CSS must not break the TS gate)
- Run: `findstr /c:"qa-card--strip" /c:"qa-detail" /c:"qa-chev" src\app\styles\quality.css` -> all three selectors found

## Handoff
Publishes the class contract listed in `00-index.md`; S02/S03/S04 consume these
class names verbatim — they may not invent alternatives.
Write results/S01.md (<=10 lines); TL alone updates TRACKER.md.
