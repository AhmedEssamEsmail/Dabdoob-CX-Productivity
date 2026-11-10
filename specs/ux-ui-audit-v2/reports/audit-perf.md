# perf report — ux-ui-audit-v2 — area `perf` (STATIC, FULL)

Scope: `src/` static performance audit per `docs/UX-UI Improvement v2` §PERFORMANCE AUDIT — re-renders, component-tree weight, fetch duplication/state, redundant wrappers, bundle/dead-code, `src/app/styles/*.css` layering. No build/runtime traces executed (static audit shard); numbers below are measured from source (line counts, grep counts, file bytes, dependency size on disk).

Verdict: **FAIL** (HIGH findings open — per perf-review rubric FAIL if any BLOCKER/HIGH/MED open; here highest = HIGH)
Open: 0 BLOCKER / 6 HIGH / 6 MED / 3 LOW  (15 findings)

## Measured baseline numbers

| Metric | Measured | Source |
|---|---|---|
| Source size | 349 files, 83,617 LOC (`src/**/*.ts(x)`) | `wc -l` |
| Client-module share | 36,366 / 37,073 `.tsx` lines (98.1%) under `'use client'` | head-3 scan |
| Components >300 lines (doc threshold) | 40 `.tsx` files; 91 `.ts/.tsx` files | `wc -l` |
| Largest components | 2,771 / 2,663 / 2,244 / 2,125 / 2,014 lines | `wc -l` |
| `useState` / `useEffect` | 620 / 146 occurrences across 123 `.tsx` | grep -o |
| `useMemo`+`useCallback` / `React.memo` / `useTransition` | 73 / **0** / **0** | grep -o |
| `next/dynamic` or `React.lazy` | **0** occurrences | grep |
| `fetchJson` definitions | 4 (3 divergent signatures) | grep |
| `useSe`-style loader hooks | 4 (`cache`/`dn`/`eoCache`/pv maps) | grep |
| `/api/options/` fetch+cache impls | 5 separate inflight Maps | grep |
| `StatusChip` implementations | 3 | grep |
| CSS payload (imported) | theme 15KB + cx-kit 59KB + refresh 31KB + 7 area sheets 8–33KB | `wc -c` |
| Dead CSS (unimported) | globals.css 93KB + legacy-apps.css 189KB = **282KB** | `wc -c` + import grep |
| `@layer` rules | **0** across all 12 stylesheets | grep |
| three.js on disk | three.module 663KB + three.core 1.46MB + jsm examples | `wc -c` node_modules |
| `eslint-disable` count | 128 | grep |
| `test:performance` | `vitest run tests/performance` — 1 file, all assertions simulated constants | tests/performance/api.spec.ts |

---

## Findings (doc output format)

### perf-1
SEVERITY: High
ELEMENT: three.js scene (Scene3D + 7 jsm modules)
LOCATION: `src/features/cx-hub/components/ecosystem-page.tsx:12-20`, route `src/app/ecosystem/page.tsx`
CATEGORY: Performance / bundle
ISSUE: `import * as THREE` + Sky/Water/EffectComposer/RenderPass/UnrealBloomPass/OutputPass/OrbitControls are static top-level imports of a `'use client'` module; the route page imports the component statically. `next/dynamic`/`React.lazy` count in repo = 0, so the whole three.js tree (2.1MB source on disk; ~600KB+ min, ~160KB+ gz typical for r186 + postprocessing) ships in the `/ecosystem` first-load chunk and is parsed/evaluated before first paint — on a page that already mounts a WebGL render loop and two `setInterval` pollers (lines 2531, 2635).
ROOT CAUSE: Verbatim legacy port kept the monolith; no code-split boundary was introduced at the canvas.
IMPACT: Largest single-route JS payload in the app; parse/eval blocks INP on low-end devices for one admin-only route.
RECOMMENDED FIX: Extract the Scene3D canvas subtree into `ecosystem-scene.tsx`; load via `next/dynamic(() => import('./ecosystem-scene'), { ssr: false })` from a small client wrapper so `three` lands in an async chunk fetched only when the route opens.
CENTRALIZATION OPPORTUNITY: No

