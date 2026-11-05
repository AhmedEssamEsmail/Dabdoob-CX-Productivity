# Shard 02 — Per-app bundle extraction pipeline

> Status: pending. Scope M. Depends on: nothing (tooling). Blocks: every module shard.

## Goal

Turn each legacy `index.html` bundle into workable source: the same `.devin/work/extract/` treatment that produced the 4 ported Productivity pages — but per app.

## Steps

1. For each app dir (`Command_Center_V2_deprecated`, `Quality_deprecated`, `Queue_deprecated`, `People_deprecated`, `Operations_deprecated`, `Desk_deprecated`):
   - Slice the `<script type="module">` payload and the inline stylesheet out of `index.html`.
   - Pretty-print JS (the `.devin/work/extract/app.pretty.js` approach) → `.devin/work/extract/<app>/{app.js,app.pretty.js,app.css}`.
   - Emit a component map: the `Xt` route→component table, shared widget symbols (page head `Pa`, chip `Y`, section `j`, skeleton `Wt`, tooltip hook, lane strip), and per-page string inventory (labels, empty states, button copy, toasts).
2. Diff per-app CSS vs `legacy.css` — styles are shared; only merge app-unique rules (hub bundle may carry extras, e.g. 3D/ecosystem classes).
3. Registry sanity: confirm each bundle's registry matches `data/legacy-route-registry.json` (same 40 entries; `apps.<app>.server` lists must equal the `.js` files present).
4. Hub bundle special case: it embeds Three.js (~600 KB) for the `ecosystem` page — isolate app code from library code during decompile.
5. Extend `shoot-legacy.mjs` + `legacy-fixtures.mjs` so each module's bundle can be screenshotted with fixtures that satisfy its real server payloads (payload shapes now known from the ported server files).

## Deliverables

- `.devin/work/extract/<app>/*` + a `pages.json` per app listing route → component symbol → widget deps.
- `specs/cx-hub/extract-notes.md`: any page whose component is absent from its bundle (fallback = `hs()` placeholder parity) and any UI found that is not in the registry (hidden modals/sub-routes).

## Gates

- Every registry route either maps to a bundled component or is documented as unbuilt-in-legacy.
- The extraction is repeatable: one command produces all six app extracts.
