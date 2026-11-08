# S05-11: one-on-ones + tl-tasks — head/card/empty normalization
Kind: mini
ID: S05-11
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=200; minutes=10

## Goal
`one-on-ones-page.tsx` and `tl-tasks-page.tsx` take the shared patterns.

## Files
- Edit: `src/features/cx-people/components/one-on-ones-page.tsx` | head + one-on-ones sections
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | head + tl-tasks sections

## Context
- `src/features/cx-people/components/pw.tsx:131-149` | shared `.pw-page` + `.page-head` shell both pages use
- `mockups/pages/03-my-day.html:80-105` | worklist + pill reference (same people family)
- the two page files | current list/detail/form regions

## Contract
- Heads (pw shell) one-line; 1:1 records/tasks framed as `.card` lists or
  `.workitem` rows; statuses → `.pill`/`data-status`; empty branches →
  `.empty`; `D()` kept; no logic changes; do not edit styles/people.css
  or pw.tsx.

## Actions
1. one-on-ones: head + card framing.
2. one-on-ones: pills + `.empty`.
3. tl-tasks: head + card framing.
4. tl-tasks: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-11.md (<=10 lines); TL alone updates TRACKER.md.
