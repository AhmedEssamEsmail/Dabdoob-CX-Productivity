# NAV-02: collapsible nav styles — label button, chevron, rail-off
Kind: mini
ID: NAV-02
Parent: NAV
Owner: dev
Depends: NAV-01 (needs the `button.nav-group-label` / `.nav-chevron` / `ul[hidden]` hooks)
Criteria: spec/NAV/user-nav-round.md NAV-2 + NAV-4 ("compact as mockup", rail-off/mobile kept)
Skills: none
Budget: files=1; actions=5; changed_lines=70; minutes=6

## Goal
Style the new collapsible nav to the mockup: `.nav-group-label` is now a
`<button>` and needs a full button-reset at mockup compactness, a small
`.nav-chevron` that indicates open/closed state, an explicit `[hidden]`
rule for collapsed lists, and rail-off adjustments so the header stays
compact and operable icon-only. No `.nav-link` sizing changes (density
contract `--cx-target`).

## Files
- Edit: `src/app/refresh.css` | append `:root`-scoped nav rules at end of file (project convention: one rule per line, `:root ` prefix)

## Context
- `src/app/cx-kit.css:911-1014` | base rules being layered over — `.nav-group-label` (~L932) is styled for a `<p>` (needs button reset), `.nav-link` focus/hover pattern (~L959-966) to mirror for the label, `.nav-ext` rules (~L1002-1014) become dead CSS — leave them (non-goal to prune)
- `mockups/assets/mock.css:108-134` | contract: label `font-size .6563rem; font-weight 650; letter-spacing .07em; uppercase; color ink-3; padding 0 .55rem .35rem`
- `spec/NAV/nav-01-unified-collapsible-nav.md` Contract | exact hooks shipped by NAV-01: `button.nav-group-label[id][aria-expanded][aria-controls][aria-label]`, `.nav-label-text` span, `.nav-chevron` svg (`m6 9 6 6 6-6`), `ul[id][hidden][aria-labelledby]`
- `src/app/refresh.css` tail | existing `:root button.dq-*` reset style to mirror (`font:inherit; border:0; background:none; cursor:pointer`)

## Contract
- `:root .nav-group-label` -> button reset + mockup metrics: `display:flex;
  align-items:center; justify-content:space-between; gap:var(--cx-space-2);
  inline-size:100%; margin:0; padding:0 var(--cx-space-2) var(--cx-space-1);
  border:0; background:none; font:inherit; font-size:.6563rem;
  font-weight:650; letter-spacing:.07em; text-transform:uppercase;
  color:var(--cx-ink-3); cursor:pointer; text-align:start`
- `:root .nav-group-label:hover` -> `color:var(--cx-ink)`; `:focus-visible`
  mirrors the `.nav-link:focus-visible` treatment already in cx-kit
  (outline/offset — copy the existing pattern, don't invent a new ring).
- `:root .nav-chevron` -> `flex:none; inline-size:.75rem; block-size:.75rem;
  fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round;
  stroke-linejoin:round; opacity:.6; transition:transform var(--cx-dur)
  var(--cx-ease)`; `:root .nav-group-label[aria-expanded="false"]
  .nav-chevron { transform:rotate(-90deg) }` (closed = chevron points
  inline-end/down-side, open = down).
- `:root .nav ul[hidden] { display:none }` — explicit, so a future
  `display` rule on `.nav ul` cannot silently un-hide collapsed lists.
- Rail-off (min-width:821px): `:root .rail-off .nav-group-label
  { justify-content:center; padding-inline:0 }` and `:root .rail-off
  .nav-label-text { display:none }` — chevron stays visible and the button
  (which carries `aria-label`) stays operable/icon-accessible.
- Do NOT touch: `.nav-link` metrics (density contract), `.nav-ind`,
  `.nav-ext*` (dead but harmless), cx-kit.css, mobile `.nav-open` rules.
- Out of scope: any file but refresh.css; markup changes; JS.

## Actions
1. Append the `.nav-group-label` button-reset + mockup metrics rules.
2. Append hover / focus-visible rules for the label.
3. Append `.nav-chevron` base + `[aria-expanded="false"]` rotation rules.
4. Append `ul[hidden]` + the two rail-off rules.
5. `npx eslint src/app/refresh.css` (or project css lint target) + visual
   check via `git diff src/app/refresh.css`.

## Done when
- Label renders as a compact uppercase mockup header button: label text
  start, chevron end; hover/focus states visible; collapsed group shows
  rotated chevron and `display:none` list.
- Rail-off shows icon-only groups with a visible, clickable chevron header
  (button keeps its `aria-label`); expanded/collapsed still works.
- No `.nav-link`/`.nav-ind`/`--cx-target` regressions (git diff touches
  only the appended rules); eslint 0 errors.

## Verify
- Run: `git diff src/app/refresh.css` -> only appended `:root` nav rules
- Run: `grep -n 'nav-group-label\|nav-chevron\|nav-label-text\|ul\[hidden\]' src/app/refresh.css` -> the new rules present

## Handoff
Completes NAV-2 styling + NAV-4 rail-off compactness for NAV-03 e2e to
verify at 320px/mobile.
Write results/NAV-02.md (<=10 lines); TL alone updates TRACKER.md.
