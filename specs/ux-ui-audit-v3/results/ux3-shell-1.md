# UX3 audit — shell shard 1 — 2026-11-11 — ux-ui-expert
Env: npm run dev @ :3000 (pre-running), e2e fixture users (login verified — seed step skipped as credentials already worked), chromium headless, viewport H=900.
Scope: P2-SH-01 — 6 shell surfaces on `/overview` + full 8-question audit of `UnbuiltPage` on `/fcr`, widths {375, 768, 1024, 1440}. Mobile breakpoint: ≤820px collapses `#nav` behind `.nav-toggle` (per `e2e/nav-collapse.spec.ts`). All DOM measurements in `logs/ux3-shell-dom.json` (script run, then deleted).

| Surface/Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|---|---|---|---|---|---|---|
| Nav rail (`AppShell`) | PASS | PASS | PASS | PASS | — (2 minors) | PASS |
| Topbar | FAIL | FAIL | FAIL | FAIL | Q1 | **FAIL — GLOBAL** |
| Command palette | PASS | PASS | PASS | PASS | — | PASS |
| ViewAs | PASS | PASS | PASS | PASS | — | PASS |
| Toast region | N/E | N/E | N/E | N/E | — | NOT-EXERCISED |
| Boot/error screens | OBS | OBS | OBS | OBS | — | PASS (splash + boundary styled; see /fcr) |
| `/fcr` (UnbuiltPage) | FAIL | FAIL | FAIL | FAIL | Q5 | **FAIL — BLOCKER** |

## Nav rail (`AppShell`/`SiteChrome`) — PASS
- Q1 PASS — rail is `position:sticky`; brand/search strip unchanged across group toggles, nav open/close and route nav.
- Q2 PASS — all controls are real `<button>`/`<a>`: `.nav-toggle` (aria-expanded/aria-controls=nav), `.rail-search` (aria-label + aria-haspopup=dialog), `.nav-group-label` ×8 (aria-expanded + aria-controls ↔ `ul[hidden]`+aria-labelledby), `.nav-link` ×38, `.rail-collapse` (aria-label + aria-expanded), `.rail-signout` (aria-label+title). Focus ring measured on every stop: `outline: 2px solid rgb(47,111,237)` + box-shadow ring. Skip link is first Tab stop and becomes on-screen at (8,8).
- Q3 PASS — no unstyled controls (`unstyledControls=[]`); legacy `.nav-*` classes intentional (1:1 port).
- Q4 PASS — `scrollWidth == innerWidth` at all widths on /overview and /fcr. ≤820: rail is full-width sticky bar; Menu expands `.shell.nav-open` accordion (nav h 0→visible, no backdrop, pushes main — matches e2e expectation). ≥821: rail-collapse 216/230px → 56px `.rail-off` and restores; aria-expanded flips correctly.
- Q5 PASS — n/a for the surface itself.
- Q6 PASS — only dynamic inline style is `.nav-ind` transform/width px (JS-computed indicator, unavoidable; acceptable dynamic exception).
- Q7 PASS — `<nav aria-label="Main">`, exactly one `aria-current="page"` per route ("Home" / "FCR"), group `data-tone` set; rail `<aside>` + `<main id="main">` landmarks present.
- Q8 PASS — `aria-current` link visibly highlighted (nav-ind slides to it), group label expanded/collapsed chevron states distinct, rail-off icon state flips.
- FAIL (minor): `span.rail-search-label` truncates ("Search or ju…" @1024/1440, measured scrollWidth > clientWidth, `text-overflow:ellipsis`) with no `title`/full-text alternative → B16. Where: `.rail-search`, widths ≥821. Shot: `ux3-screens/shell/rail-1024.png`. Severity: minor. Class: B16.
- FAIL (minor): dead ~240px blank band inside the rail card on short pages at ≤820 — `.shell` single-column grid + `min-block-size:100dvh` + grid `align-content:stretch` grows the auto rail row (rail h=365@375 / 391@768 on /fcr vs 122 on /overview). Visible as empty card space under the search field. Where: `.rail`, any short page ≤820. Shot: `ux3-screens/shell/fcr-375.png`, `fcr-768.png`. Severity: minor. Class: none (CSS stretch; nearest B13).

