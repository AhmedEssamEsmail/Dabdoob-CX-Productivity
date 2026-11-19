# ux report - unified-page-format - round 1 (FULL)

Verdict: FAIL
Open: 0B / 0H / 1M / 3L

States checked: loading, empty, error, success, disabled, long text, mobile, dark, RTL, keyboard, focus — all covered by code inspection + live probe (see Evidence). Reduced-motion and 375px h-scroll verified live.

## What was verified

**Unified frame geometry (PLAN #3).** `e2e/page-frame.spec.ts` is real coverage: it walks `ROUTES` (every `src/app/**/page.tsx` minus `/ecosystem` — auto-discovered, can't silently exempt new pages) and asserts per route at 1024 & 1440: h1 `font-size/weight/line-height` equal, h1 `top`/`left` equal ±2px, `.page-actions` right edge == `.page-head` right edge ±2px, `.page-purpose` font-size single value, `.page-bar`/`.page-stats` inter-slot gaps equal ±2px across routes sharing the slot; at 375px strict head→bar→stats→body stacking and `hScroll === 0`. Violations collected across all routes before asserting; role-gated/error routes recorded as annotated skips. qa-2: 3/3 chromium PASS, effective 87/87. tl-4: warm rerun 6/6 → green. Coverage gaps (notes, not defects): no dark/RTL axis; measures slot *tops*, not stats-bottom→body gap — that's why ux-1 slipped through.

**My live probe** (`specs/unified-page-format/logs/ux-probe/`, Playwright self-managed the dev server): measured `/queue` (toolbar+stats) and `/aging` (toolbar+status) at 1024/375.
- **Dark** (`colorScheme: dark`, bg `rgb(19,26,32)`): h1 top `105.59px`, font `29.216px`, actions right edge == head right (`990.4px`), barTop `228.3`/`195.2`, statsTop `288.3`, hScroll 0 — pixel-identical to the light baseline.
- **RTL** (`cx.appearance.lang='ar'` → `dir=rtl` verified live): h1 top unchanged `105.59px`; h1 hugs inline-start (right edge == head right `774.4px`), `.page-actions` mirrored to the left (left == head left `33.59px`) via `margin-inline-start:auto`; identical barTop/statsTop; hScroll 0 @375.
- **Reduced-motion**: `.spinner` computed `animation-name: none` in a real page context (refresh.css:593-597, rescoped container-agnostic by qa1-04 ✓).

**Slot API.** `PageShell.tsx` renders fixed DOM order kicker→`h1.page-title`→`p.page-purpose` inside `.page-head` with `.page-actions` (or bare `aside`) at row end, then conditional `.page-bar`/`.page-stats`; `id` + `aria-labelledby` + `aria-busy` semantics intact; `sub` wins over `purpose`. All wrappers (`Head`, `Vf`, `QaPage`, `PwShell`, `PageHead`) forward the 6 slots to `PageShell` — one render path.

**No bespoke heads.** Zero `src/` matches for `aging-page-head`, `ag-actions-full`, `md-head-actions`, `kicker--block`, `hm-head-actions`, `sch-controls`; all in-app `h1.page-title` render through `PageShell` (remaining `<h1>` hits: exempt `/ecosystem`, login, state screens — which intentionally reuse `.page-head`/`.page-title` classes, so error states keep identical geometry).

**Buttons/filters consistent.** One `RefreshButton` owns cooldown + `role="status"` strip; `RefreshNow`/`Hf` delegate (fetch fn only). `.cx-refresh` min-inline-size `11rem` stabilizes the box; `.page-actions :is(input,select)` guard + `[role="status"]{flex-basis:100%}` added (e1-05). Filters/`Seg`/search uniformly in `toolbar`, freshness/`AsOf` in `status` (`margin-inline-start:auto` — never above title).

**Spinner.** `role="status"` + `.cx-sr` label, server-safe, used by root `loading.tsx` inside `.page-loading` (centered, 150ms delayed reveal — no sub-150ms flash). Splash latch `#app[data-booted]` verified in `SPLASH_CSS` + `SiteChromeBody` mount effect; `nav-no-splash.spec.ts` (MutationObserver, Slow-3G/4×CPU pass, rail single-mount) green per tl-3/qa-2.

## Findings

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | `src/features/cx-hub/components/overview-page.tsx:458` | `stats` slot contains a nested `<div className="grid grid-4 mb-3">` wrapping the `.stat` cards — violates the contract's own recipe ("keep the `.stat` markup verbatim, drop the manual grid wrapper", docs/PAGE-FRAME.md:61,92) and "one grid" rule (PLAN #2). Consequences: (a) `grid-4` media steps (4→2 @821–1180px→1 @≤820px) replace `.page-stats` `auto-fit minmax(11rem,1fr)`, so Home's KPI row wraps differently from every sibling page at ~821–1180px (2×2 vs one row — inside the spec's own 1024 viewport band, uncaught because only slot tops are measured); (b) inner `.mb-3` adds ~1.5rem inside the slot → stats→body gap on Home is ~3rem vs 1.5rem elsewhere. | Remove the `<div className="grid grid-4 mb-3">` wrapper; pass the four `.stat` divs directly as `stats` children (they already carry `.stat` markup verbatim). | dev |
| ux-2 | LOW | `src/features/cx-people/components/meetings-page.tsx:819`, `tl-tasks-page.tsx:924` | Inline `style={{minInlineSize:'14rem'/'10rem'}}` hardcodes lengths outside `--cx-*`/`--space-*` tokens (carries qa-6; WIG: no magic values). Lint passes (rule only matches px/hex) but breaks the convention used for `.roster-add-btn` (refresh.css:31). | Move both to a CSS rule (e.g. `.page-actions .min-w-btn` or a shared class in refresh.css) or add a `/* rem-exact: pins actions box across label swap */` justification. | dev |
| ux-3 | LOW | `src/app/refresh.css:586` | `.page-loading { animation: page-loading-in .15s ease .15s backwards }` uses literal durations and is not inside the reduced-motion block — only `.spinner` spin is stopped (593-597). Under `prefers-reduced-motion`/`data-reduce-motion` users still get a 150ms-delayed opacity fade of the container. Low-harm (opacity only) but the contract says the loading cue respects reduced-motion. | Gate it: `@media (prefers-reduced-motion:reduce){ :root .page-loading { animation:none } }` + `:root[data-reduce-motion] .page-loading { animation:none }`. | dev |
| ux-4 | LOW | `src/features/shared/components/shell/BootSplash.tsx:46` | `<img className="bl-sway" src="/assets/boot/splash-2.png" width="110" height="126">` is the only splash img missing `alt=""` (siblings at :40 and :56 have it). Harmless — the `.bl-mix` wrapper is `aria-hidden` — but inconsistent; file was touched this round. | Add `alt=""`. | dev |

## Not verified / assumptions

- Firefox/webkit/mobile/tablet e2e projects not run (gate wording is "UI subset"; chromium covers all three specs + my probe).
- page-frame.spec.ts has no dark/RTL axis — I closed that gap with the live probe above (one-time evidence; consider adding a cheap 2-route dark/RTL check to the spec if regression risk matters).
- stats-bottom→body gap is unmeasured by the spec (ux-1's margin leak hides there); if criterion-3 strictness is wanted, assert `body.top - stats.bottom` equality too.
- `/` date eyebrow removal (qa-5) — PM-accepted trade-off, not re-reported.
- Full `npm run test:e2e` not re-run by me; geometry/no-splash evidence taken from tl-3/tl-4/qa-2 green runs + my independent probe.
- Next.js 16.4.3 security nudge surfaced during probe dev-server spawn (already relayed by tl-4/qa-2); no action taken.
