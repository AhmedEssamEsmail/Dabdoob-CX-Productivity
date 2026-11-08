# S02-06: cx-kit.css component reskin — controls, panels, chips, tables, dq-head
Kind: mini
ID: S02-06
Parent: S02
Owner: dev
Depends: S02-05
Criteria: PLAN #4 #5
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1; actions=6; changed_lines=200; minutes=10

## Goal
Existing kit components get the mockup skin so untouched pages inherit the
refresh: buttons/inputs keep geometry but match mock borders/shadows,
`.cx-panel`/`.cx-section` become elevated cards, `.cx-chip` becomes the
pill look, `.cx-table` gets uppercase headers, `.cx-seg`/`.pw-seg` get the
seg-pill look, and `.dq-head`/`.page-purpose` read as page-head/page-sub.

## Files
- Edit: `src/app/cx-kit.css` | controls (~L128-472), panels (~L474-540), chips/notes (~L737+), tables (cx-table region), dq-head (L1129-1145)

## Context
- `mockups/assets/mock.css:176-235` | .btn/.input/.seg/.tabs target look
- `mockups/assets/mock.css:284-298` | .pill tones (target for .cx-chip)
- `mockups/assets/mock.css:317-334` | .tbl target (target for .cx-table)
- `src/app/cx-kit.css:1129-1145` | .dq-head/.page-title/.page-purpose current rules

## Contract
All edits keep the `:root .cls` form and token colors; geometry contract
unchanged (min-height `--cx-target`, 1px borders, td ≈13px, row ≤36px):
1. `.btn/.cx-btn`: radius from `--cx-radius-control` (now 10px), subtle
   `box-shadow: var(--shadow-1)`; `.btn-quiet` transparent+borderless;
   add `.btn-sm/.cx-btn--sm` small variant (h 1.9rem) as alias of
   `.btn-small`; `.btn-danger-soft` (bad-soft bg/bad text) new variant.
2. `.input/.cx-input`: `--cx-radius-control`, 1px `--cx-line-strong`,
   focus = `--cx-focus-ring` (keep existing focus behavior).
3. `.cx-panel`: `border-radius: var(--cx-radius-object)` (14px) +
   `box-shadow: var(--shadow-1)`; `.cx-section__title` keeps hierarchy.
4. `.cx-chip`: pill look — `border-radius: 999px`, status-token bg/fg,
   `::before` 6px status dot (respect `[data-status]`); keep class + data
   attrs (e2e hooks). `.cx-agechip` unchanged.
5. `.cx-table`/`table`: `th` uppercase .6875rem `--cx-ink-3` tracking .05em;
   row hover `--cx-surface-2`; row ≤36px kept.
6. `.cx-seg`/`.pw-seg`: outer = `--neutral` soft group (use
   `--cx-surface-2` bg + radius 9-10px, no outer border), selected label/
   button = `--cx-surface` + `--shadow-1` (mock .seg look); keep input-
   hiding + focus rings.
7. `.dq-head` + `.dq-head__aside` + `.page-purpose`: match mock
   `.page-head` spacing/type (`--text-md` sub, `--cx-ink-2`, max 62ch) so
   shared PageHead helpers render the refreshed head unchanged.

## Actions
1. Buttons + new `.btn-sm`/`.btn-danger-soft` variants.
2. Inputs/selects border+radius alignment.
3. `.cx-panel` elevation + `.cx-section` polish.
4. `.cx-chip` pill reskin (dot + tones via `--st-*` already scoped).
5. `.cx-table` header/row reskin.
6. `.cx-seg`/`.pw-seg` + `.dq-head`/`.page-purpose` alignment.

## Done when
- `.cx-chip[data-status]` renders as a dotted pill in light AND dark.
- `.cx-table` headers are uppercase tracked; rows still ≤36px.
- `.dq-head` visually matches `.page-head` (spacing/type) with no markup change.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
Un-touched pages (S05) inherit the reskin; S04 pages can mix `.cx-*` and
new refresh classes safely (identical look contract).
Write results/S02-06.md (<=10 lines); TL alone updates TRACKER.md.