## Topbar — FAIL — GLOBAL (affects all routes)
- Q1 **FAIL** — `.crumbs` never renders the page title: `Topbar.tsx` declares `crumbTitle` but drops it from the destructured props, so only `crumbGroup` renders. Measured at every width: `crumbsText=""` on /overview (crumbGroup=null → zero text; `.topbar` innerText = "EA" avatar only), `crumbsText="FCR"` on /fcr (group only, no page). The component's own doc says crumbs = "Group / Page", or the page alone on overview — the page title is unreachable on every route. Where: `.topbar .crumbs`. Shots: `ux3-screens/shell/rail-1024.png` (empty crumbs on /overview), `ux3-screens/shell/fcr-1440.png`. Severity: major (orientation/wayfinding chrome defect on all 47 routes). Class: B12-adjacent (dead header contract) — file as new.
- Q1 (stability) PASS otherwise — `position:sticky` z5; identical bounding box before/after group toggles @1024/1440; moves only when the ≤820 nav accordion legitimately grows the rail above it.
- Q2 PASS — bell (`aria-label="Notifications[ — n pending]"` + `title`, live region `role=status`), appearance (`aria-label="Appearance"`), avatar `aria-hidden`; both icon buttons 2px/2-focus-ring verified.
- Q3/Q4/Q6/Q7/Q8 PASS — no raw controls, no clip/overflow, no inline styles, lives inside `<main id="main">`, hover/disabled n-a.
- FAIL: crumbTitle dead prop — as above; fix = destructure and render `crumbTitle` beside `crumbGroup`.

## Command palette (`CommandPalette`) — PASS
- Q1 PASS — fixed `.cpk-backdrop` z60 doesn't shift chrome; open/close leaves layout untouched.
- Q2 PASS — `role=dialog aria-modal=true aria-label="Search pages"`, input `role=combobox` with aria-expanded/controls/activedescendant + autoFocus confirmed (activeElement === .cpk-input on open at all widths). Esc/backdrop close; focus restores to the captured invoker (measured: →`.nav-toggle`@375/768, →`.rail-collapse`@1024/1440). Tab intentionally trapped by preventDefault — arrow-key model is consistent for a palette.
- Q3 PASS — styled `.cpk-*` classes throughout.
- Q4 PASS — rects fit viewport at every width: 345×461 @375 (x15), 546×439 @768–1440 centered; `clipped:false` everywhere; hits `elementFromPoint` = `.cpk-input` (above chrome).
- Q5 PASS — `cpk-empty` "No pages match" designed empty state exists in code path.
- Q6 PASS — no hardcoded inline styles.
- Q7 PASS — group headers `role=group` + `aria-labelledby`, listbox `role=listbox`, options `role=option` + `aria-selected` + `aria-disabled` where links missing.
- Q8 PASS — `.cpk-item.on` active option visually distinct (shot); ArrowDown moved `aria-activedescendant` → `cpk-item-1` and `.on` class.
- Evidence: `ux3-screens/shell/palette-{375,768,1024,1440}.png`. 20 items rendered + "…18 more — keep typing" overflow foot.

## ViewAs — PASS
- Q1 PASS — `.rail-va` strip sits in rail foot region (≥821) / inside open mobile nav (≤820); dialog open/close doesn't move chrome.
- Q2 PASS — `.va-open` button `aria-haspopup="dialog"` + `title`; native `<dialog class="popup va-picker" aria-labelledby="va-title">` via shared `useDialogModal` (ESC→close, focus restore → measured focus returns to `.va-open` at all widths). Search input wrapped in `<label class="field">` with `.field-label` — labelled.
- Q3 PASS — shared `Button`/`Input` components; `.popup` dialog primitive (B9-compliant).
- Q4 PASS — dialog unclipped at all widths: 341px @375 (x17), 482px @768–1440 centered.
- Q5 PASS — designed states all present: `.va-empty` "Loading the roster…" (observed live @375 while remote roster fetch was slow), `.field-error role=alert` path, "No one on the roster matches" empty. 49 roster people rendered @768/1024/1440.
- Q6 PASS — token-driven `.va-*` classes.
- Q7 PASS — `h2#va-title` labels dialog; `ul.va-list[aria-label="People"]` with button items.
- Q8 PASS — `.va-role--{role}` chips, disabled-while-busy buttons (`disabled={!!busy}`), hover states.
- Evidence: `ux3-screens/shell/viewas-{375,768,1024,1440}.png`. Note: @375 roster was still loading at capture — designed loading state shown; not a defect.
- Admin-only control — audited as `e2e.admin@` per spec.

