# S05-02: people-holidays — head + cards + empty normalization
Kind: mini
ID: S05-02
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=160; minutes=10

## Goal
`people-holidays-page.tsx` gets the shared patterns: one-line head,
`.card`-framed holiday/roster content, `.empty` for empty lists.

## Files
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | head + holiday/roster sections

## Context
- `mockups/pages/02-home.html:79-88` | head reference
- `src/features/cx-hub/components/people-holidays-page.tsx` | current head + sections

## Contract
- Head one-line sub; content sections wrapped in `.card`/`.card-head`
  (country tables, holiday lists); statuses → `.pill`; empty branches →
  `.empty`; `D()` kept; no logic changes; do not edit styles/hub.css.

## Actions
1. Normalize head (`page-head`/`page-sub` one line).
2. Wrap the main lists/tables in `.card`s.
3. `.pill` statuses + `.empty` empty branches.
4. `npx eslint` the file.
5. `npx tsc --noEmit` clean.

## Done when
- Page matches the shared pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-02.md (<=10 lines); TL alone updates TRACKER.md.
