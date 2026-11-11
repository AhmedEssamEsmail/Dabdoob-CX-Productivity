# fix-P2-1: Phase-2 audit FAILs — fix round 1
Kind: package
Dispatch: NEVER
Criteria: PLAN Phase 2 + spec/P2-fix-template.md — each FAIL re-verified by re-running the same question(s) at the failed width(s) on the affected route(s).

## Children
| ID | Owner | Depends | Criteria | Budget |
|---|---|---|---|---|
| P2FSH-01 | dev | none | /fcr /hard-cases /kpi-close /escalation-matrix render designed placeholder | 1 file / 4 actions / ~15 lines / 6 min |
| P2FSH-02 | dev | none | brand logo renders; /_next/image not 500 | 1 file / 4 actions / ~5 lines / 5 min |
| P2FSH-03 | dev | none | topbar crumbs render "Group / Page" on all routes | 1 file / 4 actions / ~10 lines / 5 min |
| P2FSH-04 | dev | none | no heading precedes page h1 in DOM order | 1 file / 4 actions / ~6 lines / 5 min |
| P2FSH-05 | dev | none | clipped rail search label exposes full text | 1 file / 3 actions / ~3 lines / 4 min |
| P2FSH-06 | dev | none | no blank band inside rail card on short pages ≤820 | 1 file / 4 actions / ~8 lines / 6 min |
| P2FOPS-01 | dev | none | /trackers zero-tracker state renders designed empty + create path | 1 file / 7 actions / ~80 lines / 9 min |
| P2FQUEUE-01 | dev | none | refresh status occupies dedicated row on /queue + /overview + / | 4 files / 8 actions / ~60 lines / 9 min |
| P2FQUEUE-02 | dev | none | /checkins doc scrollWidth == 375 (bisect; EXTERNAL if not reproducible) | 3 files / 6 actions / ~15 lines / 9 min |
| P2FHUB-01 | dev | none | /admin fits 375px; setting values clamp, no 89k-px rows | 2 files / 7 actions / ~60 lines / 9 min |
| P2FHUB-02 | dev | P2FHUB-01 | app_url_* values render as designed link; setting-key has title | 1 file / 6 actions / ~40 lines / 7 min |
| P2FHUB-03 | dev | P2FHUB-02 | /admin section errors offer retry; reminders not stuck on "loading" | 1 file / 6 actions / ~60 lines / 8 min |
| P2FHUB-04 | dev | P2FHUB-01 | floating eco tags do not cover header/attribution @375 | 1 file / 5 actions / ~15 lines / 6 min |
| P2FQA-01 | dev | none | /quality-analytics doc scrollWidth == 375 | 1 file / 5 actions / ~10 lines / 6 min |
| P2FQA-02 | dev | P2FQA-01 | kb-gaps Type chips do not wrap mid-word | 2 files / 4 actions / ~10 lines / 5 min |
| P2FAPP-01 | dev | none | /auth/login has exactly one <main> landmark | 1 file / 3 actions / ~4 lines / 4 min |
| P2FAPP-02 | dev | none | /auth/logout shows designed splash during redirect | 1 file / 5 actions / ~30 lines / 7 min |
| P2FPROD-01 | dev | P2FSH-05 | document.title set on /tph like other routes | 1 file / 5 actions / ~15 lines / 8 min |

## P2FSH-01: UnbuiltPage crashes the placeholder routes (server render calls client-only D())
Kind: mini
ID: P2FSH-01
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL /fcr Q5 (results/ux3-shell-1.md), FAIL /hard-cases + /kpi-close (ux3-people-1.md), FAIL /escalation-matrix (ux3-operations-1.md). BLOCKER.
Skills: none
Budget: files=1; actions=4; changed_lines=15; minutes=6

### Goal
The designed `UnbuiltPage` placeholder ("Not built yet" Empty + h1 + purpose) renders on unbuilt registry routes instead of the ErrorBoundary fallback.

### Files
- Edit: `src/features/shared/components/shell/StateScreen.tsx` | module header / `UnbuiltPage`

### Context
- `src/app/[...slug]/page.tsx` | server component rendering `<UnbuiltPage route={route}/>` — only importer of StateScreen
- `src/features/shared/shell/i18n.ts:76` | `D()` reads `document.documentElement.lang` — file is `'use client'`
- `specs/ux-ui-audit-v3/results/ux3-shell-1.md` | /fcr FAIL line + screenshots
- `src/features/shared/components/ui/index.ts` | `Empty` export (UnbuiltPage already uses it)

### Contract
`UnbuiltPage` (and `StateScreen`) must be importable from the server `[...slug]/page.tsx` without throwing "Attempted to call D() from the server". Route h1 (`route.title`) and purpose must still render server-side or via client boundary — visual parity with the designed `.state-screen`/`.page` placeholder per mockups. Acceptable fix: `'use client'` directive on StateScreen.tsx (D() is client-only and the placeholder has no server-data needs); alternative server-safe D() usage is allowed if simpler.
Out of scope: ErrorBoundary copy, the leaked raw error message, other routes, Date.now() prerender warnings.

### Actions
1. Add `'use client'` to `StateScreen.tsx` (or wrap UnbuiltPage in a client boundary) so `D()` runs on the client.
2. `npx tsc --noEmit` clean; `npx eslint src/features/shared/components/shell/StateScreen.tsx` → 0 problems.
3. Dev server + browser: open `/fcr` at 375 and 1440 → designed "Not built yet" placeholder (h1 "FCR", Empty icon + title), no error screen, no "Try again" loop.
4. Repeat on `/hard-cases` at 375 → same designed placeholder.

### Done when
- /fcr Q5 re-audit PASS at 375/1440: UnbuiltPage renders, no ErrorBoundary
- /hard-cases, /kpi-close, /escalation-matrix render the placeholder (same code path — spot-check one)
- tsc + eslint clean

### Verify
- Run: `npm run dev` + browser on `/fcr` and `/escalation-matrix` @375 -> "Not built yet" placeholder
- Run: `npx eslint src/features/shared/components/shell/StateScreen.tsx && npx tsc --noEmit` -> clean

### Handoff
4 placeholder routes unblocked; auditor re-runs Q5 on /fcr + quick-checks on the 3 others. Write results/P2FSH-01.md (<=10 lines).

## P2FSH-02: brand logo 500 — image optimizer's fetch hits proxy auth gate
Kind: mini
ID: P2FSH-02
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL Q3 broken `.brand`/`.brand-logo` at all widths on all routes (ux3-app-1.md F1, ux3-queue-1.md F-logo, ux3-operations-1.md FAIL line 2, ux3-people-1.md global). MAJOR GLOBAL.
Skills: none
Budget: files=1; actions=4; changed_lines=5; minutes=5

