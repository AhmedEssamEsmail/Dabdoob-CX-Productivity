# FIX-01: Opt app out of blocking prerender (`instant = false` on root layout)
Kind: mini
ID: FIX-01
Parent: -
Owner: dev
Depends: none
Criteria: qa-1 finding qa-1 (BLOCKER); PLAN #11 (next build gate)
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=6

## Goal
`next build` stops failing on "uncached or runtime data during prerendering":
the root layout awaits `getAppBootstrap` -> `cookies()`, which is inherently
per-request for every route (all behind auth). Opt the whole app out of the
static-shell/instant validation by exporting `instant = false` from the root
layout, per the build error's `[block]` hint.

## Files
- Edit: `src/app/layout.tsx` | add the route-segment config export only

## Context
- `src/app/layout.tsx:21-28` | async RootLayout awaiting getAppBootstrap (the blocking data access — do NOT move/remove it)
- `specs/perf-remediation/logs/qa-build.log:15-24` | the exact error + `[block] Set export const instant = false` hint
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md:85-89` | "Setting false on the root layout disables static shell validation for the entire app"

## Contract
- Add `export const instant = false` (top-level, beside `export const metadata`) with a <=2-line comment citing the auth/bootstrap data access as the reason.
- Do NOT touch `getAppBootstrap`, `__CC_BOOT__`, markup, or imports. No `connection()`/`use cache` experiments — the PM-chosen fix is the opt-out.
Out of scope: per-route `instant` flags, Suspense refactors, next.config.ts.

## Actions
1. Add the `instant = false` export + comment to `src/app/layout.tsx`.
2. Verify the build now passes prerendering.

## Done when
- `export const instant = false` present in `src/app/layout.tsx`.
- `next build` exits 0 (no blocking-prerender error on /audit-queue or any route).

## Verify
- Run: `next build` -> exit 0 (log to specs/perf-remediation/logs/fix01-build.log, tail last 20 lines for results).

## Handoff
Unblocks the `next build` PLAN gate. Write results/FIX-01.md (<=10 lines);
TL alone updates TRACKER.md.