## Toast region (`Toasts`) — NOT-EXERCISED
- Region verified mounted via `Popups`: `.toasts` `role=status` `aria-live="polite"`, `position:fixed` z40 bottom-right at all 4 widths — 0 items.
- No existing UI control on `/overview` fires `toast()` (grep: no call sites in overview/hub chrome used by this page); spec forbids triggering via code edits or non-UI paths → visuals NOT-EXERCISED. Region markup passes Q2/Q7 (live region + labelled dismiss button per source).

## Boot/error screens (`StateScreen`, `ErrorBoundary`, `BootSplash`) — PASS (observed)
- `BootSplash`: SSR sibling splash `role=status`, hides via `#app:not(:empty)+.boot-splash`, `prefers-reduced-motion` + dark variants — designed, no raw string. Verified in markup (renders pre-hydration; too fast to screenshot on warm dev server).
- `ErrorBoundary`: observed live on /fcr at all widths — designed `section.page` + `h1#page-title` + `p.field-error role=alert` + "Try again" button. Styled, not raw — but surfaced wrongly (see /fcr FAIL) and it leaks the raw React error string into the message body.
- `StateScreen` boot-failure/no-access variants: not triggerable via existing UI (would need boot failure or a no-roster account) → NOT-EXERCISED for those two variants; markup verified designed (`.state-screen` + h1 + copy).
- No raw-string state observed during the audit other than the leaked error message noted above.

## /fcr — FAIL — BLOCKER
- Q1 PASS — topbar present/stable; crumb "FCR" (group only — same topbar defect, counted once globally).
- Q2 PASS — only interactive element is "Try again" `<button class="btn btn-quiet">` — labelled, focusable (ring contract verified on shell controls).
- Q3 PASS — no unstyled elements (`.btn` classes are the intentional legacy contract per code comment).
- Q4 PASS — `docScrollWidth == innerWidth` at all 4 widths; no overflow.
- Q5 **FAIL — BLOCKER** — the intended `UnbuiltPage` "Not built yet" placeholder **never renders**. `src/app/[...slug]/page.tsx` (server component) renders `UnbuiltPage` → `StateScreen.tsx` calls the client-only `D()` i18n helper → React throws "Attempted to call D() from the server but D is on the client" → `ErrorBoundary` swaps in its error fallback. Console shows the error at every width (+2× HTTP 500s on /overview from `[...slug]` prerender of the same crash). "Try again" re-throws → futile retry loop. Same code path serves `/hard-cases`, `/kpi-close`, `/escalation-matrix` — all unbuilt registry routes expected broken. Where: `main section.page` on `/fcr` (all widths). Shots: `ux3-screens/shell/fcr-{375,768,1024,1440}.png`. Severity: **blocker**. Class: none of A1–A7/B1–B18 — new defect (server/client boundary). Bonus issue in same fallback: raw engine error text shown to end users.
- Q6 PASS — no hardcoded inline styles.
- Q7 PASS — `h1#page-title` single h1, `section[aria-labelledby]`, nav+main landmarks, skip link. (`header` count 0 because `page-head` never renders — consequence of the crash, not a separate defect.)
- Q8 PASS — error state is visually distinct (`role=alert` red text); retry is a real button.
- Evidence: shots above + `logs/ux3-shell-dom.json` (`headings:[h2 hidden, h1 FCR]`, `emptyState:false` — `.cx-empty` absent because `UnbuiltPage` crashed before `Empty` rendered).

## Observations for other leaves (not shell FAILs — do not duplicate)
- `/overview` `table.cx-table` extends to x≈1528@375 / 1754@1024 / 1779@1440 — inside a scroll container (no document h-scroll) but visually the table is wider than its card; **P2-HUB-01** should verify B7 scroll-wrapper affordance.
- Console on `/overview`: `Date.now()` prerender warnings + "D() from the server" + 500s — traced to `[...slug]` prerender crashing (same root cause as /fcr); C1 contract gate would flag these until F1 lands.
- `dom.inlineStyled` = only `.nav-ind` JS-computed transform — B4 dynamic exception.

## Assumptions / not verified
- Toasts visuals, boot-error/no-access StateScreen variants: not triggerable via existing UI (marked above).
- Dark mode not exercised (appearance toggle exists; cycling theme changes localStorage — left untouched to keep the audit deterministic).
- `web-design-guidelines` skill fetch: not applicable — no changed UI files in this read-only audit; shell files reviewed against the 8-question contract + sibling consistency instead.