### Goal
`GET /_next/image?url=%2Fassets%2Fdabdoob-logo.png` returns 200 (real image) instead of 500, so the brand logo renders in the rail and on /auth/login at every width.

### Files
- Edit: `src/proxy.ts` | `config.matcher`

### Context
- `src/proxy.ts:46-48` | matcher excludes `api|_next/static|_next/image|favicon.ico` but NOT `/assets/*` — the optimizer's server-side fetch of `/assets/dabdoob-logo.png` carries no session → 307 to /auth/login → optimizer 500 (per ux3-operations-1.md dev-log evidence "internal image response failed ... 307")
- `public/assets/dabdoob-logo.png` | asset exists
- `src/app/auth/login/page.tsx` + AppShell brand row | `next/image` consumers

### Contract
Auth redirect behaviour unchanged for app routes. Public static assets under `/assets/` (and other non-`/_next` public files the optimizer may fetch) must bypass the auth gate — extend the matcher exclusion, e.g. `'/((?!api|_next/static|_next/image|assets|favicon.ico).*)'`. Do not open `/api` or page routes.
Out of scope: any other proxy logic, cookie handling, /api routes.

### Actions
1. Extend `config.matcher` to exclude `assets` (keep `api`, `_next/static`, `_next/image`, `favicon.ico`).
2. Restart dev if needed; `curl -I "http://localhost:3000/_next/image?url=%2Fassets%2Fdabdoob-logo.png&w=640&q=75"` → 200 image content-type (not 500/307).
3. Browser /auth/login @375 → `.brand-logo` renders (no broken-image glyph); /trackers @1440 → rail logo renders.
4. `npx tsc --noEmit` clean; `npx eslint src/proxy.ts` → 0 problems.

### Done when
- /_next/image logo URL returns 200 in dev
- Q3 re-audit PASS for the logo on /auth/login + one shell route at 375 and 1024+
- eslint/tsc clean

### Verify
- Run: curl/browser check above -> 200 + visible logo
- Run: `npx eslint src/proxy.ts && npx tsc --noEmit` -> clean

### Handoff
Clears the global Q3 logo FAIL on every route report. Write results/P2FSH-02.md (<=10 lines).

## P2FSH-03: Topbar drops crumbTitle — crumbs never render the page name
Kind: mini
ID: P2FSH-03
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL Topbar Q1 (results/ux3-shell-1.md, GLOBAL all 47 routes). MAJOR.
Skills: none
Budget: files=1; actions=4; changed_lines=10; minutes=5

### Goal
`.topbar .crumbs` renders `Group / <b>Page</b>` per the mock contract — the page title is reachable in chrome on every route.

### Files
- Edit: `src/features/shared/components/shell/Topbar.tsx` | `Topbar()` destructure + `.crumbs` JSX

### Context
- `src/features/shared/components/shell/Topbar.tsx:14,22-29,42-44` | `crumbTitle` declared in Props but dropped from destructure; only `{crumbGroup ? <b>{crumbGroup}</b> : null}` renders
- `src/features/shared/components/shell/AppShell.tsx:680-685` | caller already passes `crumbTitle={current ? D(current.title) : ''}` and `crumbGroup={null on overview}`
- `mockups/pages/03-my-day.html:46` | contract: `<div class="crumbs">Hub / <b>My day</b></div>` — group as plain text + " / " + title in `<b>`; overview mock `02-home.html:71`: `<b>` only

### Contract
Render `{crumbGroup ? <>{crumbGroup} / </> : null}<b>{crumbTitle}</b>` — group plain text, literal " / " separator, page title bold. When `crumbGroup` is null (overview) render just `<b>{crumbTitle}</b>`. No new props; callers unchanged.
Out of scope: restyling crumbs, bell/appearance/avatar, other AppShell code.

### Actions
1. Destructure `crumbTitle` in `Topbar()` and render it per contract above.
2. `npx eslint src/features/shared/components/shell/Topbar.tsx` → 0 problems; `npx tsc --noEmit` clean.
3. Browser /overview @1024 → crumbs show the page name; /fcr @1024 → "FCR / FCR" or group+title per registry (verify text is non-empty and bolded title present).
4. /trackers @375 → crumbs show "Operations & Trackers / Trackers".

### Done when
- Q1 re-audit PASS: `.crumbs` innerText contains the page title on /overview and a grouped route at all 4 widths
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /trackers @1024 -> crumb text "Operations & Trackers / Trackers"
- Run: `npx eslint src/features/shared/components/shell/Topbar.tsx && npx tsc --noEmit` -> clean

### Handoff
Global wayfinding chrome fixed on all routes. Write results/P2FSH-03.md (<=10 lines).

## P2FSH-04: va-title h2 precedes the page h1 in DOM order
Kind: mini
ID: P2FSH-04
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — minor Q7 FAIL h2 "View as" before h1 (ux3-app-1.md F5, ux3-operations-1.md FAIL 3, ux3-quality-1.md /audit-queue note, ux3-productivity-1.md note). MINOR, all admin routes.
Skills: none
Budget: files=1; actions=4; changed_lines=6; minutes=5

### Goal
The "View as" picker title no longer emits a heading element in the rail's DOM position before the page h1, while the dialog stays labelled and styled identically.

### Files
- Edit: `src/features/shared/components/shell/ViewAs.tsx` | `ViewAsPicker` dialog title ~:145

### Context
- `src/features/shared/components/shell/ViewAs.tsx:145` | `<h2 id="va-title" className="popup-title">` inside `<Dialog labelledby="va-title">` — the dialog renders inline inside `.rail-va` (before `<main>`), so the h2 precedes every page h1 in DOM order
- `src/features/shared/components/ui/` Dialog | `labelledby` only needs a matching `id` on any element
- `src/app/cx-kit.css:1436` | `.popup-title` class carries the styling — tag swap keeps visuals

### Contract
Replace the `<h2 id="va-title" className="popup-title">` with a non-heading element (`<p id="va-title" className="popup-title">` or `<span>`/`<div>`), keeping `id` + `className` so `aria-labelledby` and styles still bind. Do NOT touch `h2#popup-title` in Popups.tsx or other dialogs (portaled/late-DOM — not flagged).
Out of scope: other popup-title instances, dialog internals, rail markup.

### Actions
1. Swap the va-title h2 for `<p id="va-title" className="popup-title">`.
2. `npx eslint src/features/shared/components/shell/ViewAs.tsx` → 0 problems; `npx tsc --noEmit` clean.
3. Browser /trackers @1024 → DOM heading order starts at page h1; open View as → dialog still labelled (`aria-labelledby="va-title"` resolves) and styled.
4. Confirm no `margin` regression on the title (`.popup-title` ruleset already applies to the tag).

