# S05-16: kpi-logs + mail-desk — head/card/empty normalization
Kind: mini
ID: S05-16
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=180; minutes=10

## Goal
`kpi-logs-page.tsx` and `mail-desk-page.tsx` take the shared patterns.

## Files
- Edit: `src/features/cx-desk/components/kpi-logs-page.tsx` | head + kpi-logs sections
- Edit: `src/features/cx-desk/components/mail-desk-page.tsx` | head + mail-desk sections

## Context
- `kpi-logs-page.tsx:66-70`, `mail-desk-page.tsx:136-140` | `.page-head`/`route.purpose` subs
- `mockups/pages/06-audit-desk.html` | card/workitem list reference

## Contract
- Heads one-line; log forms + mail threads framed as `.card`/
  `.workitem`; statuses → `.pill`/`data-status`; empty branches →
  `.empty`; `D()` kept; no logic changes; do not edit styles/desk.css;
  keep `LogForm`/`RemoveBtn` behavior unchanged.

## Actions
1. kpi-logs: head + card framing.
2. kpi-logs: pills + `.empty`.
3. mail-desk: head + card framing.
4. mail-desk: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-16.md (<=10 lines); TL alone updates TRACKER.md.
