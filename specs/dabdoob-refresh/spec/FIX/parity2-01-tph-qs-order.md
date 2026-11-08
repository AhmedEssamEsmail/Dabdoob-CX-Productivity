# P2-01: /tph — move `<Qs>` card pair inside `summary` after stats (head→tabs→note→stats→cards)
Kind: mini
ID: P2-01
Parent: FIX-PARITY2
Owner: dev
Depends: none
Criteria: reports/ux-parity-2.md ux-p2-1 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=5

## Goal
Mock 09 `/tph` order is `head → .tabs → .note → stats → cards`. The app
renders `head → <Qs> (cap-mixbar card + needs-attention card) → .tph-tabs
→ note → stats`, because `<Qs>` mounts in the page JSX before `<Ga>`.
Move `<Qs>` into the existing `summary` fragment after the `.grid-5`
stats block so the card pair sits under the tabs like the mock.

## Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | `TphGridPage` (~L2155-2241): the `summary` fragment + the `<Qs>` mount line

## Context
- `specs/dabdoob-refresh/reports/ux-parity-2.md` open-findings row ux-p2-1 | exact fix prescribed there
- `mockups/pages/09-tph.html:60-90` | order: head → `.tabs` → `.note` → stats → `.cards`
- `tph-grid-page.tsx:2155-2216` | `summary` = `<>` warn `note` + `grid grid-5` stats `</>`, only built when `d && sum`
- `tph-grid-page.tsx:2217-2241` | page JSX: `page-head` → error/skeleton → `{d && sum ? <Qs …/> : null}` (L2239) → `<Ga summary={summary}>`
- `tph-grid-page.tsx:1948-1990` | `Ga` renders lock notices → `<Ya>` tabs → `{summary}` → panels (slot already exists; do NOT touch `Ga`)

## Contract
- Inside `summary`'s fragment, render `<Qs d={d} sum={sum} />` immediately
  AFTER the `grid grid-5` closing `</div>` (stats stay first, then the
  cap-chart + needs-attention card pair).
- Delete the standalone `{d && sum ? <Qs d={d} sum={sum} /> : null}` line
  in the page JSX — `Qs` must render exactly once.
- `summary` is already gated on `d && sum`; keep that gate (same
  condition `Qs` had — no behaviour change when data is absent).
- Do NOT change `Ga`, `Ya`, `Qs` internals, `Xa`, any panel, or any
  other file. No CSS edits.

## Actions
1. In `summary`'s fragment, insert `<Qs d={d} sum={sum} />` after the `.grid grid-5` div's closing tag.
2. Remove the `<Qs>` mount line (≈L2239) before `<Ga>` in the page JSX.
3. `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- DOM order: `.page-head` → lock notices (if any) → `.tph-tabs` → warn
  `note` (if pending) → `grid grid-5` stats → `Qs` card pair → active
  `tph-panel`.
- `tph-cap-h` and `tph-attn-h` headings appear exactly once in the DOM.
- `npx tsc --noEmit` + `npx eslint` on the file clean.

## Verify
- Run: `npx eslint src/features/cx-productivity/components/tph-grid-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "<Qs" src/features/cx-productivity/components/tph-grid-page.tsx` -> exactly 1 hit, inside the `summary` fragment after `grid grid-5`

## Handoff
none.
Write results/P2-01.md (<=10 lines); TL alone updates TRACKER.md.
