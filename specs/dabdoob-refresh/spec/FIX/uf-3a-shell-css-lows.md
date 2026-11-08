# FUX-14: refresh.css — deferred shell LOWs ux-9, ux-10, ux-11
Kind: mini
ID: FUX-14
Parent: FIX-UF
Owner: dev
Depends: FUX-10 (same file — serial after the shared-family move)
Criteria: reports/user-fix-round.md UF-3 (MED); reports/ux-1.md ux-9/10/11
Skills: none
Budget: files=1; actions=3; changed_lines=35; minutes=6

## Goal
Fix three deferred LOW CSS findings in `src/app/refresh.css`: (ux-9)
`.cpk-input` is the bare `<input>` — the stylesheet styles a container +
dead `.cpk-input input` selector, so the field shows placeholder-ish ink and
UA borders; (ux-10) `--cx-ink-3` on `--cx-bg` measures 4.42:1 — retarget the
two on-page uses to `--cx-ink-2`; (ux-11) `.rail-search` label wraps/clips
and misses the 36px target contract.

## Files
- Edit: `src/app/refresh.css` | `.topbar .crumbs` (L13), `.rail-search` block (L79-92), `.cpk-input` block (L116-125), `.ag-t` (L456)

## Context
- `src/features/shared/components/shell/CommandPalette.tsx:176-191` | the `<input className="cpk-input">` IS the field (no wrapper)
- `reports/ux-1.md` rows ux-9/ux-10/ux-11 | exact fix directions
- `src/app/cx-kit.css:1061` | existing `.rail-off .rail-search` scoped tweak — new rules go in refresh.css alongside `.rail-search`
- `src/app/refresh.css:13` | `.topbar .crumbs` uses `--cx-ink-3`; `src/app/refresh.css:456` `.ag-t` uses `--cx-ink-3` — both sit on `--cx-bg` (page background); `--cx-ink-2` on `--cx-bg` is >=6:1 both themes (per ux-2 verification pattern)

## Contract
- ux-9 (bare-input restyle — report option B): rewrite the `.cpk-input`
  block as input styles — `display:block; width:100%; border:0;
  border-bottom:1px solid var(--cx-line); background:transparent;
  color:var(--cx-ink); font:inherit; font-size:var(--text-md);
  padding:.8rem 1rem; outline:none` plus `::placeholder` in `--cx-ink-3`
  and a `:focus-visible` rule using `--cx-focus` (palette has no other
  focusable node; a subtle inset underline/outline is fine). DELETE the dead
  `:root .cpk-input input` selector. Do NOT add a wrapper/icon (that was the
  other option; markup stays untouched).
- ux-10: `.topbar .crumbs` and `.ag-t` — change `color` to
  `var(--cx-ink-2)`. Do NOT change the `--cx-ink-3` token itself (it is
  fine on surfaces).
- ux-11: on `.rail-search` add `min-height: var(--cx-target)` and
  `white-space: nowrap`; add `.rail-search .rail-search-label {
  min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  display:block }` (the span lands via FUX-15 — ship the rule now); add
  `.rail-off .rail-search { gap:0 }` and `.rail-off .rail-search
  .rail-search-label, .rail-off .rail-search kbd { display:none }` so the
  collapsed rail shows the icon only.
- Out of scope: any .tsx edits (FUX-15 owns AppShell markup), CommandPalette
  internals, token changes in theme.css, other selectors.

## Actions
1. Rewrite the `.cpk-input` rules per ux-9 (delete the dead descendant
   selector).
2. Flip `.topbar .crumbs` and `.ag-t` ink to `var(--cx-ink-2)`.
3. Extend `.rail-search` + rail-off rules per ux-11; `npx tsc --noEmit` still clean (CSS no-op).

## Done when
- `grep -n 'cpk-input input' src/app/refresh.css` -> no hits; `.cpk-input`
  styles apply to the bare input (border:0, ink-ink, bottom separator).
- `.topbar .crumbs` and `.ag-t` read `var(--cx-ink-2)`.
- `.rail-search` has `min-height` + `nowrap`; `.rail-search-label` and the
  `.rail-off` hide rules exist.

## Verify
- Run: `grep -n 'cpk-input\|cx-ink-2\|rail-search' src/app/refresh.css` -> the new rules present
- Run: `grep -c 'cpk-input input' src/app/refresh.css` -> 0

## Handoff
Shell CSS LOWs resolved; FUX-15's `.rail-search-label` span completes
ux-11's ellipsis in markup.
Write results/FUX-14.md (<=10 lines); TL alone updates TRACKER.md.