### Done when
- Q7 re-audit PASS on /trackers (first heading in DOM = h1 "Trackers") at 1024
- Dialog labelledby still resolves; title visually unchanged
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /trackers @1024 DOM probe -> first `<h*>` is `h1#page-title`
- Run: `npx eslint src/features/shared/components/shell/ViewAs.tsx && npx tsc --noEmit` -> clean

### Handoff
Clears the B8-adjacent h2-before-h1 flag on all admin routes. Write results/P2FSH-04.md (<=10 lines).

## P2FSH-05: rail-search label truncates with no full-text alternative
Kind: mini
ID: P2FSH-05
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — minor Q-adjacent FAIL `.rail-search-label` ellipsis, no title (results/ux3-shell-1.md rail FAIL-minor, B16). MINOR.
Skills: none
Budget: files=1; actions=3; changed_lines=3; minutes=4

### Goal
Hovering/focusing the clipped "Search or ju…" rail button exposes the full label text.

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | `.rail-search` button ~:552-576

### Context
- `src/features/shared/components/shell/AppShell.tsx:552-576` | `.rail-search` button has `aria-label={D('Search or jump to…')}` but no `title`; `.rail-search-label` CSS truncates (refresh.css:77-80)
- `specs/ux-ui-audit-v3/results/ux3-shell-1.md` | rail-1024.png evidence

### Contract
Add `title={D('Search or jump to…')}` to the `.rail-search` button (or the label span). Button behaviour/aria unchanged.
Out of scope: palette internals, kbd hint, other rail markup.

### Actions
1. Add the `title` attribute.
2. `npx eslint src/features/shared/components/shell/AppShell.tsx` → 0 problems; `npx tsc --noEmit` clean.
3. Browser /overview @1024 → `.rail-search` exposes full text on hover (`title` present in DOM).

### Done when
- `.rail-search` (or its label) carries `title` with the full string at ≥821px
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /overview @1024 -> title attribute present
- Run: `npx eslint src/features/shared/components/shell/AppShell.tsx && npx tsc --noEmit` -> clean

### Handoff
B16 rail label fixed. Write results/P2FSH-05.md (<=10 lines).

## P2FSH-06: .shell grid stretch grows the rail row — blank band on short pages ≤820
Kind: mini
ID: P2FSH-06
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — minor FAIL ~240-300px blank band in rail card on short pages ≤820 (results/ux3-shell-1.md rail FAIL-minor; ux3-people-1.md /my-actions Q4 minor ~300px @375). MINOR.
Skills: none
Budget: files=1; actions=4; changed_lines=8; minutes=6

### Goal
On ≤820px the rail card's height hugs its content (head + toggle; expanded: nav + foot) instead of stretching to fill `100dvh`, eliminating the dead band seen on /fcr and /my-actions.

### Files
- Edit: `src/app/cx-kit.css` | `@media (max-width: 820px) :root .shell` block ~:1163-1185

### Context
- `src/app/cx-kit.css:923-930` | `.shell` = grid, `min-block-size:100dvh` — default `align-content:stretch` stretches both rows on short pages
- `src/app/cx-kit.css:1163-1185` | ≤820 single-column shell rules (`.rail` sticky `block-size:auto`)
- `specs/ux-ui-audit-v3/results/ux3-shell-1.md` | fcr-375.png evidence + measured rail h 365 vs 122

### Contract
In the ≤820 media query make the shell rows `auto` for the rail and let main take the remaining space, e.g. add `:root .shell { grid-template-rows: auto minmax(0, 1fr); }` (or `align-content: start` if the second row must keep stretching — pick whichever matches: rail row = content height, main row = fills). Desktop (>820) untouched; `nav-open` expansion must still work.
Out of scope: rail internals, main padding, other breakpoints.

### Actions
1. Add the row sizing rule to the ≤820 media query.
2. Browser /my-actions @375 and /fcr @375 → rail card ends at its content (no ~240-300px blank band); nav toggle still expands/collapses.
3. /overview @375 (long page) → rail sticky bar unchanged; @1024 → desktop rail unchanged.
4. `npx tsc --noEmit` clean (CSS-only; `npx eslint src/app/cx-kit.css` if configured — else note n/a).

### Done when
- Re-check @375 on /fcr + /my-actions: rail height ≈ content height, band gone
- No regression at ≥821 or nav-open
- tsc clean

### Verify
- Run: `npm run dev` + /fcr @375 -> no blank band under rail search
- Run: `npx tsc --noEmit` -> clean

### Handoff
Fixes both shell-band FAILs with one rule family. Write results/P2FSH-06.md (<=10 lines).

## P2FOPS-01: /trackers zero-tracker state — blank body + dead `__new__` selection
Kind: mini
ID: P2FOPS-01
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL /trackers Q5+Q8 blocker (results/ux3-operations-1.md). BLOCKER under empty tracker list.
Skills: none
Budget: files=1; actions=7; changed_lines=80; minutes=9

### Goal
When the API returns `trackers: []` (with `canCreate`), the page renders a designed empty state plus a reachable create path, and `#trk-switch` never displays a phantom `__new__` selection while `.trk-create` is unmounted.

### Files
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | `TrackersPage` render ~:798-826 (+ `v()` ~:765 if the switch must survive re-pick)

### Context
- `src/features/cx-operations/components/trackers-page.tsx:805-815` | `Select value={d ? NEW_TRACKER : y?.id ?? ''}` — with zero trackers the only option is `__new__` → displays selected while `d=false` and re-pick cannot fire `change`
- `src/features/cx-operations/components/trackers-page.tsx:826-828` | body renders only when `t && !d && s` — with `s=null` nothing renders under the head
- `src/features/cx-operations/components/trackers-page.tsx:646-673` | `Er`/`.trk-create` create form already designed — mounting it on `d=true` is the intended flow
- `src/features/shared/components/ui` | `Empty`, `Button`
- `specs/ux-ui-audit-v3/results/ux3-operations-1.md` | FAIL lines 1 + suggested direction

### Contract
Zero trackers + canCreate: render either the create form auto-mounted (`d=true` initial in that case) OR a designed `Empty` (e.g. "No trackers yet." + a real `Button` "Create the first tracker" → `m(true)`). The select must not show `__new__` as a live selection when the create form is not open — acceptable: hide the switcher when `t.trackers.length===0`, or keep it disabled with an empty value, or auto-mount create. Zero trackers + !canCreate: designed Empty with no create affordance. Non-empty path unchanged.
Out of scope: records grid, Er/Jn dialogs internals, API, other ops pages.

