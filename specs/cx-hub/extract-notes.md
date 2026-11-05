# Extraction notes — per-app bundle decompile (shard 02)

Command: `node scripts/legacy-extract.mjs` (repeatable; output → `.devin/work/extract/<app>/`).

## Coverage

| App | Dispatch | Pages built | Registry pages | Unbuilt (placeholder parity) |
|---|---|---|---|---|
| hub | `Qd` | 5 (incl. hidden `ecosystem`) | 4 | — |
| quality | `wn` | 10 | 10 | — |
| productivity | `Xt` | 4 | 4 | — |
| queue | `Dn` | 6 | 6 | — |
| people | `Sn` | 7 | 9 | `hard-cases`, `kpi-close` |
| operations | `pt` | 1 | 2 | `escalation-matrix` |
| desk | `Rt` | 4 | 4 | — |
| fcr | none | 0 | 1 | `fcr` (deferred, D-FCR) |

37 built pages + `ecosystem` out of 41 total routes. Unbuilt routes have metadata + icon + i18n entries only — confirmed no component source → `hs()` "Not built yet." placeholder is the parity-correct output (do not invent).

## Bundle anatomy (all apps)

- `index.html` = Vite single-file build: boot-splash `<style>` + inline boot `<script>` (appearance/lang pre-load), main `<style rel="stylesheet" crossorigin>`, `<script type="module">` app payload.
- Route dispatch: `const XX = { "path": Fn, ... }` object table → page components are top-level `function Fn({route})`.
- Placeholder component `hs` renders "Not built yet." pages.
- Sibling tables per bundle: icon map (route→svg), group→default map (`Zt`-like), role-label map (`admin/tl/agent/unknown`), Arabic i18n map, route-metadata array (`path/title/group/purpose/roles/reqs`).
- Hub `ecosystem` pulls Three.js (~600 KB of the 803 KB bundle) — library code isolated from app code by the top-level symbol table in `pages.json` (`deps` lists only app symbols the component actually touches).

## CSS deltas vs productivity (`css-diff.json`)

- quality −3.9 KB, queue −4.0 KB, people −6.0 KB, hub −7.4 KB — same shared stylesheet with per-app trims; no merge needed (each page keeps its own bundle's CSS; new app already carries the superset `globals.css`).
- operations/desk −45 KB, fcr −53 KB — substantially smaller sheets; desk/operations pages may reference classes absent from their own bundle's CSS. **Port note:** when a desk/operations component references a class not in its `app.css`, take the rule from `productivity/app.css` (the superset) rather than restyling.

## Widget/API conventions observed

- Pages call a server facade (`google.script.run`-style async API object) — in the new app each page gets a `ce`-style API surface mapping to `/api/<module>/...` routes (pattern established in `status-validation/page.tsx`).
- Shared shell widgets (page head `Pa`, chip `Y`, section `j`, skeleton `Wt`, lane strip) already exist ported in `src/features/shared/components/shell/ui.tsx`.

## Not-in-registry findings

- `ecosystem` is referenced by hub's own metadata injection (`C = E === "ecosystem" ? Qd.ecosystem : void 0` near line 26683) — hidden route confirmed; admin-only.
- No hidden modals/sub-routes surfaced yet; per-module shards must still diff each page's string inventory during port.
