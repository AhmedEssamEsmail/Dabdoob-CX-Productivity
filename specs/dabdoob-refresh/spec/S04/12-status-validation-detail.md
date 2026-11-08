# S04-12: status-validation — flag detail card (.md right)
Kind: mini
ID: S04-12
Parent: S04
Owner: dev
Depends: S04-11
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=200; minutes=10

## Goal
Right of `.md` matches mock 07: `.card` flag detail — `.pv-strip`
Logged/Suggested/Reviewed inside a card head/pad, the related-cases area,
and the `.pv-form` decision form — all `.pv-*` hooks intact.

## Files
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | detail region only

## Context
- `mockups/pages/07-status-validation.html:83-160` | detail card (strip, cases, decision form)
- `e2e/status-validation.spec.ts:38-78` | hooks: `.pv-detail`, `.pv-strip`, `.pv-form`, `radiogroup`, `Accept as`/`Revert to` buttons, `.toast`, `.cx-table`
- `src/features/cx-productivity/components/status-validation-page.tsx` | current detail markup

## Contract
- Detail becomes `.card` (`.pv-detail` kept): `.card-head` title =
  flag summary + `.pill` review state; `.card-pad` holds `.pv-strip`
  (Logged/Suggested/Reviewed unchanged), the cases list (restyle rows to
  `.tbl` or `.workitem` as fits, keep data), `.pv-form` (radiogroup +
  Accept/Revert buttons — labels/classes unchanged).
- Decided list below stays `.cx-table` inside a `.card`.
- All decision logic, toasts and refetch wiring unchanged.

## Actions
1. Wrap `.pv-detail` content in the right `.card` + `.card-head`/`.card-pad`.
2. Restyle the cases area to `.tbl`/`.workitem` per content.
3. Wrap the decided table in a `.card` (`.cx-table` kept).
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Detail matches mock 07; `.pv-detail`/`.pv-strip`/`.pv-form`/`.cx-table` intact.
- Accept/Revert still work and toast.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — status-validation done.
Write results/S04-12.md (<=10 lines); TL alone updates TRACKER.md.
