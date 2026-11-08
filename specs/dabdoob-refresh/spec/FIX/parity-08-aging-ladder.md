# PX-08: /aging — drop the duplicated band-ladder section
Kind: mini
ID: PX-08
Parent: FIX-PARITY
Owner: dev
Depends: none
Criteria: reports/ux-parity.md M5 (MED)
Skills: none
Budget: files=1; actions=4; changed_lines=45; minutes=5

## Goal
Mock 05 `/aging` is: page-head → "Wait-time distribution" `.card`
(mixbar + legend) → "By queue × age" `.card` matrix → ticket list. The
app wraps the matrix in an extra `cx-section` whose head + `<AgeLadder>`
panel repeat the distribution bar's job ("How long open tickets have
waited"). Remove the duplicated ladder block so the matrix `.card`
follows the distribution card directly; band filtering stays on the
mixbar and matrix cells.

## Files
- Edit: `src/features/cx-queue/components/aging-page.tsx` | the second `cx-section` block (~L212-233): remove `cx-section__head` + `cx-panel`/`AgeLadder`; keep the matrix `.card`; drop `AgeLadder` from the import on ~L6

## Context
- `mockups/pages/05-aging-cases.html:57-104` | mock order: distribution
  `.card` then matrix `.card` ("By queue × age", hint "Select a cell")
- `aging-page.tsx:212-233` | `<section className="cx-section"
  aria-labelledby="ladder-h">` head + `<div className="cx-panel
  cx-panel--pad">` `<AgeLadder …>` + the matrix `.card` (card-head
  "By queue × age" + `>10d` pill + `.tbl` + `card-pad` note) all nested
  in that one section
- `aging-page.tsx:160-211` | the "Wait-time distribution" card — mixbar
  segments already call `pick(band === i && !queue ? null : i)` (same
  band-only filtering the ladder duplicated)
- `aging-page.tsx:6` | `AgeLadder` is imported from `./shared` and used
  ONLY at ~L218 — remove it from the import; do NOT delete the export
  from `shared.tsx` (other code may use it)

## Contract
- Final DOM inside `n ? (<>)`: distribution `.card` → matrix `.card`
  → `cx-hint` → `list-h` section. No `cx-section` wrapper, no
  `ladder-h`, no `AgeLadder`, no `cx-panel` panel.
- Keep the matrix `.card` byte-identical (head, `>10d` pill, `.tbl`
  cells, `.cx-agechip` `pick(V, x)` handlers, trailing `card-pad` note).
- Band-only filtering still works via the mixbar (`pick(i)`/`pick(null)`)
  and matrix cells (`pick(V, x)`); `band`/`queue` hash state unchanged.
- Keep `aria-labelledby` on `list-h` section, all e2e hooks, `AsOfHint`,
  `RefreshNow`, skeleton/error paths untouched.

## Actions
1. Delete the `cx-section` open tag + `cx-section__head` block.
2. Delete the `cx-panel cx-panel--pad` div containing `<AgeLadder>`.
3. Re-home the matrix `.card` as a direct child of the fragment (dedent) and delete the stray `</section>` close tag for the removed wrapper (NOT the `list-h` one).
4. Remove `AgeLadder` from the import; `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- `/aging` renders distribution card → matrix card → hint → ticket list;
  no "How long open tickets have waited" section and no band-ladder.
- Clicking a mixbar band still filters the matrix; matrix cells still
  list tickets; `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/features/cx-queue/components/aging-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "AgeLadder\|ladder-h\|How long open tickets" src/features/cx-queue/components/aging-page.tsx` -> 0 hits

## Handoff
none.
Write results/PX-08.md (<=10 lines); TL alone updates TRACKER.md.