### Actions
1. In `TrackersPage`, derive `isEmpty = !!t && t.trackers.length === 0`.
2. When `isEmpty && !d`: render an `Empty` with a create `Button` (canCreate) — or auto-open create via `useEffect`/`m(true)`; pick ONE and keep it designed (no dead select).
3. Ensure `v(NEW_TRACKER)` still opens the form for the non-empty path; if the select can keep `__new__` displayed after Cancel, reset `d` consistently (already `m(false)` on cancel).
4. Hide or disable `#trk-switch` when there is nothing to switch (no phantom selected option) — or leave it mounted with the `__new__` option only if the form is visibly open.
5. `npx eslint src/features/cx-operations/components/trackers-page.tsx` → 0 problems; `npx tsc --noEmit` clean.
6. Browser /trackers @375 + @1440 with the fixture env (trackers:[]) → designed empty/create affordance visible; activating it mounts `.trk-create`.
7. Non-empty path: if reachable in env, switch still loads records (else verify by code inspection + note).

### Done when
- Q5 re-audit PASS: `.trk-page` renders designed empty/create UI under `.page-head` at all widths
- Q8 re-audit PASS: create flow is reachable and the select never misrepresents state
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /trackers @375 -> designed empty state or mounted create form (not blank)
- Run: `npx eslint src/features/cx-operations/components/trackers-page.tsx && npx tsc --noEmit` -> clean

### Handoff
Zero-tracker blocker cleared; auditor re-checks Q5/Q8 + exercises create. Write results/P2FOPS-01.md (<=10 lines).

## P2FQUEUE-01: refresh status text reflows the actions row (A2) on /queue, /overview and /
Kind: mini
ID: P2FQUEUE-01
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL /queue Q1 @1440 (ux3-queue-1.md), FAIL /overview Q1 @375/768/1024 (ux3-hub-1.md), minor intermittent / @1024 (ux3-app-1.md F3). Class A2.
Skills: none
Budget: files=4; actions=8; changed_lines=60; minutes=9

### Goal
Refresh/status messages land on a dedicated row (the `aging-page-head` contract) so toolbar controls never change x/y when the status appears or wraps — on /queue and /overview, plus the generic `.page-actions [role=status]` row for /my-day's `.md-fresh`.

### Files
- Edit: `src/features/cx-queue/components/queue-page.tsx` | `shell()` aside ~:153-170 — wrap aside children in `.page-actions`; apply `aging-page-head` to the page section (via `Head` className passthrough or `PageShell className`)
- Edit: `src/features/cx-queue/components/shared.tsx` | `Head` ~:45-51 — accept optional `className` forwarded to `PageShell` (only if needed for the above)
- Edit: `src/features/cx-hub/components/overview-page.tsx` | `PageShell className="cxp"` ~:456 → `cxp aging-page-head`
- Edit: `src/app/refresh.css` | `.page-actions`/`aging-page-head` family ~:25-38 + ~:466-470 — add generic rule `:root .page-actions > [role="status"] { flex-basis: 100%; min-inline-size: 0; overflow-wrap: anywhere; }` so direct-child status lines (e.g. `.md-fresh` on /) take their own row; extend/adjust the aging grid only if a page's control set needs it

