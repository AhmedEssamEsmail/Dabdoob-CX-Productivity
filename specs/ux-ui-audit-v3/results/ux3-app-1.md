# UX3 audit — app shard 1 — 2026-11-11 — ux-ui-expert

Env: `npm run dev` @ :3000 (PID 14556, already running), `npm run test:e2e:seed`
(e2e.admin@dabdoob.com), chromium headless via @playwright/test 1.64, heights 900.
Driver: Playwright metrics + fullPage screenshots; evidence in `ux3-screens/app/`.

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|------------|---------|
| `/` | FAIL | FAIL | FAIL | FAIL | Q1*(1024, intermittent), Q3, Q4, Q6, Q7 | **FAIL** |
| `/auth/login` | FAIL | FAIL | FAIL | FAIL | Q3, Q7 | **FAIL** |
| `/auth/logout` | FAIL | FAIL | FAIL | FAIL | Q3, Q7 (lands on `/auth/login`; blank mid-frame) | **FAIL** |
| `/tph-grid` | FAIL | FAIL | FAIL | FAIL | Q3, Q4, Q7 (lands on `/tph`) | **FAIL** |

---

## `/` — FAIL (admin → renders My day)

- Q1 toolbar stability: **PASS@375/768/1440, FAIL(minor)@1024** — Refresh click kept
  `.page-head` bbox identical at 3 widths, but at 1024 pass-1 measured height
  92.75→144.75 px after Refresh (+52 px status row wrapping); not reproduced in
  pass-2 rerun → intermittent A2-class shift.
- Q2 controls: **PASS** — all visible controls shared `cx-*` components with
  accessible names; focus ring verified on skip-link/brand/nav-toggle/rail-search.
  Unverified: pass-1 flagged 2 icon-only `button.cx-btn` with no accessible name
  (transient state; 0 found on re-probe).
- Q3 unstyled/raw: **FAIL** — `.brand` logo shows the browser broken-image glyph
  (`/_next/image … dabdoob-logo.png` → HTTP 500) in rail/top bar at every width.
  Note: `input[type=radio] name=md-agenda-range` are classless but CSS-hidden,
  rendered as the designed Today/Week segmented control — acceptable pattern.
- Q4 overflow/clip: **FAIL(minor)** — `scrollWidth == innerWidth` at all widths,
  but the fixed red "1 issue" pill clips the "Today" h2 @768, covers the 19:45
  timeline card @375, and covers the rail view-as user chip @1024/1440.
  Evidence: root-768.png, root-375.png, root-1024.png, root-1440.png.
- Q5 states: **PASS** — designed `cx-empty` ("Nothing is waiting on you.",
  "Nothing due in the next 7 days."), styled `role=alert` cards. Note: the same
  env-var copy ("set GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY …") is
  repeated verbatim in 5+ sections — technically styled, but raw config text.
- Q6 tokens: **FAIL(minor)** — 3× `hr.hr style="margin: 0.7rem 0px"` inline
  literals (B4). `span.nav-ind` px transform is dynamic positioning — exempt.
- Q7 headings/landmarks: **FAIL(minor)** — `h2 "View as"` precedes `h1 "My day"`
  in DOM order (B8-adjacent); otherwise 1 h1, no level skips, nav/main/header +
  10 labelled sections present.
- Q8 interactive states: **PASS** — `aria-current` on active rail item, distinct
  selected segmented pill, hover/disabled states present.

FAIL details:
- F1 major Q3: broken brand logo, `next/image` 500 on `/assets/dabdoob-logo.png`,
  `.brand-logo` / `.brand`, all widths — shots auth-login-375.png, root-768.png.
- F2 minor Q4: fixed `position:fixed` "N issue" pill overlaps content — clips
  `.cx-section` heading @768, covers stat-card title on `/tph` @375 ("…nd"),
  covers rail view-as chip @1024/1440 — shots root-768.png, tph-grid-375.png.
  No Phase-1 class (new: overlay has no safe-area offset; nearest B11 z-index).
- F3 minor Q1: intermittent `.page-head` +52 px growth after Refresh @1024 — A2.
- F4 minor Q6: `hr.hr` inline margin literals ×3 — B4.
- F5 minor Q7: `h2 "View as"` before `h1` — B8-adjacent.

## `/auth/login` — FAIL (logged out)

- Q1: **PASS** — centred card, no toolbar; layout unchanged across idle →
  "Signing in…" → error (auth-login-error-375.png).
- Q2: **PASS** — shared `Field`/`Input`/`Button`; `label[for=password]` verified;
  focus rings on all 4 controls.
- Q3: **FAIL** — `.brand-logo` broken-image glyph, `next/image` 500, all widths.
  Shots auth-login-375.png, auth-login-1440.png.