### perf-2
SEVERITY: High
ELEMENT: Entire page tree — client-only rendering + post-hydration fetching
LOCATION: all `src/features/**/components/*-page.tsx`; `src/app/layout.tsx:17`
CATEGORY: Architecture / performance
ISSUE: 98.1% of `.tsx` lines (36,366/37,073) sit under `'use client'`; route `page.tsx` files are 7-line re-exports. Every page therefore renders as: HTML shell → JS hydrate → `useEffect` → `fetchJson(cache:'no-store')` → paint data (a 3-stage waterfall by construction). `export const instant = false` (layout.tsx:17) opts every route out of static prerender; zero server components read data.
ROOT CAUSE: Legacy GAS parity port — the SPA architecture was carried over 1:1; RSC data loading was never adopted.
IMPACT: LCP gated by full JS hydration + an uncached REST round-trip on all ~40 routes; doubles time-to-data vs streaming server data; `window.__CC_BOOT__` inline bootstrap (layout.tsx:58-62) is the only payload optimization present.
RECOMMENDED FIX: For read-heavy pages (overview, quality-scores, analytics), hoist the initial `useSe` fetch into the route's server component and pass `initialData` into the client feature component (keeps verbatim components, removes one network round-trip). Long-term: adopt `cacheComponents` (already enabled in next.config.ts) for cacheable GETs.
CENTRALIZATION OPPORTUNITY: Yes — a shared `useSe`/`initialData` contract (`usePageData(key, loader, initial?)`) covering the 4 current loader variants; files: qa-shared.tsx:113, shared.tsx:97, pv-shared.tsx:59, hub-shared.tsx (`Eo`+`eoCache`:175); duplication reduction ~75% of loader code.

### perf-3
SEVERITY: High
ELEMENT: Monolithic page components
LOCATION: `one-on-ones-page.tsx` (2,771 lines, **54** `useState`), `ecosystem-page.tsx` (2,663), `tph-grid-page.tsx` (2,244), `audit-queue-page.tsx` (2,125, **45** `useState`, 0 memo calls), `quality-analytics-page.tsx` (2,014); 40 `.tsx` files total exceed the doc's 300-line limit
CATEGORY: Architecture / re-renders
ISSUE: Single components own 16–54 pieces of state; any keystroke, filter or dialog toggle re-renders the full 1–3k-line tree including every row/cell. With `React.memo` = 0 and only 73 `useMemo`/`useCallback` repo-wide vs 620 `useState`, there is no memo boundary anywhere between a state change and the deepest table row.
ROOT CAUSE: Verbatim closure ports kept each legacy page as one function; sub-components exist inside the files but share the parent's render cycle.
IMPACT: Input latency on dense pages (tph grid, audit queue) scales with tree size, not with the changed node; INP budget (200ms) at risk on the largest grids.
RECOMMENDED FIX: Split each >800-line page into (a) data/loader section and (b) pure presentational sub-trees; wrap row/cell renderers in `React.memo`; move derived collections into `useMemo`. Prioritize audit-queue + tph-grid + one-on-ones.
CENTRALIZATION OPPORTUNITY: Yes — extract a shared `DataTable`/list-region memo pattern in `shared/components/ui` (Table already exists); est. 9 files affected.