### Context
- `src/app/refresh.css:28-38,466-470` | the reference: `.aging-page-head` grid + `.cx-refresh{display:contents}` + `[role=status]{grid-column:1/-1}`; `.cx-refresh>[role=status]{flex-basis:100%}` already wraps status *inside* the span (that's why the span widens and pushes siblings)
- `src/features/cx-queue/components/aging-page.tsx:109,117` | working reference: `className="cxp aging-page-head"` + `.page-actions.ag-actions-full`
- `src/features/cx-queue/components/shared.tsx:393-404` | `RefreshNow` renders `.cx-refresh`(button + `[role=status]`); queue aside currently a bare fragment (children = direct `.page-head` flex items)
- `src/features/cx-hub/components/hub-shared.tsx:582-590` | `Hf` — same `.cx-refresh` markup inside `.page-actions` on /overview
- `src/features/cx-hub/components/my-day-page.tsx:1059-1088` | `.page-actions.md-head-actions` with `.md-fresh[role=status]` sibling — covered by the generic flex rule, no markup change needed

### Contract
A2 fixed means: after Refresh, status text occupies its own row; existing controls keep their x/y (the head may grow by one row — the designed status row, as on /aging). Keep `.cx-refresh` markup unchanged. `.page-actions` must wrap the actions on both pages for the grid rules to bind. my-day needs only the new generic CSS line (no class/markup edits) — verify `.md-fresh` is a direct `.page-actions` child.
Out of scope: other pages, refresh logic/copy, visual restyling of controls.

### Actions
1. queue-page.tsx: wrap the aside fragment children in `<div className="page-actions">…</div>`; get `aging-page-head` onto the `.page` section (add optional `className` param to `Head` → `PageShell`, or render `PageShell` directly).
2. overview-page.tsx: `className="cxp"` → `"cxp aging-page-head"`.
3. refresh.css: add the generic `.page-actions > [role="status"]` full-basis rule; adjust `.aging-page-head .page-actions` columns only if the queue control set ([search, Export, refresh]) misplaces under `auto minmax(0,1fr) 12rem` — if so, add a scoped variant (e.g. `.queue-page-head`) rather than weakening the aging contract.
4. `npx eslint` on the 3 touched source files → 0 problems; `npx tsc --noEmit` clean.
5. Browser /queue @1440 → click Refresh → search input, Export, refresh button keep x/y; status lands on its own row (compare bbox before/after like the audit).
6. /overview @375 + @768 → same: controls stable; status on dedicated row; @1440 unchanged.
7. / @1024 → after Refresh the `.md-fresh` line lands below the controls row (no jump) — best effort; finding was intermittent.
8. /aging regression check @1440 → still PASS.

### Done when
- Q1 re-audit PASS /queue @1440 and /overview @375/768/1024 (control bboxes stable)
- / status line on its own row when it appears
- eslint/tsc clean

### Verify
- Run: `npx playwright test e2e/toolbar-stability.spec.ts` (if it covers these routes) or manual bbox probe as above
- Run: `npx eslint <files> && npx tsc --noEmit` -> clean

### Handoff
Clears the A2 residuals; auditor re-runs Q1 on /queue, /overview, /. Write results/P2FQUEUE-01.md (<=10 lines).

## P2FQUEUE-02: /checkins 1px document h-overflow @375 — bisect and fix
Kind: mini
ID: P2FQUEUE-02
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL /checkins Q4 @375 (results/ux3-queue-1.md): `scrollWidth=376 > 375`, no overflowing descendant found. MINOR.
Skills: none
Budget: files=3; actions=6; changed_lines=15; minutes=9

### Goal
`documentElement.scrollWidth <= innerWidth` on /checkins at 375px — find the 1px source and remove it, or classify EXTERNAL with evidence.

### Files
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | only if the bisect lands here (culprit element)
- Edit: `src/app/cx-kit.css` | only if the culprit is `.shell`/`.main`/`nav-ind` ~:923-946
- Edit: `src/app/styles/queue.css` | only if the culprit is a checkins/queue rule

### Context
- `specs/ux-ui-audit-v3/results/ux3-queue-1.md` | checkins-375.png; body.scrollWidth=368 < 376 → culprit above body level or fixed/absolute shell element
- `src/features/cx-queue/components/checkins-page.tsx` | page markup (no `100vw`/fixed found in static grep)
- Suspects to bisect: `.nav-ind` translated indicator, `a.skip`, fixed dev-overlay badge (EXTERNAL if so), `.rail`/`.shell` 1px borders + `min-width` on a grid child, `box-shadow` (doesn't count), `width:100vw` + scrollbar

### Contract
Bisect in the browser at exactly 375×900 (scrollWidth measured on `documentElement`). Fix = remove the overflow at its source (class rule or element), never `overflow-x:hidden` on html/body as a cover-up — that masks, not fixes. If the culprit is a dev-only artifact (Next overlay etc.), stop: write results with the evidence and mark `EXTERNAL`.
Out of scope: other pages' overflow, visual changes beyond the culprit.

### Actions
1. `npm run dev` + /checkins @375 → confirm `documentElement.scrollWidth === 376`.
2. Bisect: toggle candidate elements (`document.querySelector(...).style.display='none'` or outline all `*`) until scrollWidth drops to 375 — record the culprit.
3. Apply the minimal fix (CSS rule or markup) at the culprit only.
4. Re-measure 375 → `scrollWidth === 375`; spot-check 768/1024 unchanged; page visuals unchanged.
5. `npx eslint <touched files>` → 0 problems; `npx tsc --noEmit` clean.
6. If culprit is dev-overlay/env → collect proof (element id/class in devtools) and stop with EXTERNAL in results.

### Done when
- /checkins Q4 re-audit PASS @375 (scrollWidth ≤ innerWidth) — OR EXTERNAL verdict with evidence
- eslint/tsc clean on touched files

### Verify
- Run: `npm run dev` + /checkins @375 -> `document.documentElement.scrollWidth === 375`
- Run: `npx eslint <files> && npx tsc --noEmit` -> clean

### Handoff
If EXTERNAL, TL records it and the route keeps only this fail deferred to the PM gate. Write results/P2FQUEUE-02.md (<=10 lines, include culprit).

## P2FHUB-01: /admin settings — fixed kv grid crushes values + settings edit row h-scrolls @375
Kind: mini
ID: P2FHUB-01
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL /admin Q4 BLOCKER @375 (results/ux3-hub-1.md): `scrollWidth=494`, `.kv-row` `220px 41px` computed → 4KB JSON in a 41px column → 89,124px row; `.cx-input`/`.setting-actions` right=432. Classes A6 + B16.
Skills: none
Budget: files=2; actions=7; changed_lines=60; minutes=9

### Goal
/admin fits 375px (no document h-scroll) and setting values render bounded: long values wrap in a reasonable-width column or clamp with a scroll/expand affordance — no multi-thousand-px rows.

### Files
- Edit: `src/app/styles/hub.css` | `[data-app="hub"]` settings rules ~:199-206 (+ a ≤40rem media query)
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `Dm` kv-row markup ~:136-190 only if a class hook is needed (e.g. value clamp class)

### Context
- `src/app/cx-kit.css:602-610` | shared `.kv`/`.kv-row` (`minmax(8.75rem,13.75rem) minmax(0,1fr)`) — also used by tl-tasks; DO NOT regress it — scope hub overrides under `[data-app="hub"]` or a hub-only class
- `src/app/styles/hub.css:199-206` | existing `.setting-*` rules (`.setting-view` flex, `.setting-value{overflow-wrap:anywhere}`)
- `src/features/cx-hub/components/admin-page.tsx:136-190` | `dl.kv`/`kv-row`/`setting-view`/`setting-edit` markup
- `specs/ux-ui-audit-v3/results/ux3-hub-1.md` | admin-375.png + measurements

### Contract
Document `scrollWidth === 375` on /admin. Multi-KB values (qa_engine_settings etc.) get a bounded presentation (e.g. `max-block-size` + `overflow:auto`, `display:-webkit-box` clamp, or a details/expand) — not a 41px column and not an 89k-px row. `.setting-edit` form (input + Save/Cancel) fits the row at 375 (wrap or stack under ~40rem). The shared `.kv-row` contract for other apps (tl-tasks) is unchanged — hub-only overrides.
Out of scope: app_url_* display content (P2FHUB-02), section retry (P2FHUB-03), other pages, cx-kit.css edits.

### Actions
1. Add `[data-app="hub"]` scoped rules so `.kv-row` at ≤40rem stacks or re-proportions (e.g. `grid-template-columns:minmax(0,1fr)` or a `minmax(6rem,10rem) minmax(0,1fr)` two-col) — no fixed-px tracks.
2. Bound `.setting-value` for giant values (clamp + scroll/details affordance), keep `overflow-wrap:anywhere`.
3. Make `.setting-edit` + `.setting-actions` fit 375 (wrap/stack, input `min-inline-size:0`).
4. `npx eslint src/features/cx-hub/components/admin-page.tsx` → 0 problems (if touched); `npx tsc --noEmit` clean.
5. Browser /admin @375 → `documentElement.scrollWidth === 375`; longest JSON row height bounded (measure `qa_engine_settings` row < ~600px); Edit → form fits viewport.
6. @768/1024/1440 → settings list still 2-col and readable; no regression.
7. tl-tasks `.kv` usage unchanged (grep/spot-check it doesn't use `[data-app="hub"]` scope).

### Done when
- Q4 re-audit PASS /admin @375 (scrollWidth == 375, bounded rows)
- eslint/tsc clean; tl-tasks kv unaffected

### Verify
- Run: `npm run dev` + /admin @375 -> scrollWidth 375, JSON value clamped
- Run: `npx tsc --noEmit` (+ eslint on touched .tsx) -> clean

### Handoff
Admin blocker cleared; auditor re-checks Q4 @375 + eyeballs 768-1440. Write results/P2FHUB-01.md (<=10 lines).

## P2FHUB-02: app_url_* settings render raw script.google.com URLs (A5) + setting-key has no title
Kind: mini
ID: P2FHUB-02
Parent: fix-P2-1
Owner: dev
Depends: P2FHUB-01
Criteria: PLAN Phase 2 — FAIL /admin Q3 major @all widths (results/ux3-hub-1.md): legacy GAS `app_url_*` values shown as raw `https://script.google.com/a/macros/…` strings (A5); minor B16 `.setting-key` ellipsized without title @768+.
Skills: none
Budget: files=1; actions=6; changed_lines=40; minutes=7

### Goal
`app_url_*` (and any URL-valued setting) renders as a designed compact link/chip — not raw URL text — and clipped `.setting-key` exposes its full name via `title`.

### Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `Dm` row render ~:136-155 (`setting-value`/`Am` site) + `.setting-key` span

### Context
- `src/features/cx-hub/components/admin-page.tsx:21-28,136-155` | `Am()` stringifies values raw; `app_url_hub|fcr|quality|…` values are GAS web-app URLs (see `src/features/cx-hub/lib/admin.ts:58-74` — they point at sibling app deployments)
- `src/features/shared/components/ui` | `Chip`, `Button`; `.cx-link` class exists for links
- `specs/ux-ui-audit-v3/results/ux3-hub-1.md` | Q3 FAIL details
- Phase-1 precedent: S01-04 removed the "connected apps" legacy block; values remain in config — display must be designed, not raw

### Contract
For values that are http(s) URLs (or specifically `app_url_*` keys — pick the narrower honest check), `.setting-value` renders a compact designed affordance, e.g. `<a className="cx-link" href={url} target=_blank rel=noopener>` with short label text (app name or "Open the app URL") — the raw URL may remain in `title` for admins who need to copy it. `title={h.key}` on `.setting-key`. No data/API changes; other value kinds render as now.
Out of scope: hiding settings, editing them differently, other B16 clips (deferred LOW), hub.css (P2FHUB-01 owns it this round).

### Actions
1. In the `setting-view` render, detect URL values (or `h.key.startsWith('app_url_')`) and render the compact link instead of the raw string.
2. Keep `Am(h)` for the edit form (`Cm`) and non-URL values unchanged.
3. Add `title={h.key}` to `.setting-key`.
4. `npx eslint src/features/cx-hub/components/admin-page.tsx` → 0 problems; `npx tsc --noEmit` clean.
5. Browser /admin @375 + @1440 → `app_url_*` rows show designed link text (no script.google.com raw string); hover exposes URL via title; setting-key title present.
6. Verify a boolean + a json + a string row still render/edit correctly.

### Done when
- Q3 re-audit PASS /admin (no raw GAS UI) at 375 and 1440
- `.setting-key` truncated text has `title`
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /admin @1440 -> app_url_* rows are links, no raw URL text
- Run: `npx eslint src/features/cx-hub/components/admin-page.tsx && npx tsc --noEmit` -> clean

### Handoff
Clears /admin Q3 + the 768-1440 B16 remainder; auditor re-checks both. Write results/P2FHUB-02.md (<=10 lines).

## P2FHUB-03: /admin section errors have no retry; reminders toggle stuck on "loading" after load failure
Kind: mini
ID: P2FHUB-03
Parent: fix-P2-1
Owner: dev
Depends: P2FHUB-02
Criteria: PLAN Phase 2 — FAIL-minor /admin Q5 (results/ux3-hub-1.md): per-section designed errors but no retry control; `rows===null` keeps Rb on "loading" forever.
Skills: none
Budget: files=1; actions=6; changed_lines=60; minutes=8

### Goal
A failed `/admin` section load offers a designed retry, and the Reminders section shows an error/off state instead of an endless "loading" chip.

### Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `AdminPage` load effect ~:346-348 + settings section ~:383-391 + `Rb` ~:300-336

### Context
- `src/features/cx-hub/components/admin-page.tsx:346-348,383-391` | single-shot `Ln.getConfigRows()`; error → static `field-error` text only
- `src/features/cx-hub/components/admin-page.tsx:300-336` | `Rb` shows `<Chip>loading</Chip>` whenever `rows===null` — including after failure
- `src/features/shared/components/ui` | `Failed`/`Empty`/`Button` patterns; `PageShell`'s `Failed` (page-level Try again) for reference
- `specs/ux-ui-audit-v3/results/ux3-hub-1.md` | Q5 FAIL-minor details + admin-err.png

### Contract
On `getConfigRows` failure: settings section keeps the styled error text AND gains a quiet "Try again" `Button` that re-invokes the load; `Rb` (Reminders) gets an error state (error chip/note + same retry) instead of perpetual loading. Loading/loaded paths unchanged.
Out of scope: `Oo` dropdown load errors (separate data path — note if identical treatment is trivially shared), API, other pages.

### Actions
1. Extract the `getConfigRows` load into a `loadConfig()` function callable on demand.
2. Settings section: append a "Try again" quiet Button beside the error text → `loadConfig()`.
3. `Rb`: accept an `error`/`onRetry` prop (or lift rows+error) so `rows===null && error` renders an error chip + retry button, not "loading".
4. `npx eslint src/features/cx-hub/components/admin-page.tsx` → 0 problems; `npx tsc --noEmit` clean.
5. Browser /admin with `/api/*` blocked (DevTools request blocking or the audit's abort probe) → sections show errors WITH retry; click → retries load.
6. Unblocked load → all sections render as before; reminders toggle works.

### Done when
- Q5 re-audit PASS: retry control present on failed section loads
- Reminders shows error state (not perpetual "loading") when rows fail
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /admin with blocked `/api/admin*` -> error + Try again on Settings and Reminders
- Run: `npx eslint src/features/cx-hub/components/admin-page.tsx && npx tsc --noEmit` -> clean

### Handoff
/admin Q5 minor cleared; auditor re-probes with API abort. Write results/P2FHUB-03.md (<=10 lines).

## P2FHUB-04: /ecosystem floating tags overlap header + clip at viewport edges @375
Kind: mini
ID: P2FHUB-04
Parent: fix-P2-1
Owner: dev
Depends: P2FHUB-01
Criteria: PLAN Phase 2 — FAIL /ecosystem Q4 @375 (results/ux3-hub-1.md): floating `.eco3-tag`s cover the h1 + attribution and clip at edges. MINOR (clean ≥768).
Skills: none
Budget: files=1; actions=5; changed_lines=15; minutes=6

### Goal
At ≤~40rem the floating scene tags no longer cover the page header/attribution or clip at viewport edges — while staying visible/usable where the scene has room (≥768 unchanged).

### Files
- Edit: `src/app/styles/hub.css` | `.eco3-tag`/`.eco3-tags` rules ~:151-158 + existing `@media(max-width:600px)` block ~:191-193

### Context
- `src/app/styles/hub.css:151-158,173,191-193` | `.eco3-tag` absolute, JS-positioned via `translate3d` inline; existing small-size media rule; `.eco3-tag--camel` already `visibility:hidden`
- `src/features/cx-hub/components/ecosystem-ui.tsx:33-44` | tags render layer (positions come from the 3D projection — CSS can't reposition them)
- `specs/ux-ui-audit-v3/results/ux3-hub-1.md` | ecosystem-375.png

### Contract
Pick the honest minimal rule: at ≤600px (or ≤820 matching the header break — verify which reads cleanly) hide the NON-essential floating tags (group tags) or drop `.eco3-tags` below the header/pointer-safe zone, keeping the scene, chip and controls usable. Do NOT try to reproject positions in CSS. If hiding, keep the selected/`is-hot` state reachable via the existing bottom controls.
Out of scope: scene rendering, attribution text, ecosystem-ui.tsx logic (only if a class hook is strictly needed — prefer CSS-only), desktop layout.

### Actions
1. Extend the existing ≤600px (or add ≤820px) media rule: hide/declutter the floating group tags that overlap (`visibility:hidden` or `display:none` on `.eco3-tag` — keep `.eco3-tag--camel`/attribution per design; verify visually which subset reads clean).
2. Browser /ecosystem @375 → tags no longer cover "Ecosystem" title or "Camel model by eb78, CC BY 4.0"; no clipped-at-edge tags; bottom bar controls still work.
3. @768/1024/1440 → tags render as before (untouched).
4. `npx tsc --noEmit` clean.
5. Confirm selected-tag interaction still reachable (chip/bottom controls per page design).

### Done when
- Q4 re-audit PASS /ecosystem @375: no overlap, no clipped tags
- ≥768 unchanged; tsc clean

### Verify
- Run: `npm run dev` + /ecosystem @375 -> header and attribution unobstructed
- Run: `npx tsc --noEmit` -> clean

### Handoff
/ecosystem Q4 minor cleared. Write results/P2FHUB-04.md (<=10 lines).

## P2FQA-01: /quality-analytics svg min-inline-size blows out the grid @375
Kind: mini
ID: P2FQA-01
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL /quality-analytics Q4 @375 (results/ux3-quality-2.md): `scrollWidth=384 > 375`; `.qa-cols .qa-trend__scroll svg{min-inline-size:360px}` exceeds ~351px track; grid item lacks `min-inline-size:0`. MAJOR.
Skills: none
Budget: files=1; actions=5; changed_lines=10; minutes=6

### Goal
`documentElement.scrollWidth === 375` on /quality-analytics at 375px while the chart keeps its designed internal horizontal scroll.

### Files
- Edit: `src/app/styles/quality.css` | `.qa-cols__grid`/`.qa-cols` rules ~:126-133

### Context
- `src/app/styles/quality.css:126` | `.qa-cols__grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))}` — item min-content = svg's 360px
- `src/app/styles/quality.css:133` | `.qa-cols .qa-trend__scroll svg{min-inline-size:360px}`
- `src/app/styles/quality.css` `.qa-trend__scroll{overflow-x:auto}` (per quality-scores PASS — the scroll affordance exists)
- `specs/ux-ui-audit-v3/results/ux3-quality-2.md` | measured widths + quality-analytics-375.png

### Contract
Track/item can shrink below the svg's 360px so the scroll container clips instead of the document. Standard fix: `min-inline-size:0` (or `min-width:0`) on the grid item / the `.qa-cols` figure / `.qa-trend__scroll` — pick the narrowest selector that yields scrollWidth=375 while the svg still scrolls INSIDE `.qa-trend__scroll`. Do not drop the svg's min-inline-size (chart readability).
Out of scope: other quality.css rules, chart geometry, other pages.

### Actions
1. Add the min-inline-size:0 fix on the culprit chain (`.qa-cols__grid > *` or `.qa-cols`/`.qa-trend__scroll`).
2. Browser /quality-analytics @375 → `documentElement.scrollWidth === 375`; `.qa-trend__scroll` still h-scrolls internally.
3. @768/1024/1440 unchanged.
4. `npx tsc --noEmit` clean.
5. Confirm sibling `.qa-cols` figures render identical (no layout shift beyond the fix).

### Done when
- Q4 re-audit PASS /quality-analytics @375
- Internal chart scroll preserved; tsc clean

### Verify
- Run: `npm run dev` + /quality-analytics @375 -> scrollWidth 375, chart scrolls inside card
- Run: `npx tsc --noEmit` -> clean

### Handoff
Route's only FAIL cleared. Write results/P2FQA-01.md (<=10 lines).

## P2FQA-02: kb-gaps Type chips wrap mid-word @1440
Kind: mini
ID: P2FQA-02
Parent: fix-P2-1
Owner: dev
Depends: P2FQA-01
Criteria: PLAN Phase 2 — LOW /kb-gaps chips wrap "Missin g data"/"Inaccu rate" mid-word (results/ux3-quality-1.md Q4 note). MINOR.
Skills: none
Budget: files=2; actions=4; changed_lines=10; minutes=5

### Goal
The Type column value never breaks mid-word — nowrap chip or whole-word wrap, table still scrolls inside TableScroll at 375.

### Files
- Edit: `src/features/cx-quality/components/kb-gaps-page.tsx` | Type `<td>` ~:170 — add a class (e.g. `qa-kbgaps__type`)
- Edit: `src/app/styles/quality.css` | `.qa-kbgaps` rules (append)

### Context
- `src/features/cx-quality/components/kb-gaps-page.tsx:154-170` | `.qa-kbgaps` table; Type cell is plain `<td>{g.topic}</td>`
- `specs/ux-ui-audit-v3/results/ux3-quality-1.md` | kb-gaps-1440.png
- `src/app/styles/quality.css` | append near `.qa-` table helpers

### Contract
`white-space:nowrap` (or `overflow-wrap`/`word-break` fix — pick whichever keeps the cell readable and the table inside its TableScroll minWidth=44rem; nowrap is honest here since the column scrolls anyway). No other columns touched.
Out of scope: other table styles, chip components, other pages.

### Actions
1. Add the class on the Type `<td>` and the CSS rule.
2. Browser /kb-gaps @1440 → Type text unbroken ("Missing data", "Inaccurate"); @375 → table still scrolls inside TableScroll, no doc h-scroll.
3. `npx eslint src/features/cx-quality/components/kb-gaps-page.tsx` → 0 problems; `npx tsc --noEmit` clean.
4. Confirm no other cell regressed.

### Done when
- Re-check PASS: Type cells never break mid-word @1440; doc scrollWidth == 375 @375
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /kb-gaps @1440 -> Type column readable
- Run: `npx eslint src/features/cx-quality/components/kb-gaps-page.tsx && npx tsc --noEmit` -> clean

### Handoff
Last /kb-gaps note cleared. Write results/P2FQA-02.md (<=10 lines).

## P2FAPP-01: /auth/login renders a nested <main> landmark
Kind: mini
ID: P2FAPP-01
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL-minor /auth/login Q7 (results/ux3-app-1.md F6): `main.main` > `main.login-wrap`. MINOR.
Skills: none
Budget: files=1; actions=3; changed_lines=4; minutes=4

### Goal
Exactly one `<main>` landmark on /auth/login — the page's `.login-wrap` becomes a non-landmark element.

### Files
- Edit: `src/app/auth/login/page.tsx` | `.login-wrap` element ~:83

### Context
- `src/app/auth/login/page.tsx:83` | `<main className="login-wrap">`
- `src/features/shared/components/layout/SiteChrome.tsx:39-44` | auth pages already render inside `<main id="main" className="main">`
- `src/app/refresh.css:395-407` | `.login-wrap` styles apply to the class — tag swap is safe

### Contract
Swap `<main className="login-wrap">` → `<div className="login-wrap">` (and closing tag). No visual/behaviour change.
Out of scope: SiteChrome markup, login form internals.

### Actions
1. Swap the tag.
2. `npx eslint src/app/auth/login/page.tsx` → 0 problems; `npx tsc --noEmit` clean.
3. Browser /auth/login @375 + @1440 → one `<main>` in landmarks; card renders identically.

### Done when
- Q7 re-audit PASS: single main landmark
- eslint/tsc clean

### Verify
- Run: `npm run dev` + /auth/login @1024 -> landmarks probe shows 1 main
- Run: `npx eslint src/app/auth/login/page.tsx && npx tsc --noEmit` -> clean

### Handoff
Login + logout-landing landmark fixed. Write results/P2FAPP-01.md (<=10 lines).

## P2FAPP-02: /auth/logout mid-transition frame is blank
Kind: mini
ID: P2FAPP-02
Parent: fix-P2-1
Owner: dev
Depends: none
Criteria: PLAN Phase 2 — FAIL-minor /auth/logout transition (results/ux3-app-1.md F7): bare `redirect()` → blank frame vs designed "Loading Dabdoob CX…" splash. MINOR.
Skills: none
Budget: files=1; actions=5; changed_lines=30; minutes=7

### Goal
The logout route renders the designed boot splash while it forwards to `/api/auth/logout`, instead of a blank white frame.

### Files
- Edit: `src/app/auth/logout/page.tsx` | whole page component

### Context
- `src/app/auth/logout/page.tsx` | currently `redirect('/api/auth/logout')` — throws before paint
- `src/features/shared/components/shell/BootSplash.tsx` | designed splash markup (`.boot-splash`, role=status); rendered standalone its own markup is what to reuse (it is a presentational div + style tag — importing the component is fine; the auto-hide `#app:not(:empty)+.boot-splash` rule only applies inside `#app`)
- `specs/ux-ui-audit-v3/results/ux3-app-1.md` | auth-logout-*-mid.png evidence

### Contract
Client component: render the splash markup (reuse `BootSplash` or its markup/classes) and `useEffect` → `window.location.assign('/api/auth/logout')` (full navigation — the endpoint clears the session then lands on /auth/login). Keep it dependency-free and fast (no client boot fetch needed).
Out of scope: logout API, login page, other auth routes.

### Actions
1. Convert the page to a client component that renders the splash and navigates in `useEffect`.
2. `npx eslint src/app/auth/logout/page.tsx` → 0 problems; `npx tsc --noEmit` clean.
3. Browser: sign in → navigate /auth/logout → mid-frame shows the designed splash, lands on /auth/login.
4. Confirm the API still completes sign-out (lands logged-out on login form).
5. Check the splash doesn't flash double (BootSplash in root layout also exists — ensure no visual conflict; the page-level copy is what the legacy design had).

### Done when
- Re-check PASS: designed splash during the redirect at 375 and 1024
- eslint/tsc clean; sign-out still completes

### Verify
- Run: `npm run dev` + /auth/logout -> splash, then login page
- Run: `npx eslint src/app/auth/logout/page.tsx && npx tsc --noEmit` -> clean

### Handoff
Logout polish fixed. Write results/P2FAPP-02.md (<=10 lines).

## P2FPROD-01: document.title never set on /tph
Kind: mini
ID: P2FPROD-01
Parent: fix-P2-1
Owner: dev
Depends: P2FSH-05
Criteria: PLAN Phase 2 — FAIL-minor /tph(-grid) Q7 (results/ux3-app-1.md F8): title stays "Dabdoob CX". MINOR.
Skills: none
Budget: files=1; actions=5; changed_lines=15; minutes=8

### Goal
`document.title` on /tph reads "TPH and caps · <app title>" like every other routed page.

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | title effect ~:298-302 and/or `current`/`route` resolution ~:135-160 — only if the bug is confirmed there after reproduction (else the file actually holding the bug, same leaf)

### Context
- `src/features/shared/components/shell/AppShell.tsx:135-160,298-302` | `current = path && visible.includes(route) ? route : fallback`; title = `current?.title ? ${D(title)} · ${ctxTitle} : ctxTitle`
- `src/features/shared/components/shell/registry.ts:206-212` | tph entry: title "TPH and caps", group productivity, roles admin+tl
- `src/features/shared/shell/gates.ts:86-99` | appForGroup/inApp/appTitle
- `specs/ux-ui-audit-v3/results/ux3-app-1.md` | F8 line — audit landed on /tph via /tph-grid redirect

### Contract
First reproduce: open /tph @1024 and read `document.title`. If it resolves correctly now (intermittent/environment), stop — write results as NOT-REPRODUCED with evidence. If broken, find why `current`/title resolves to undefined or the effect doesn't fire for the productivity route and fix at the root cause (resolution, not a hardcoded document.title per page — keep the shared contract).
Out of scope: other routes' titles, metadata, OneOnOneAlerts/Popups title tickers.

### Actions
1. Reproduce on /tph (direct nav AND via /tph-grid redirect): record `document.title`, `location.pathname`.
2. Trace `route`/`visible`/`current` for the productivity context (admin fixture).
3. Apply the root-cause fix in AppShell's resolution/effect (e.g. ensure the title effect deps/render path fire on non-hub app routes too).
4. `npx eslint src/features/shared/components/shell/AppShell.tsx` → 0 problems; `npx tsc --noEmit` clean.
5. /tph @1024 + one hub route + one quality route → titles correct on all.

### Done when
- Q7 re-audit PASS: `document.title` = "TPH and caps · Dabdoob CX Productivity" (or contract equivalent) on /tph — or NOT-REPRODUCED with evidence
- eslint/tsc clean; other routes' titles unchanged

### Verify
- Run: `npm run dev` + /tph @1024 -> document.title includes "TPH and caps"
- Run: `npx eslint src/features/shared/components/shell/AppShell.tsx && npx tsc --noEmit` -> clean

### Handoff
If NOT-REPRODUCED, TL records a verify row instead. Write results/P2FPROD-01.md (<=10 lines).
