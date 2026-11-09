# FIX-04: pollTick returns server `now` instead of client clock
Kind: mini
ID: FIX-04
Parent: -
Owner: dev
Depends: none
Criteria: qa-1 finding qa-4
Skills: none
Budget: files=1; actions=1; changed_lines=10; minutes=4

## Goal
`alertsApi.pollTick` stops fabricating `now` from the client clock and returns
the server `now` that `/api/popups` already sends — removing clock skew from
soon->start alert promotion.

## Files
- Edit: `src/features/shared/shell/context.ts` | `pollTick` body + its response type (lines 113-122)

## Context
- `src/features/shared/shell/context.ts:113-122` | current code: `return { ...data, now: new Date().toISOString() }`
- `src/app/api/popups/route.ts:10` | payload already includes `now` (`{ popups, alerts, now }`)
- `src/features/shared/components/shell/Popups.tsx:44` | sole consumer — type stays `{ popups, alerts, now }`

## Contract
- Widen the `getJson` generic to `{ popups: ShellPopup[]; alerts: OneOnOneAlert[]; now: string }`.
- Return `data.now` (pass the payload through). If `now` is ever absent,
  fall back to the client clock — keep the fallback one line.
- No signature change; Popups.tsx needs no edit.
Out of scope: other shellApi/alertsApi members, the /api/popups route,
anything outside context.ts.

## Actions
1. Type the payload with `now` and return the server value (one-line client fallback allowed).

## Done when
- `pollTick` resolves `now` from the payload; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> 0; `npx vitest run tests/golden` -> green (shell consumers).

## Handoff
none. Write results/FIX-04.md (<=10 lines); TL alone updates TRACKER.md.
