# Fix: cx-kit.css porting gaps (ux-1, ux-2, ux-3, ux-7, ux-8, ux-9, ux-10)

Slug: fix-ux-1-cxkit. Project root: `C:\Users\AHMED\KPIs\CX-Hub`.
Owner: dev     Source: `specs/redesign/reports/ux-1.md` findings ux-1 (BLOCKER), ux-2 (HIGH), ux-3 (HIGH), ux-7/8/9/10 (MED).
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Findings
- **ux-1 (BLOCKER)** `src/app/cx-kit.css:328-332` `.cx-toggle` — legacy `.cx-toggle>span` pill + `input:checked+span` (accent-soft + ✓) + `input:focus-visible+span` rules were never ported. Checkbox is invisible, `<span>` is bare text → checked state imperceivable (people-holidays "Days off", audit-queue exclusion toggles, `ui/Toggle`). Re-author pill/border/min-height, checked state, focus ring — or restyle on the `.cx-switch__track` pattern.
- **ux-2 (HIGH)** `cx-kit.css:326,331-332` — `.cx-seg input`, `.cx-toggle input`, `.cx-switch input` all hide inputs `position:absolute;opacity:0` with NO focus-visible rule → zero keyboard focus indicator (WCAG 2.4.7). Add e.g. `.cx-seg input:focus-visible+span{outline:2px solid var(--cx-focus);outline-offset:-3px}`, same for `.cx-toggle>span` and `.cx-switch .cx-switch__track` (check actual DOM sibling/order; use `:has(input:focus-visible)` if track isn't adjacent).
- **ux-3 (HIGH)** `cx-kit.css:256` field rule `.input/.select/.cx-input/.cx-select/.cx-textarea` uses `border:… var(--cx-line)` ≈1.2–1.3:1 vs surfaces — <3:1 component boundary (1.4.11). Change to `var(--cx-line-strong)` (buttons already use it).
- **ux-7 (MED)** Three collapse breakpoints from `globals.css` never ported → h-scroll <~420px on checkins: `@media(max-width:1180px)` `.cx-grid-2/.cx-split*/.cx-sidelayout→1fr`, `.cx-queuerow→2col`; `@media(max-width:900px)` `.cx-grid-3/.cx-dayrail→1fr`; `@media(max-width:600px)` `.cx-queuerow/.cx-dayrail/.cx-hc__*/.cx-typecards→1fr`. Port them (find legacy blocks in `src/app/globals.css`).
- **ux-8 (MED)** `cx-kit.css:303` `.cx-seg` — restore dropped `flex-wrap:wrap;max-inline-size:100%` (with `overflow:hidden`+nowrap options clip on narrow containers).
- **ux-9 (MED)** `cx-kit.css:63-69` `--age-tint`/`--age-stripe` tokens dead — legacy `.cx-table tr[data-age] td{background:var(--age-tint)}` + escalating `border-inline-start` stripe not ported → aging rows (`aging-page.tsx` `tr[data-age]`) lose severity shading. Re-add rules (see `globals.css` for per-value escalation) or remove dead tokens — prefer re-adding.
- **ux-10 (MED)** `cx-kit.css:488` `.pending` — `border-inline-start` (logical) + `padding:4px 0 4px 1rem` (physical) breaks RTL (border flips, padding doesn't). Fix: `padding:4px 0; padding-inline-start: var(--cx-space-4)`.

## Goal
All seven findings fixed inside `cx-kit.css`, matching legacy visuals/behaviour where the report says "port", keeping the file's `:root .cls` (0,2,0) specificity convention and logical-property style.

## Files (only these)
- `src/app/cx-kit.css`

## Rules
- `src/app/globals.css` is still on disk (unimported) — it is your reference for every "port from legacy" fix. Port faithfully onto `--cx-*` tokens; no literal hex except inside existing-token patterns.
- Keep the `:root .cls` specificity convention; do not introduce `!important`, do not touch other files, do not reorganize unrelated rules.
- ux-1: check `src/features/shared/components/ui/Toggle.tsx` + people-holidays/audit-queue markup for the real DOM (input + span order) before writing selectors — read-only, do NOT edit tsx.

## Verify
1. `grep -n "cx-toggle\|data-age\|focus-visible" src/app/cx-kit.css` shows the new rules; `npx tsc --noEmit` 0 errors; `npx eslint src` 0 errors (css isn't linted — confirm tree clean).
2. Update your TRACKER Review-findings rows (ux-1, ux-2, ux-3, ux-7, ux-8, ux-9, ux-10) → done with evidence. Reply <=100 words.
</content>
