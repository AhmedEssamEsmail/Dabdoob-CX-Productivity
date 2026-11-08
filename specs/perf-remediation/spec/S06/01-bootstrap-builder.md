# S06-01: Extract getAppBootstrap() into platform; drop options from the payload
Kind: mini
ID: S06-01
Parent: S06
Owner: dev
Depends: S01-02
Criteria: PLAN #6 (bootstrap usable outside the route; options fetched lazily)
Skills: none
Budget: files=3; actions=3; changed_lines=90; minutes=6

## Goal
Move the `/api/bootstrap` GET body into a reusable
`platform/bootstrap.ts#getAppBootstrap()` so the root layout can emit the
same payload server-side (S06-02). The `allOptions()` call and the
`options` field leave the payload — dropdowns already fetch
`/api/options/[listKey]` on demand.

## Files
- Create: `src/features/shared/platform/bootstrap.ts` | `import 'server-only'`; `getAppBootstrap()` = the current route body
- Edit: `src/app/api/bootstrap/route.ts` | GET delegates to `getAppBootstrap()` with the same error mapping
- Edit: `src/features/shared/platform/index.ts` | `export * from './bootstrap'` IF bootstrap.ts needs barrel export for the layout import (check how sibling modules are surfaced; skip if the layout can deep-import)

## Context
- `src/app/api/bootstrap/route.ts:13-57` | the body to move verbatim, minus `allOptions()` and `options: {}`/the options field
- `src/features/shared/shell/context.ts:50-57` | `Bootstrap` interface — no `options` field exists (client never read it; evidence for safe removal)
- `src/features/shared/platform/popups.ts`, `settings.ts` | imports the builder needs (currentUser, viewAsState, pendingPopupsFor, appUrls, qaBootFlags, pwKwTime/pwKwDate, KUWAIT_TZ, assistantOwnerEmail)

## Contract
- `getAppBootstrap(): Promise<Record<string, unknown>>` — identical fields to today's payload minus `options` (user, popups, serverTime, serverDate, serverAt, timeZone, isOwner, app, appUrls, quality, viewAs); the 'unknown'-role limited shape also drops its `options`/`popups: []` extras consistently (keep popups: [] there — that shape is part of the limited contract; only `options` goes).
- `allOptions` no longer imported by the route or bootstrap.ts.
- Error path unchanged: throw -> route maps 'Unauthorized'->401 else 403. The BUILDER just throws; mapping stays in the route.
- `/api/options` + `/api/options/[listKey]` routes untouched.
Out of scope: layout.tsx (S06-02), any component.

## Actions
1. Create bootstrap.ts with the moved body (no `allOptions`, no `options` field).
2. Route: call `getAppBootstrap()`; keep the try/catch status mapping.
3. Wire the export path the layout will use (barrel or deep import — verify what the codebase convention allows, e.g. viewas deep import at components).

## Done when
- GET /api/bootstrap returns the same payload minus `options`.
- `allOptions()` is not called anywhere in the bootstrap path.
- `npx tsc --noEmit` clean; `npx vitest run tests/api-fragments` green where bootstrap-shaped.

## Verify
- Run: `npx vitest run tests/api-fragments` -> all pass.

## Handoff
`getAppBootstrap()` (throws on unauthenticated) is the function S06-02 wraps
in the layout. Write results/S06-01.md (<=10 lines); TL alone updates TRACKER.md.
