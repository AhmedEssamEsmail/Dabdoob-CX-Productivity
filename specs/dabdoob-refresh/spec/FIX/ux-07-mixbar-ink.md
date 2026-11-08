# FUX-07: queue mixbar — per-segment `--cx-age-ink-*` label color
Kind: mini
ID: FUX-07
Parent: FIX-UX1
Owner: dev
Depends: none
Criteria: reports/ux-1.md ux-7 (MED)
Skills: none
Budget: files=1; actions=2; changed_lines=6; minutes=4

## Goal
`.mixbar > div` forces `color: var(--cx-accent-ink)` (#fff) onto every
segment; on the light age-ramp fills (`--cx-age-0..3`) the count labels
measure 2.5–2.8:1 (need 4.5). aging-page already solves this with an
inline `color: var(--cx-age-ink-N)` per segment — apply the same in the
queue mixbar so white survives only on age≥4 fills.

## Files
- Edit: `src/features/cx-queue/components/queue-page.tsx` | `.mixbar` segment `style` only (~L185-197)

## Context
- `queue-page.tsx:149` | `bandColor = (idx) => \`var(--cx-age-${ageRank(idx, d.length)})\`` — the fill token
- `queue-page.tsx:181-197` | the `.mixbar` map: segment `style={{ flexGrow…, flexBasis: 0, background: bandColor(idx) }}`
- `src/features/cx-queue/components/aging-page.tsx:172-179` | precedent: same mixbar sets `color: \`var(--cx-age-ink-${r})\`` inline
- `src/app/theme.css:184-190` | `--cx-age-ink-0..3` dark, `--cx-age-ink-4..6` #fff
- `reports/ux-1.md` row ux-7 | exact fix

## Contract
- In the queue `.mixbar` segment `<div>`, add to the existing `style`
  object: `color: \`var(--cx-age-ink-${ageRank(idx, d.length)})\`` —
  same rank expression `bandColor` uses.
- Do NOT change `refresh.css .mixbar > div` (stays the accent-ink
  default for the tph mixbar's accent/bad fills), the legend `<i>`s
  (no text), `pickBand`, `aria-*`, or `flexGrow` math.
- Out of scope: aging-page (already correct), tph-grid mixbar
  (unflagged), any other queue markup.

## Actions
1. Add the `color: var(--cx-age-ink-<rank>)` property to the segment style.
2. `npx eslint src/features/cx-queue/components/queue-page.tsx` + `npx tsc --noEmit` clean.

## Done when
- Queue mixbar segment labels render `--cx-age-ink-*` matching their fill rank (dark on age 0-3, white on 4-6).
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/features/cx-queue/components/queue-page.tsx && npx tsc --noEmit` -> clean

## Handoff
none.
Write results/FUX-07.md (<=10 lines); TL alone updates TRACKER.md.