### perf-4
SEVERITY: High
ELEMENT: `/api/options/<listKey>` fetch + inflight-cache
LOCATION: `cx-people/components/pw.tsx:218-260` (`dropdownApi`+`useStore`), `cx-queue/components/shared.tsx:553-646` (`optInflight`), `cx-hub/components/hub-shared.tsx:101-103,706` (`Vo`), `cx-operations/components/trackers-page.tsx:49-51,236` (`Ce`), `cx-quality/components/qa-shared.tsx:329-360` (`it`)
CATEGORY: Architecture / duplicate fetching + duplicate state
ISSUE: The same dropdown-options endpoint is fetched and in-flight-deduped by five independent implementations, each with a private module-level `Map`. Caches don't cross feature boundaries: an option list loaded on a Hub page is refetched from scratch when the user opens a Quality/People/Queue page in the same session.
ROOT CAUSE: Each app family ported its own `Qa`/dropdown closure instead of one shared `useOptions(listKey)` hook.
IMPACT: Repeated identical GETs across navigation; five caches to invalidate on option add; ~200+ duplicated lines.
RECOMMENDED FIX: Single `useOptions(listKey)` in `shared/lib` (or `shared/components/ui`) with one inflight+cache Map; re-export through each `*-shared` barrel to keep call sites unchanged.
CENTRALIZATION OPPORTUNITY: Yes — `useOptions`; 5 files; duplication reduction ~80%; one cache = fewer requests session-wide.

### perf-5
SEVERITY: High
ELEMENT: `fetchJson` HTTP helper
LOCATION: `shared/lib/fetch-json.ts:3` (canonical) + `hub-shared.tsx:69`, `qa-shared.tsx:50`, `queue/components/shared.tsx:87`
CATEGORY: Architecture / duplicate code
ISSUE: Four `fetchJson` definitions with three divergent contracts: `(url, init?:RequestInit)` vs `(url, body?)` auto-POST vs a `FetchError`-throwing variant. `cx-people/components/shared.tsx` re-exports the queue copy, so People pages silently depend on the Queue module graph.
ROOT CAUSE: Per-app verbatim ports; the canonical `shared/lib` version was added later and never adopted.
IMPACT: Cross-feature coupling (people→queue bundle), divergent error types, no single place to add dedup/caching.
RECOMMENDED FIX: Keep `shared/lib/fetch-json.ts` + `FetchError`; add a `postJson` convenience; re-export from `*-shared` barrels for call-site parity.
CENTRALIZATION OPPORTUNITY: Yes — 4 files; duplication reduction 100% (3 copies deleted).

### perf-6
SEVERITY: High
ELEMENT: Loader hook (`useSe`/`Eo`) + skeleton/error primitives
LOCATION: `queue/shared.tsx:97` (`useSe`+`cache`), `qa-shared.tsx:113` (`useSe`+`dn`), `pv-shared.tsx:59` (`useSe`), `hub-shared.tsx` (`Eo`+`eoCache:175`); skeletons `hub-shared.tsx:178-211` (`lo`/`jl`/`sh`) vs `queue/shared.tsx:60-84` (`Xe`/`Skeleton`/`LoadError`) vs `pw.tsx:98-131` (`PwErr`/`PwSkel`/`PwLate`)
CATEGORY: Architecture / duplicate state + redundant wrappers
ISSUE: Four module-level cache+loader hook variants and three parallel skeleton/error-state component sets doing the same job with different names. `StatusChip` exists 3× (canonical `ui/StatusChip.tsx:10`, `qa-shared.tsx:233`, `queue/shared.tsx:335`); `MONTH_FULL`/`AR_DIGITS`/`localizeNum`/`useCountUp` duplicated across 6 files.
ROOT CAUSE: Per-app shared modules built independently before `shared/components/ui` existed.
IMPACT: ~1,000+ duplicated lines across `*-shared` modules (4,006 LOC total); fixes must be ported N times; stale-cache behavior differs per app (named-key vs fn-key).
RECOMMENDED FIX: One `usePageData` hook + one `Skeleton`/`LoadError`/`StatusChip` in `shared/components/ui` (Skeleton/StatusChip already exist — adopt and re-export).
CENTRALIZATION OPPORTUNITY: Yes — `usePageData`, `PageError`, `PageSkeleton`, `StatusChip`, `useCountUp`; ~9 files; duplication reduction est. 60–70% of `*-shared.tsx` shared-primitive code.

