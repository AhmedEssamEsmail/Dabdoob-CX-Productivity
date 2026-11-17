# Fix leaves: e2e-contract-green (UX round 1)
Source report: `../reports/ux-1.md` — ux-1 (MED) routed here; ux-2 + ux-3 (LOW) deferred.
Project root: `C:\Users\AHMED\KPIs\CX-Hub`. Results dir: `../results/`.

**Environment rules (all leaves):**
- A dev server is ALREADY running on http://localhost:3000. NEVER run
  `next dev` or `next build` (dies under Windows Job-Object). Live output goes
  to the server's own terminal (`logs/dev-server.log` is stale since Nov 12).
- No new deps. No package.json/lockfile/.env*/cx-kpis-*.json edits. No commits.
- Heavy command output (tsc/eslint/playwright) -> redirect to `logs/<name>.log`,
  report exit code + bounded tail only.
- Playwright reuses the existing server (`reuseExistingServer`) — just run
  `npx playwright test ...` directly.

## ux1-01: agents scroll-pin yields to user scroll intent
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: ux-1 (MED) — 800ms scrollTo pin must abort on user scroll intent
Skills: none
Budget: files=1; actions=2; changed_lines=30; minutes=10

### Goal
The rAF pin in `agents-page.tsx` calls `window.scrollTo(0,0)` every frame for
800ms after first `data` load, overriding all user scroll input (wheel,
touch, PgDn/Space, scrollbar drag) during that window. Abort the pin the
moment the user shows scroll intent; keep everything else unchanged.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | the pin `useEffect` only (:506-521)

### Context
- `src/features/cx-people/components/agents-page.tsx:506-521` | the pin effect + its comment (rAF loop bounded by `until`)
- `src/features/cx-people/components/agents-page.tsx:509` | `didPinTop` ref — once-per-mount arming stays
- `reports/ux-1.md` ux-1 | reviewer's exact fix: one-time `wheel`/`touchmove`/`keydown`/`pointerdown` listeners that cancel the rAF loop

### Contract
- Inside the SAME effect (`useEffect` on `[data]`, :510): after starting the
  rAF loop, register one-time listeners on `window` for `wheel`, `touchmove`,
  `keydown`, `pointerdown` (options `{ once: true }`; add `passive: true` on
  wheel/touchmove/pointerdown — never block input). Any one firing cancels
  the rAF loop so no further `scrollTo` runs.
- Cleanup (existing return) must `cancelAnimationFrame` AND remove all four
  listeners so a mid-window unmount leaves nothing armed.
- Keep `didPinTop` once-per-mount arming, the 800ms cap, and the
  `window.scrollTo(0,0)` pin itself unchanged.
- Out of scope: `Tabs.tsx:58` scrollIntoView root fix (reviewer flagged it
  shared/out-of-shard — note only); any other file or behaviour.

### Actions
1. Implement the listener-cancel inside the pin effect per Contract.
2. `npx tsc --noEmit` -> `logs/ux1-tsc.log` (clean), then
   `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "agents contract"`
   -> `logs/ux1-pw.log`: 2 passed (/agents green @375+@1024 — pin still fixes toolbar).

### Done when
- First `wheel`/`touchmove`/`keydown`/`pointerdown` during the pin window stops the loop (no more scrollTo).
- Cleanup removes listeners + cancels rAF; `didPinTop`/800ms semantics unchanged.
- `npx tsc --noEmit` clean; /agents contract passes at both widths.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "agents contract"` -> 2 passed.

### Handoff
Closes ux-1 (MED). Possible follow-up for PM: the cleaner shared root fix
(`Tabs.tsx:58` scrollIntoView skipping window scroll on mount) is out of this
leaf's scope — could become its own shard if desired.
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.
