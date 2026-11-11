# UX3 audit — operations shard 1 — 2026-03-28 — ux-ui-expert

Env: `npm run dev` @ :3000 (Next 16.4.3 dev), `npm run test:e2e:seed` OK, signed in as `e2e.admin@dabdoob.com`, headless chromium, viewport height 900.

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|-----------|---------|
| `/trackers` | FAIL | FAIL | FAIL | FAIL | Q5, Q7, Q8 | **FAIL** |
| `/escalation-matrix` | FAIL | n/a | n/a | FAIL | placeholder check | **FAIL** |

Screens: `results/ux3-screens/operations/` — trackers-{375,768,1024,1440}.png, trackers-loading-1024.png, escalation-matrix-{375,1440}.png.

---

## /trackers — FAIL

- Q1 PASS — `.page-head` identical across skeleton → loaded (`trackers-loading-1024.png` vs `trackers-1024.png`); header never jumped. Tracker-switcher exercise **skipped**: API returned `trackers: []` (0 real options; only `__new__`), so no switch was possible.
- Q2 PASS — 8 controls @375 / 24 @1024-1440, all shared `cx-*` classes (`cx-select`, `icon-btn`, `nav-toggle`…), all labeled; Tab trail → every stop shows `outline: solid 2px rgb(47,111,237)` + 2px/4px double ring.
- Q3 PASS — no raw/unstyled controls on the page. (Broken brand logo in chrome → F2 below.)
- Q4 PASS — `scrollWidth == innerWidth` at all 4 widths; zero overflowing elements.
- Q5 **FAIL** — loading skeleton (`Kn`) is designed, but the loaded **zero-tracker state renders nothing**: `.trk-page` children = `.page-head` only — no `Empty`, no hint, no form. `hasBody/hasCreate/hasEmpty = false`; API `{trackers:0, current:null, canCreate:true}`. Evidence: `trackers-375/768/1440.png` (blank region under switcher). Severity **blocker** (conditional on empty tracker list). Suspected class **B3**.
- Q6 PASS — no inline literal styles on page (0 @375/768); sole inline style @1024/1440 is `span.nav-ind` `transform: translate(...)` — dynamic nav indicator, not a token literal.
- Q7 **FAIL** (minor) — first heading in DOM is `h2` "View as" (shell ViewAs panel) *before* `h1` "Trackers". Landmarks OK: `aside.rail`, `nav[aria-label=Main]`, `main.main`, `section[aria-labelledby=page-title]`, `header.page-head`. Suspected class **B8**.
- Q8 **FAIL** — `#trk-switch` renders `value="__new__"` (`selectedIndex=0`, its only option) while the create form is **not** mounted; re-picking the same option cannot fire `change`, and keyboard commit confirmed `.trk-create` never appears → the create-tracker flow is a **dead end** and the displayed selection misrepresents page state. Severity **blocker** (same zero-tracker condition). Suspected class **B3/B15**.

### FAIL lines
1. `/trackers` — Q5/Q8 — zero-tracker state: blank body + unreachable "create a new tracker" — region `.trk-page` / `#trk-switch` — all widths — shots `trackers-375.png`, `trackers-768.png`, `trackers-1440.png` — **blocker** — class B3. Fix direction: render a designed empty/create affordance for `t.trackers.length===0` (e.g. mount `Er` or an `Empty` with a real create `Button` instead of a select-only path).
2. `/trackers` — chrome — brand `<Image class=brand-logo src=/assets/dabdoob-logo.png>` broken at every width/route: dev server logs `internal image response failed ... 307` — the image optimizer's internal fetch hits `proxy.ts` auth gate → `/_next/image` 500 → broken-image glyph top-left. Shots `trackers-375.png`, `trackers-1440.png` — **major** — class — (shell/proxy, recurs on all routes).
3. `/trackers` — Q7 — `h2 "View as"` precedes `h1` in DOM order — all widths — **minor** — class B8.

Not verified: per-tracker records grid/search/table, `Er`/`Jn` dialogs, `is-busy`/`trk-banner-error`, hover/disabled styling — environment returned zero trackers, so those regions never mounted. Dev-mode noise (not scored): `Date.now()` prerender errors + dev "N Issues" pill on every route.

## /escalation-matrix — FAIL (placeholder quick-check)

HTTP 200, but renders the **error screen** — "This page hit an error and could not be shown: Attempted to call D() from the server but D is on the client…" — instead of the designed `UnbuiltPage` ("Not built yet" + icon). `h1 "Escalation matrix"` + "Try again" button present; `hasPageHead=0`. Root cause: `[...slug]/page.tsx` (server component) renders `UnbuiltPage`/`StateScreen.tsx`, which calls client-only `D()` → server render throws → `ErrorBoundary`. Affects every unbuilt registry route (same class as `/fcr`, `/hard-cases`, `/kpi-close`).

- FAIL: error screen instead of designed placeholder — whole main region — 375 + 1440 — shots `escalation-matrix-375.png`, `escalation-matrix-1440.png` — **blocker** — class — (client-component-from-server bug, not a pattern class).

Env note: `Date.now()` prerender console errors fire on `/`, `/trackers`, `/[...slug]` (dev-only; also in devserver.log).