### perf-7
SEVERITY: Medium
ELEMENT: AppShell render path
LOCATION: `src/features/shared/components/shell/AppShell.tsx`
CATEGORY: Performance / re-renders
ISSUE: (a) `useLayoutEffect` with no dependency array (lines 158-178) runs after EVERY shell render and performs `querySelector` + `offsetLeft/offsetTop/offsetWidth/offsetHeight` reads — forced synchronous layout per render. (b) Two adjust-during-render `setState` blocks (lines 293-298 `prevRoutePath`, 412-419 `openGroups`) trigger an immediate second render pass on each navigation. (c) `PAGES.filter(...)` recomputed twice per render (392-406). (d) Boot payload stored 3×: `useState` (113), module singleton `setBoot` (284), `BootContext` (474).
ROOT CAUSE: Ported imperatively-positioned nav indicator + legacy group-expansion semantics; simplest React translation chosen.
IMPACT: Every shell state change (palette toggle, pending count from Popups poll, theme cycle) pays a layout-read + double-render cost across the full nav tree; on every route change it's ≥2 extra renders + forced layout.
RECOMMENDED FIX: Dep the layout effect (`[current?.path, railOff, boot]` — ResizeObserver already covers size changes); compute `navVisible`/`visible` once via `useMemo([boot, ctxApp])`; derive `openGroups` expansion inside the existing group-toggle handler or accept the double-render but drop the layout read to nav-change only.
CENTRALIZATION OPPORTUNITY: No

### perf-8
SEVERITY: Medium
ELEMENT: Dead CSS assets
LOCATION: `src/app/globals.css` (92,999 B), `src/app/legacy-apps.css` (188,690 B)
CATEGORY: Dead code / maintainability
ISSUE: 281,689 bytes of stylesheet are imported by **zero** modules (verified: only `theme/cx-kit/refresh` imported in `layout.tsx:2-4`; area sheets imported per-page). `cx-kit.css:4` still documents a load chain `globals → legacy-apps → theme → cx-kit` that no longer exists — stale source-of-truth comments in two files.
ROOT CAUSE: S12 porting retired both sheets in favor of `styles/*.css` but left the originals in `src/app`.
IMPACT: Not shipped to the browser (unimported), but 282KB of dead source misleads every future style audit and invites accidental re-import.
RECOMMENDED FIX: Move both to `.devin/work/` (with the other legacy extracts) or delete; fix the header comment in `cx-kit.css`/`refresh.css` to state the real order `theme → cx-kit → refresh → [data-app] route sheet`.
CENTRALIZATION OPPORTUNITY: No

### perf-9
SEVERITY: Medium
ELEMENT: CSS cascade layering
LOCATION: `src/app/theme.css`, `cx-kit.css`, `refresh.css`, `src/app/styles/*.css`
CATEGORY: Design system / layering
ISSUE: Zero `@layer` rules across all 12 sheets (5,454 lines / ~532KB source incl. dead files; ~250KB imported). `cx-kit` and `refresh` deliberately author `:root .cls` (0,2,0) to *tie* with generated `[data-app="x"] .cls` (0,2,0) and win only by import order — order that is an emergent property of the chunk graph (layout css vs per-page css), not an explicit contract. Area sheets are route-imported, so insertion order varies with navigation prefetch.
ROOT CAUSE: Layering solved by convention (comment headers), not cascade layers.
IMPACT: Any reorder (new route import, chunk split change) silently flips which sheet wins a tied selector; hard to debug because ties are intentional.
RECOMMENDED FIX: `@layer tokens, kit, refresh, apps;` wrappers (or Tailwind v4 `@layer` blocks) — makes the intended order explicit and survives bundler reordering.
CENTRALIZATION OPPORTUNITY: Yes — one layer manifest in `theme.css` header; 12 files.