- Q4: **PASS** — `scrollWidth == innerWidth`, zero overflow offenders.
- Q5: **PASS** — designed `.login-error` `role=alert` (probe: "Invalid login
  credentials", styled bg/fg); busy labels on both buttons.
- Q6: **PASS** — no inline style literals.
- Q7: **FAIL(minor)** — two visible `<main>` landmarks: layout `main.main` wraps
  the page's own `main.login-wrap` (nested mains, invalid landmark structure).
- Q8: **PASS** — submit hover bg rgb(31,107,87)→rgb(20,51,43), cursor:pointer,
  disabled wired to loading states.

FAIL details:
- F1 major Q3 (shared with `/`): broken logo, `next/image` 500, `.brand-logo`,
  all widths.
- F6 minor Q7: nested `<main>` elements (`main.main` > `main.login-wrap`) — new
  class (landmark), file `src/app/auth/login/page.tsx:83` vs shell layout.

## `/auth/logout` — FAIL (admin)

- Transition: `/auth/logout` → `/api/auth/logout` → `/auth/login` in ~2.5–3.7 s;
  lands cleanly on the login form at all 4 widths. Mid-transition frame is fully
  blank (shots auth-logout-*-mid.png, ~2.8–4 KB) — minor polish gap vs the
  designed "Loading Dabdoob CX…" splash seen on the `/tph-grid` redirect.
- Landing page is `/auth/login`, so F1 (broken logo) and F6 (nested `<main>`)
  apply at every width → FAIL at 375/768/1024/1440.
- Q4 measured post-landing: no hscroll; controls labelled; focus rings verified.

FAIL details:
- F7 minor (transition): blank mid-frame instead of designed splash —
  `src/app/auth/logout/page.tsx` bare `redirect()` — new class.

## `/tph-grid` — FAIL (admin, redirects to `/tph`)

- Interim render: **PASS** — designed "Loading Dabdoob CX…" boot splash during
  redirect (tph-grid-*-mid.png), no broken flash; lands `/tph` in ~4.7–6.5 s
  (dev compile).
- Q1: **PASS** — header `.page-head` bbox stable through load; no refresh control
  on this page.
- Q2: **PASS** — 39–56 controls, all labelled; focus rings verified.
- Q3: **FAIL** — same broken `.brand` logo in top bar (≤768) / rail (≥1024).
- Q4: **FAIL(minor)@375/768** — `scrollWidth == innerWidth` (tabs strip is a
  designed scrollable `.tph-tabs` sw=643/cw=327), but the fixed "2 issues" pill
  clips a stat-card title ("…nd") and "Marked slots count…" text — shots
  tph-grid-375.png, tph-grid-768.png. @1024/1440 pill covers rail view-as chip.
- Q5: **PASS** — designed states: yellow "touches tomorrow ~08:30" notice,
  "Nothing needs attention for 2026-11-11.", "0 of 0", "—" placeholders, empty
  chart frames.
- Q6: **PASS** — only dynamic `nav-ind` px transform.
- Q7: **FAIL(minor)** — `h2 "View as"` precedes `h1 "TPH and caps"`; also
  `document.title` stays generic "Dabdoob CX" (`/` sets "My day · Dabdoob CX").
  Duplicate `h2 "Who is on which channel"` ×2 exist but are `display:none`
  (tab-inactive) — note only.
- Q8: **PASS** — selected tab underline, aria-current, hover distinct.

FAIL details:
- F1 major Q3 (shared): broken logo.
- F2 minor Q4 (shared): issue-pill overlap — worst here @375/768 (card text
  hidden).
- F5/F8 minor Q7: h2-before-h1 (B8-adjacent) + un-set `document.title`.

---

## Notes / non-blocking

- The "Not connected — set GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY…"
  alert copy repeats across 5+ sections on `/` — designed alert component, but
  raw env-config text; suggest one banner + short user copy (minor, Q5-adjacent).
- Dev console shows Next-16 `Date.now()` prerender errors on `/`, `/tph-grid`,
  `/tph`, `/auth/logout` — dev-build diagnostics, no visual impact.
- Skip-link (`a.skip`) renders offscreen until focus by design; ring verified.
- Unverified: 2 transient icon-only `button.cx-btn` without accessible name on
  `/` (pass-1 only, all widths; not reproducible in pass-2 DOM probe).

## Fix-shard candidates

| ID | Sev | What | Where | Width | Shot |
|----|-----|------|-------|-------|------|
| F1 | major | `next/image` 500 on `dabdoob-logo.png` → broken-image glyph in `.brand`/`.brand-logo` | login page + shell, all routes | all | auth-login-375.png, root-768.png |
| F2 | minor | fixed "N issue" pill clips content (section h2, stat-card titles, rail chip) | `/`, `/tph` | 375/768 (+overlap 1024/1440) | root-768.png, tph-grid-375.png |
| F3 | minor | `.page-head` +52 px after Refresh (intermittent) — A2 | `/` | 1024 | root-1024-after-refresh.png |
| F4 | minor | `hr.hr` inline `margin:0.7rem 0` ×3 — B4 | `/` | all | root-375.png |
| F5 | minor | `h2 "View as"` before page `h1` — B8-adjacent | `/`, `/tph` | all | root-1024.png |
| F6 | minor | nested `<main>` landmarks | `/auth/login` (via `/auth/logout` landing too) | all | auth-login-1024.png |
| F7 | minor | blank mid-frame during logout redirect | `/auth/logout` | all | auth-logout-1024-mid.png |
| F8 | minor | `document.title` not set on `/tph` | `/tph-grid`→`/tph` | all | tph-grid-1024.png |
