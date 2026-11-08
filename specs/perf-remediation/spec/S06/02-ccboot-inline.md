# S06-02: Root layout emits window.__CC_BOOT__ server-side
Kind: mini
ID: S06-02
Parent: S06
Owner: dev
Depends: S06-01
Criteria: PLAN #6 (__CC_BOOT__ emitted in root HTML)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=1; actions=3; changed_lines=60; minutes=7

## Goal
`src/app/layout.tsx` renders the per-request bootstrap payload as
`window.__CC_BOOT__` in the HTML so the shell's first paint skips the
`/api/bootstrap` fetch (`loadBootstrap` already prefers `__CC_BOOT__` —
context.ts:122-126).

## Files
- Edit: `src/app/layout.tsx` | add an inline `<script>` in `<body>` (before `<SiteChrome>`) that sets `window.__CC_BOOT__`

## Context
- `src/app/layout.tsx:19-52` | server component; already ships two `dangerouslySetInnerHTML` boot scripts (APPEARANCE_BOOT pattern to copy)
- `src/features/shared/platform/bootstrap.ts` | `getAppBootstrap()` from S06-01 — throws on unauthenticated
- `src/features/shared/shell/context.ts:122-126` | `loadBootstrap`: `__CC_BOOT__` wins, else /api/bootstrap — emitting `null` keeps the fallback identical
- `node_modules/next/dist/docs/01-app/02-guides/scripts.md` | inline-script guidance for this Next version — read first, cite in results
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` | request-scoped data in layouts — verify the layout renders dynamically (cookies-dependent code already does this via the auth chain)

## Contract
- The emitted markup is `<script dangerouslySetInnerHTML={{ __html: 'window.__CC_BOOT__=' + safe + ';' }} />` where `safe` is `JSON.stringify(payload)` with `<` escaped to `\\u003c` (prevents `</script>` breakout — match the existing inline-script style).
- On any throw from `getAppBootstrap()` (unauthenticated /auth pages included): emit `window.__CC_BOOT__=null;` — NEVER a redirect, never swallowed admin data.
- An async server component (or an awaited expression inside the layout body per this Next version's conventions — verify against the docs) so the HTML carries real data.
- Do NOT mark the page/layer with a cache that would freeze the payload across users; request-scoped per Next docs.
Out of scope: the fetch-side `loadBootstrap` (already correct), /api/bootstrap route, options endpoints, any client file.

## Actions
1. Import `getAppBootstrap` in layout.tsx.
2. Compute the payload in a try/catch (`null` on error) and emit the escaped inline script before `<SiteChrome>` per the contract.
3. Verify typing + serialization compiles (LayoutProps pattern already in file — keep it).

## Done when
- Served HTML contains `window.__CC_BOOT__=` with the real payload for a signed-in user, `null` when signed out.
- `/api/bootstrap` still returns identical JSON (fallback path untouched).
- `npx tsc --noEmit` clean; `next build` compiles (PM runs full build).

## Verify
- Run: `npx tsc --noEmit` -> no errors.

## Handoff
None. Write results/S06-02.md (<=10 lines) incl. the Next docs path cited;
TL alone updates TRACKER.md.