### perf-10
SEVERITY: Medium
ELEMENT: Server bootstrap waterfall
LOCATION: `src/features/shared/platform/bootstrap.ts:14-34` via `src/app/layout.tsx:28`
CATEGORY: Performance / data fetching
ISSUE: `getAppBootstrap` awaits `currentUser()` → `viewAsState()` → `currentEmail()` serially, then `Promise.all([popups, urls, quality])`. The first three are independent reads serialized before the parallel block; result is inlined into every page's `window.__CC_BOOT__`, so its latency sits on the critical path of all ~40 routes.
ROOT CAUSE: Sequential `await` style in a port; no per-request `cache()` batching.
IMPACT: Adds (likely 1–2) extra DB/auth round-trips to every navigation's TTFB.
RECOMMENDED FIX: `Promise.all` the three identity reads too (or React `cache()`-dedup inside `currentUser/currentEmail` which presumably share the session lookup).
CENTRALIZATION OPPORTUNITY: No

### perf-11
SEVERITY: Medium
ELEMENT: Independent polling loops
LOCATION: `Popups.tsx:20,65-67` (60s + 2.5s initial), `OneOnOneAlerts.tsx:163` (1s title flash), `ecosystem-page.tsx:2531` (30s) + `:2635` (`Kb` refetch), `hub-shared.tsx:589` & `queue/shared.tsx:427` (1s countdown clocks)
CATEGORY: Performance
ISSUE: Five unrelated `setInterval`/`setTimeout` chains; shell poll (60s) plus per-page refresh timers each wake independently; two pages keep a 1-second `setNow` ticker (re-renders its component subtree every second while cooldown active — bounded, acceptable) — but no shared scheduler, and Popups' 2.5s boot poll fires on every fresh load even though `__CC_BOOT__` already delivered popups.
ROOT CAUSE: Verbatim timers per feature; no shared tick.
IMPACT: Modest: extra wake-ups + one usually-redundant `/api/popups` GET 2.5s after every load.
RECOMMENDED FIX: Skip the initial Popups poll when `initial` came from `__CC_BOOT__` (or delay to first POLL_MS boundary); consolidate page refresh timers behind one visibility-aware `usePoll(ms, fn)` hook.
CENTRALIZATION OPPORTUNITY: Yes — `usePoll` in `shared/lib`; 5 files.

### perf-12
SEVERITY: Medium
ELEMENT: Perf test baseline is a stub
LOCATION: `tests/performance/api.spec.ts` (`npm run test:performance`)
CATEGORY: Measurement
ISSUE: All 14 assertions compare hardcoded constants (`simulatedDuration = 50`, `actualLcp = 2000`) — the suite measures nothing and cannot regress. PLAN's budget "no regression vs `test:performance` baselines" currently means "no constraint".
ROOT CAUSE: Placeholder spec shipped as the perf gate.
IMPACT: Any perf regression (incl. findings above) passes the gate green.
RECOMMENDED FIX: Replace with one real check per budget class: route-chunk byte budget (parse `next build` manifest), and Playwright Web-Vitals sample on 2–3 key routes (harness already exists in `e2e/`).
CENTRALIZATION OPPORTUNITY: No

### perf-13
SEVERITY: Low
ELEMENT: Raster images via `<img>`
LOCATION: `AppShell.tsx:493-498` (`/assets/dabdoob-logo.png`, 37KB, every page), `BootSplash` (3 pngs ~21KB)
CATEGORY: Performance (minor)
ISSUE: `<img>` not `next/image`; logo is in the LCP-adjacent rail on every route. Two `eslint-disable @next/next/no-img-element` suppressions exist (BootSplash) — the suppressions are deliberate for pre-paint parity.
ROOT CAUSE: Verbatim DOM parity.
IMPACT: Minor — 37KB unoptimized but cacheable; no lazy/decode hints.
RECOMMENDED FIX: `next/image` with `priority` for the rail logo only; leave BootSplash as-is (pre-hydration).
CENTRALIZATION OPPORTUNITY: No

