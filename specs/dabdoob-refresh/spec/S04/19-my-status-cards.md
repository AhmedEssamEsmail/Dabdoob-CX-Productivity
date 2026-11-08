# S04-19: my-status — "Your flags" worklist card + right-column cards
Kind: mini
ID: S04-19
Parent: S04
Owner: dev
Depends: S04-18
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=200; minutes=10

## Goal
Body of `my-status-page.tsx` matches mock 10: left `.card` "Your flags"
as workitem rows (keeping `.pv-cards`/`.pv-strip` hooks), right column
"Before vs after" `.hbar-row` card + "What you can do" card.

## Files
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | body below stats

## Context
- `mockups/pages/10-my-status.html:64-105` | the three cards
- `e2e/my-status.spec.ts:34-48,50-62` | hooks: `.pv-cards article`, `.pv-strip`, `.cx-chip[data-status]`, heading "No flags in the last 45 days", "No logged time this week yet."
- `src/features/cx-productivity/components/my-status-page.tsx` | current flag cards + metrics

## Contract
- Two-col layout (~1.6fr 1fr): left `.card` "Your flags" `.card-head`
  (title + `card-hint` dispute window); rows become `.workitem`-layout
  flag entries BUT keep `.pv-cards` wrapper, `article`, `.pv-strip`,
  `.cx-chip[data-status]` (additive classes); `.wi-side` `.pill` mirrors
  the review state (warn under review / ok accepted / bad disputed).
- Right column: `.card` "Before vs after" — `.hbar-row` raw/reviewed
  `.bar`s + `.spark` week trend (real metrics); `.card` "What you can
  do" — `.card-pad.small` muted bullet list (real actions copy).
- Empty states keep the exact e2e texts: heading "No flags in the last
  45 days" and "No logged time this week yet." — render them inside
  `.empty` markup (text preserved).

## Actions
1. Two-col wrapper; "Your flags" `.card` + `.card-head`.
2. Restyle flag articles to `.workitem` rows (hooks kept).
3. "Before vs after" `.card` with `.hbar-row` + `.spark`.
4. "What you can do" `.card`.
5. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Body matches mock 10; `.pv-cards`/`.pv-strip`/`.cx-chip` intact.
- Both empty-state texts still render verbatim.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — my-status done.
Write results/S04-19.md (<=10 lines); TL alone updates TRACKER.md.
