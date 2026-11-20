# debug report - nav-scroll-top - 1

Verdict: ROOT_CAUSE_FOUND

## Repro

`e2e/nav-scroll-top.spec.ts` (new regression file) → login admin → `/overview` → `scrollTo(0,600)` → click rail link:

- `→ /one-on-ones`: **window.scrollY stays 600** (expected 0) — `expect.poll` timeout 5 s, `Expected: 0, Received: 600` (`nav-scroll-desktop.log`, exit=1).
- `→ /tph`: **window.scrollY settles at 191** (expected 0) — same failure shape (`nav-scroll-tph.log`, exit=1).
- `→ /agents`, `→ /queue`: pass — `/agents` only because of a page-local pin workaround (see dbg-3).

Instrumented run (patched `Element.prototype.scrollIntoView`/`window.scrollTo`, no source edits), overview scrolled to 600 → click `/one-on-ones`:

```
t=2983  scroll event: y 600 -> 88        (Next route-commit scroll fires correctly)
t=2985  scrollIntoView BUTTON.cx-tab#…-tab-schedule {inline:'nearest',block:'nearest',behavior:'smooth'}  (x2, StrictMode)
t=3750  scroll event: y 88 -> 600        (~750 ms later, smooth animation lands back on the OLD offset)
```

Control experiments (same run, only the monkeypatch changed):

- `Element.prototype.scrollIntoView = noop` → scroll stays at top (~16, no jump back).
- Patch forces `behavior:'auto'`, still calling the real `scrollIntoView` → stays at top (~16), no jump back.
- Unpatched → returns to exactly 600.

So Next's own route-scroll fires fine; the **mount-time `scrollIntoView({behavior:'smooth'})` on the selected tab races it and re-lands the window on the pre-navigation offset**. `block:'nearest'`/`inline:'nearest'` are meant for the horizontal tablist, but the call propagates to the document scroll chain, and the smooth animation resolves ~0.7 s later to the stale pre-commit offset.

## Root cause

- `src/features/shared/components/ui/Tabs.tsx:54-59` — `useEffect([active])` fires on mount and calls `[aria-selected="true"].scrollIntoView({inline:'nearest',block:'nearest',behavior:'smooth'})`. Under React 19 StrictMode dev it runs twice. The smooth window scroll it initiates outlives Next.js's route-scroll reset (layout-router.js:160-172 sets `htmlElement.scrollTop=0` inside a layout effect) and lands ~750 ms later on the stale offset.
- Sibling: `src/features/cx-productivity/components/tph-grid-page.tsx:68-73` — identical pattern in the TPH `Ya` tablist (`/tph` reproduced: residual y=191).
- Prior knowledge of the bug exists as a local band-aid: `agents-page.tsx:597-621` pins `window.scrollTo(0,0)` in rAF for 800 ms with comment "scorecard Tabs scroll the selected tab into view on mount … drags the window down". It only masks `/agents`; every other Tabs consumer is exposed.

Not the cause (checked): `use-search-param-state` (`scroll:false`) is not hit on these routes; `AppShell` `router.push` passes no `scroll:false`; `HashShim`/hash anchors not involved (no hash in repro); Om/audit `scrollIntoView` calls are user-action handlers, not mount effects.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| dbg-1 | HIGH | `src/features/shared/components/ui/Tabs.tsx:54-59` | Mount `[active]` effect calls `scrollIntoView(behavior:'smooth')`; smooth scroll resolves ~750 ms after commit and restores the pre-navigation scrollY (proven: noop-patch holds top, unpatched returns to 600). | Replace element `scrollIntoView` with horizontal-only container scroll: compute `tab.offsetLeft/offsetWidth` vs `list.scrollLeft/clientWidth` and `list.scrollTo({left: target, behavior})` — the effect exists to reveal the active tab horizontally inside `.cx-tabs`; it must never touch the window/document scroll chain. Keep reduced-motion → `auto`. | dev |
| dbg-2 | HIGH | `src/features/cx-productivity/components/tph-grid-page.tsx:68-73` | Identical `[tab]`-effect `scrollIntoView` on `.tph-tabs [aria-selected]` — `/tph` reproduced residual scrollY=191. | Same fix as dbg-1 — extract the horizontal-only helper once (e.g. export `scrollSelectedTabIntoView` from `Tabs.tsx`, re-export via `ui/index.ts`) and call it here. | dev |
| dbg-3 | MED | `src/features/cx-people/components/agents-page.tsx:597-621` | 800 ms `requestAnimationFrame` `window.scrollTo(0,0)` pin — a workaround for this exact bug ("Tabs scroll the selected tab into view on mount … drags the window down"); blocks user scroll and would also clobber a `#hash` deep-link anchor for 800 ms. | After dbg-1 lands, delete the `didPinTop` pin block entirely — the shared fix removes what it compensates for. | dev |
| dbg-4 | LOW | `src/features/shared/components/shell/AppShell.tsx` (add near 212-217) | Residual: with scrollIntoView neutralized the route commit still settles at scrollY≈16 on `/one-on-ones` (scroll-anchoring), and PLAN demands strict `scrollY===0`; also future mount-time pullers would reintroduce the bug. | Add `useLayoutEffect` keyed on `path` (next to the existing `firstRoute` effect): skip when `firstRoute.current` (initial mount), skip when `location.hash` is set and not a legacy `#/…` route hash, else `window.scrollTo({top:0, behavior:'instant'})`. Defense-in-depth, not the primary fix. | dev |

## Regression test

`e2e/nav-scroll-top.spec.ts` — **failing now**:
`npx playwright test e2e/nav-scroll-top.spec.ts --project=chromium --workers=1 -g desktop` → exit 1, `Expected: 0, Received: 600` on `/one-on-ones` (and `Received: 191` observed for `/tph` variant). Mobile test included for post-fix verification at 375 px.

## Siblings

- `tph-grid-page.tsx:68-73` — same `[tab]`-effect `scrollIntoView` (custom tablist) — confirmed failing.
- `agents-page.tsx:800` uses shared `Tabs` — masked by the dbg-3 pin; will be covered once pin removed.
- Other `scrollIntoView`/`focus` callsites audited and cleared: `CommandPalette.tsx:135` (inside open dialog only), `hub-shared.tsx:71` (Om, user click), `overview-page.tsx:270`, `ctls-page.tsx:332`, `audit-queue-page.tsx:129/320`, `quality-*-page.tsx` — all user-action handlers, not mount effects.
- No other mount-time `[active]`/`[tab]` `scrollIntoView` patterns remain (`grep` clean).