### perf-14
SEVERITY: Low
ELEMENT: Font loading chain
LOCATION: `src/app/layout.tsx:42-54`
CATEGORY: Performance (minor)
ISSUE: Google Fonts CSS (3 families, 9 weights) loaded via `media="print"` + inline-script `onload` flip — non-blocking (correct instinct), but adds an inline script and delays font swap until after load; `next/font/google` would self-host + preload automatically.
ROOT CAUSE: Verbatim `index.html` lines 7-10 port.
IMPACT: Minor — extra request chain + late font swap (FOUT after paint rather than `font-display: swap` during).
RECOMMENDED FIX: Evaluate `next/font` for IBM Plex Sans/Arabic/Mono (keeps weights, removes the script hack). Low priority — parity risk is low but non-zero.
CENTRALIZATION OPPORTUNITY: No

### perf-15
SEVERITY: Low
ELEMENT: Redirect placeholder + `Frag` wrapper
LOCATION: `AppShell.tsx:468` (`<div className="page" />` during in-flight redirect), `pw.tsx:158` (`Frag` = `<>{children}</>` re-export)
CATEGORY: Redundant wrappers
ISSUE: Cosmetic wrapper noise; `Frag` re-exports a fragment under a legacy alias — harmless but adds indirection.
ROOT CAUSE: Legacy symbol parity.
IMPACT: Negligible.
RECOMMENDED FIX: Use `<>…</>` directly when touching those files; no dedicated shard.
CENTRALIZATION OPPORTUNITY: No

---

## Summary

**A. Coverage:** 349 files audited statically; 44 routes; 40 registry pages; all 7 `styles/*.css` + 4 root stylesheets reviewed. Rendered-output verification is owned by area shards/screenshots — this report is code-measured only.

**B. Measured duplication:** `fetchJson` ×4, `useSe`-loaders ×4, options fetch/cache ×5, `StatusChip` ×3, skeleton/error sets ×3, date/number utils across 6 files — `*-shared` modules total 4,006 LOC, est. 25–35% duplicated.

**C. Bundle/dead-code:** three.js eager on `/ecosystem` (~160KB+ gz est.); 282KB dead CSS unimported; `shared/migration` (176KB source) correctly server-only via `api/admin/migrate`; no client component imports supabase/googleapis/server libs (verified).

**D. Highest-risk areas:** audit-queue + tph-grid + one-on-ones re-render cost; `/ecosystem` first-load JS; bootstrap critical path on every route.

**E. Scorecard (perf areas only):** Bundle discipline 4/10 · Render efficiency 3/10 · Fetch architecture 4/10 · Dead-code hygiene 5/10 · CSS layering 5/10 · Measurement/gates 2/10.

**F. Top fixes (perf-ordered):**
1. perf-1 — dynamic-import three.js scene (biggest single win, ~160KB gz off one route).
2. perf-2 — server-side initial data for top read routes (removes hydration→fetch waterfall).
3. perf-4+5+6 — consolidate options/fetchJson/useSe into `shared` (one shard; deletes ~1k dup lines + cross-app refetches).
4. perf-3 — split + memo audit-queue/tph-grid/one-on-ones hot paths.
5. perf-7 — dep the AppShell layout effect; memoize nav filters.
6. perf-9 — explicit `@layer` manifest for the 12 stylesheets.
7. perf-12 — make `test:performance` measure real budgets before gate phase.
8. perf-8 — evict dead `globals.css`/`legacy-apps.css` + fix stale load-order comments.

## Not measured / assumptions
- No `next build` run (static audit): gz sizes for three.js are estimates from node_modules source bytes + published r186 ranges; verify with a build-manifest/bundle-analyzer pass in Phase F gates.
- No runtime render counts — re-render severity inferred from measured state density (54 `useState`, 0 `React.memo`) not Profiler traces.
- Supabase query latency not measured (app fetches via internal REST; server query audit is out of this shard's scope).
- `tests/performance` gate assumed to be the PLAN's perf baseline; it is currently non-measuring (perf-12).
