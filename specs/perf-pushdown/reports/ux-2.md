# ux report - perf-pushdown - round 2 (DELTA)

Verdict: PASS
Open: 0 B / 0 H / 0 M / 0 L

States checked: loading (dynamic fallback cover, announcement, heading parity), keyboard/focus (div cover, no trap, AppShell skip target `#main` present), landmark/nesting (`div` not `main` inside AppShell `main#main`), copy (`…` at all loader sites), theme consistency (identical token resolution to the page's own transient states). Mobile/dark/pixel-contrast: see Not verified.

DELTA scope (from tl-8.md changed-files list):
- `src/features/cx-hub/components/ecosystem-dynamic.tsx` (fallback rework)
- `src/features/cx-hub/components/ecosystem-page.tsx` (loader copy :31, :142)
- `tests/perf/ecosystem-dynamic.test.ts` (new fallback-shape case)

## Prior-finding verification

| ID | Sev | Status | Evidence |
|---|---|---|---|
| ux-1 | MED | FIXED | `ecosystem-dynamic.tsx:10-19` now renders `div.eco3-page` wrapping `.eco3-page-msg` + `header.eco3-head > h1`. Selector at hub.css:160 is class-only `.eco3-page` (position:fixed;inset:0;z-index:1) so the `div` gets the fixed pointer-blocking cover — no rail/nav click-through, no context pop-in beyond the identical cover the loaded page itself paints. `div` correctly avoids a second nested `<main>` inside AppShell `main#main` (SiteChrome.tsx:50 → AppShell.tsx:674), and AppShell's skip link (AppShell.tsx:515) still resolves because `main#main` is the shell's own. h1 restores the heading the SSR'd page emitted. |
| ux-2 | MED | FIXED | `role="status"` on `.eco3-page-msg` (ecosystem-dynamic.tsx:12) — implicit `aria-live="polite"`; the loader is announced during the entire chunk-fetch window. Matches sibling pattern (trackers-page `role="status"`). WCAG 4.1.3 satisfied. |
| ux-3 | LOW | FIXED | `Loading the ecosystem…` verbatim at all 3 loader sites: ecosystem-dynamic.tsx:13, ecosystem-page.tsx:31, ecosystem-page.tsx:142. Ellipsis present everywhere; sites stay identical. |

## New-file review (web-design-guidelines pass)

`ecosystem-dynamic.tsx` — pass. No interactive elements, images, forms, or animation in the fallback; semantic `header`/`h1`; loader text ends `…`; `role="status"` for async state; cover layering (z-index:1) identical to the loaded `main.eco3-page`, so focus-obscured risk is the same as the final rendered state (parity, not a new exposure).

`ecosystem-page.tsx` — pass; touched lines are copy-only. The `Admin, Settings` hunk at :137 predates this leaf per tl-8 (baseline dirty tree) — not attributed to the fix.

`tests/perf/ecosystem-dynamic.test.ts` — asserts `eco3-page` + `role="status"` + ellipsis copy (source-level shape check, reasonable for a loader contract).

## Findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| — | — | — | none | — | — |

## Not verified / assumptions
- Pixel contrast, 320px reflow, 200% text, focus-visible rendering: judged from code/CSS only (no Playwright run needed — fallback is a centered line plus a top-left h1 in the same chrome the loaded page paints). Single-line centered msg: reflow risk nil.
- Pre-existing token quirk unchanged: `--eco3-*` vars are scoped to `.eco3` (hub.css:109-127), so `var(--eco3-bg)`/``--eco3-ink-2`` on `.eco3-page`/`.eco3-page-msg`/`.eco3-head` resolve nowhere in any page state — loaded, gated, or fallback. The new fallback inherits shell colors exactly as the page's own loading/gate states do (transparent cover still blocks pointer events; header loses only its glass/border tint). Identical rendering to sibling states → not a finding; flag for a future theme pass only.
- Pre-existing duplicate `id="main"` once the page mounts (`main#main.main` shell + `main#main.eco3-page` page) is untouched legacy structure, outside PLAN scope — noted, not filed.
- Fallback header omits the `Hub home` link/credit that the loaded header shows; transient loading window, cover is pointer-blocking, and ux-1's fix spec made only the h1 required — acceptable parity, polish-only delta.
- tl-8 test run (vitest 3/3, eslint 0 errors) corroborates the shape assertions; no gate re-run needed for a copy/JSX-only fix leaf.
