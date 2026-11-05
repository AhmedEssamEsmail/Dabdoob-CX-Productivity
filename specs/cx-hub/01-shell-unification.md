# Shard 01 — Unified-app shell context

> Status: **done** (implemented 2026-11-05, this session).

## What changed

Legacy = 8 separate GAS web apps; each shows only its own nav group expanded and every other group as a single external entry. In the unified deployment the same DOM is preserved by deriving the app context per route:

- `src/lib/shell/gates.ts`: `inThisApp(route)` → `inApp(route, ctxApp)`; `resolveLink` routes every registered `#/path` internally to `/path` (query preserved); `external` flag now means "belongs to another app context" so callers keep the external glyph/tooltip; dropped the `appUrls`-based resolution and `getBoot` dependency.
- `src/components/shell/AppShell.tsx`: `ctxApp = appForGroup(route.group)` (unknown paths → `hub`); rail, brand (`brand-name`), state screens, error boundary, external/denied notes, fallback `visible` set all keyed to `ctxApp`; `document.title = ctxTitle` per context; other groups render `nav-group--app` entries that link internally while keeping the external glyph/`target="_top"`.
- `src/components/shell/registry.ts`: `APP_KEY` retained for reference only; `APP_TITLE` = umbrella hub title "CX Helm".
- `src/app/api/bootstrap/route.ts`: deployment identity `app: 'hub'`.
- `src/app/layout.tsx`: metadata title `CX Helm`.
- `src/lib/platform/settings.ts`: `ccApp()` → `'hub'` (self-links in notify payloads resolve against the hub URL).

## Notes for module shards

- `BUILT_ROUTES` in `registry.ts` is the marker for ported pages — add each shipped route.
- `boot.quality` (`auditor`/`kbEditor`) gates remain `undefined` until shard 20 ports `qaBootFlags_` — matching the legacy behaviour on apps that did not host Quality.
- `UnbuiltPage` (`[...slug]`) renders the legacy `hs()` "Not built yet." placeholder inside the correct app context until a real page ships.
- Cross-context rail entries intentionally still `target="_top"` (full reload) — reproduces the legacy cross-app navigation feel; revisit only if profiling shows the reload cost matters.
