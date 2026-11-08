# S06: __CC_BOOT__ emitted server-side; options out of bootstrap
Kind: package
ID: S06
Dispatch: NEVER

## Goal and contract
PLAN criterion #6: the bootstrap payload is emitted server-side into the
root HTML as `window.__CC_BOOT__`, so the shell skips the `/api/bootstrap`
round-trip on first load; the bootstrap payload drops `options` (dropdowns
already lazy-fetch `/api/options/[listKey]` — verified: `Bootstrap` in
shell/context.ts:50-57 declares no `options` field and every picker fetches
`/api/options/<key>` on demand). The route stays as the SPA fallback.
Contract: a platform-level `getAppBootstrap()` shared by the route and the
layout script; a failure renders `window.__CC_BOOT__ = null` so the client
falls back to `/api/bootstrap` exactly like today. Non-goals: changing the
payload fields beyond dropping `options`, caching strategy work.

## Children
Index: `S06/00-index.md`
- extract getAppBootstrap + drop options: S06-01 | layout emission: S06-02

## Completion
Both done; first paint carries `__CC_BOOT__`; `/api/bootstrap` still works.
