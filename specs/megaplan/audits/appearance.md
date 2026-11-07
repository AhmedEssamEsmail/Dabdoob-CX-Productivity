# WP-44 — Appearance / i18n matrix

Verification of `specs/legacy-parity/03-ui-ux-parity.md` §2.2/§2.7/§2.8 against
the port, on three layers: (a) **code parity** — mechanical diff of the ported
CSS/TSX vs the verbatim legacy extracts in `.devin/work/extract/`; (b) **live
smoke** — Playwright on `next dev` with the seeded e2e admin, toggling every
dimension and reading back `<html>` attrs, computed vars and geometry;
(c) **dictionary coverage** — programmatic diff of the 80-key `ps` dictionary
in **all 8** legacy app bundles vs `specs/legacy-parity/data/legacy-i18n-ar.json`
(the file the port imports).

Headline: **everything verified verbatim.** One real gap found and fixed inline
(auth pages never ran `applyAppearance` — stored theme/accent/transparency were
ignored there). No structural RTL problems; no WP-F needed for RTL. One
decision-class dict note filed as WP-F24.

## 1. Matrix

| Dimension | Mechanism (legacy → port) | Live smoke | Verdict |
|---|---|---|---|
| theme `auto` | `data-theme` removed from `<html>`; `@media(prefers-color-scheme:dark){:root:not([data-theme=light])}` | attr removed; body bg `rgb(242,245,244)`↔`rgb(19,27,29)` under emulated OS light/dark | PASS |
| theme `light` | `data-theme=light` suppresses the dark media block | `data-theme=light` | PASS |
| theme `dark` | `data-theme=dark` | `data-theme=dark` | PASS |
| accent `pine` | `data-accent` removed (pine = default token) | attr removed, `--cx-accent=#1b4c45` | PASS |
| accent `blue` | `html:root[data-accent=blue]{--pine-2/#2b5797…}` | `data-accent=blue`, `--cx-accent=#2b5797` | PASS |
| accent `plum` | `…[data-accent=plum]{…#6b3a72…}` | `data-accent=plum`, `--cx-accent=#6b3a72` | PASS |
| accent `rust` | `…[data-accent=rust]{…#9a4a1f…}` | `data-accent=rust`, `--cx-accent=#9a4a1f` | PASS |
| reduce transparency (`solid`) | `data-reduce-transparency` attr; 3 verbatim rules (global `backdrop-filter:none`, `--qg-glass*`→surface) | attr set | PASS |
| reduce motion (`still`) | `data-reduce-motion` attr; 11 verbatim rules incl. global `transition/animation:none` + OS `@media(prefers-reduced-motion:reduce)` block; `_n()`/`prefersReducedMotion()` consumers | attr set | PASS |
| lang `en` | `lang=en dir=ltr` | — | PASS |
| lang `ar` | `lang=ar dir=rtl` on `<html>` + `D()` translate + `uu()` Arabic-Indic digits | `dir=rtl` + Arabic rail on all 8 route groups | PASS |

Appearance control surface (`Tm` → `admin-page.tsx:317-388`): theme radio
`bm` = light/dark/auto, accent dots `Em` = pine/blue/plum/rust with the legacy
hex swatches (#1b4c45/#2b5797/#6b3a72/#9a4a1f), `solid`/`still` checkboxes,
language `wm` = en/العربية — byte-verbatim vs the hub bundle `Tm`
(`extract/hub/app.pretty.js:1841-1945`), incl. `Sf`/`am`/`Mf`/`iu` defaults.
Live-clicked in the smoke: every control flips its `<html>` attr **and**
persists `cx.appearance`, and the panel's own labels re-render in Arabic
(legend → `المظهر`) via the component's own setState.

## 2. `<html>` attribute pipeline

| Site | Legacy | Port | Status |
|---|---|---|---|
| pre-paint boot | `index.html:14` — only `still`→`data-reduce-motion`, `lang=ar`→`lang`+`dir=rtl` | `layout.tsx:16` `APPEARANCE_BOOT` **byte-identical** + `data-entry="first"` | verbatim |
| apply | `ia(t)` sets/removes `data-theme` (auto⇒rm), `data-accent` (pine⇒rm), toggles `data-reduce-transparency`, `data-reduce-motion`, sets `lang`+`dir`, notifies `ct` | `applyAppearance` `i18n.ts:51-62` — statement-for-statement identical | verbatim |
| defaults/read | `It`, `ca()` | `APPEARANCE_DEFAULTS`, `readAppearance` `i18n.ts:23-38` | verbatim |
| subscribe | `ct`/`oa()` | `listeners`/`onAppearanceChange` `i18n.ts:40-48` | verbatim |
| motion check | `_n()` = media OR attr | `prefersReducedMotion` `i18n.ts:65-71` | verbatim |
| first-paint | `ia(ca())` at bundle eval | `applyAppearance(readAppearance())` in `AppShell` effect `:191` + (new) `SiteChromeBody` effect for `/auth/*` | parity |

FOUC nuance (verbatim quirk, not a defect): the legacy boot script also applied
only `still`+`lang`/`dir` pre-paint — a stored `theme:dark`/`accent:*`/`solid`
flashes default until the bundle ran `ia(ca())`. The port reproduces exactly
that window; `AppShell`'s effect is the `ia(ca())` equivalent.

## 3. CSS rule diff (mechanical)

`src/app/globals.css` vs `.devin/work/extract/app.css` (the productivity sheet
= base design system every app shared): **820 rules, 0 port-only, 25
legacy-only — all 25 being the boot-splash block** which lives verbatim inside
`BootSplash.tsx:SPLASH_CSS` (rule-for-rule identical, incl. the
`html[data-reduce-motion] .boot-splash *`, `@media(prefers-color-scheme:dark)`
and `@media(prefers-reduced-motion:reduce)` splash rules). So the shared sheet
is 100% verbatim; every theme/accent/reduce/RTL rule below is byte-identical:

- `data-theme`: 6×dark + 6×light + 5×`prefers-color-scheme:dark` (+1 splash) — all identical
- `data-accent`: blue/plum/rust ×1 each (pine is default) — identical
- `data-reduce-transparency`: 3 — identical
- `data-reduce-motion`: 10 (+1 splash) — identical
- `[dir=rtl]`: **14 rules — byte-identical** (`.cx-icon--flip` scaleX(-1),
  letter-spacing zeroing on headings/nav-group-label, `.cx-select` chevron
  background-position swap, `.cxp-fold` chevron rotate flip, `[dir=rtl]`
  line-height `var(--lh-arabic)`, `.rail-collapse`/`nav-ext` mirroring incl.
  the `.rail-off` un-mirror, `.toast` `toast-in-rtl` (keyframes present),
  `.cc-sweep-bar` transform-origin flip, `.cc-ring` mirror)

`src/app/legacy-apps.css` (generated by `scripts/merge-app-css.mjs` = per-app
rules absent from the base sheet, scoped `[data-app="<app>"]`) — per-app
sheets have **zero `[dir=rtl]`/`direction` rules in legacy**; they are written
in logical properties. Measured physical-vs-logical prop counts per extract:
`left/right/margin-left/right/padding-left/right/border-left/right/text-align:left|right`
= **1–2 hits per app** (`.nav-ind{left:0}` — JS-driven slider, and hub's
`.eco3-tag` offscreen `translate(-200vw)`) vs 30–84 logical-prop hits per app.
RTL therefore inherits entirely from `<html dir=rtl>` + logical CSS, exactly
as legacy.

Physical positioning inside components is verbatim-identical too:
`.cc-tip{left:x}` tooltips (`ui.tsx:287`, `queue/shared.tsx:196`,
`hub-shared.tsx:389`, `one-on-ones-page.tsx:422`), the `pw-g-track` timeline
bars `left:%` (`tl-tasks-page.tsx:428-466` = `people/app.pretty.js:6398-6451`
verbatim), nav-ind `translate(offsetLeft,offsetTop)` (`AppShell.tsx:134` =
legacy `pn()`), and the RTL-aware arrow-key flip in the TPH tablist
(`tph-grid/page.tsx:427` `getComputedStyle().direction==='rtl'` — verbatim).

## 4. RTL layout — representative page per route group

Live smoke (`lang=ar`, 1440×900) on one page per group; all render inside
`SiteChrome→AppShell` so `<html dir=rtl>` + rail Arabic hold:

| Group | Page | dir | Arabic nav | Rail geometry |
|---|---|---|---|---|
| hub | `/admin` | rtl ✓ | `الرئيسية` (Home) | rail at right edge |
| quality | `/audit-queue` | rtl ✓ | `المركز` (Hub entry) | — |
| productivity | `/status-validation` | rtl ✓ | `المركز` | — |
| queue | `/queue` | rtl ✓ | `المركز` | — |
| people | `/one-on-ones` | rtl ✓ | `المركز` | — |
| operations | `/trackers` | rtl ✓ | `المركز` | — |
| desk | `/mail-desk` | rtl ✓ | `المركز` | — |
| fcr | `/fcr` (hs placeholder) | rtl ✓ | `المركز` | — |

Geometry check (`wp44-rtl-geom`): LTR rail x=12..230 → RTL rail x=1195..1413
(mirrored to the right edge; the ~15 px delta = the vertical scrollbar moving
to the left side in RTL); `.nav-ind` parked on the active link via the same
offset math in both directions (links are full-width so `offsetLeft` is
physical distance — verbatim `pn()`). Screenshots: `.devin/work/parity/
wp44-trackers-rtl.png`, `wp44-trackers-ar.png`.

Structural RTL problems found: **none.** The only direction-physical code in
the port is verbatim-legacy (see §3); no TSX sets `dir="ltr"`, no physical
`text-align`/`float`/`order`, and `uu()` Arabic-Indic digit substitution is
ported per module verbatim (`hub-shared.tsx:291`, `tl-performance-page.tsx:98`,
`one-on-ones-page.tsx:90`, `qa-shared.tsx:1085`, `quality-analytics-page.tsx:196`,
`heatmap-page.tsx:459`, `queue/shared.tsx:208` — `lang!=='ar'` guards
identical to the 29 `documentElement.lang` checks across the 8 bundles).

## 5. Storage-key sweep

`localStorage` surface — every key verbatim-legacy, and appearance state uses
**only** `cx.appearance`:

| Key | Writers / readers | Legacy twin |
|---|---|---|
| `cx.appearance` | `i18n.ts:34` read, `layout.tsx:16` boot read, `admin-page.tsx:320,328` (`Sf`/`am`) | `la`/`ca()`/`ia()` — identical |
| `cx.rail-off` | `AppShell.tsx:58-76` | `On`/`fn` etc. — identical |
| `cx.sections-open` | `ui.tsx:101-118` | `Cn`/`qe` — identical |
| `cx.oo-alerts-seen` | `OneOnOneAlerts.tsx:15-31` | `vn` — identical |
| `cx.filters` | `tl-tasks-page.tsx:70-84` | `as` (people bundle) — identical |
| `md_open_*` | `my-day-page.tsx:380-392` | `` `md_open_${n}` `` (hub bundle :2859) — identical |

No `sessionStorage` anywhere; no alternate appearance key exists.

## 6. Dictionary coverage (80 keys)

`legacy-i18n-ar.json` = **80/80 keys+values byte-identical to `ps` in all 8
legacy bundles** (programmatic diff: desk, fcr, hub, operations, people,
productivity, quality, queue — zero missing/extra/value-diff in every one).
`i18n.ts` imports that file directly; `D()`+`useLang()`+`ms()` are verbatim.

Keys the ported UI actually renders (79/80):
- 8/8 group labels — `D(GROUP_LABELS[g])` (`AppShell.tsx:386,442`)
- 37/37 dict page titles — `D(page.title)` (`AppShell.tsx:453`); `Admin` doubles
  as the role label → `الإدارة` via `WHO_ROLE_LABELS`
- 4/4 role labels — `Team lead`/`Agent`/`No access`/`Admin` via
  `D(WHO_ROLE_LABELS[role])` + `D('{role}, viewed by you',{role:displayRole})`
- 19/19 shell strings — skip-link, Main, Menu/Close (ternary), Show/Hide-the-menu
  (label+title variants), not-connected note, both not-connected tooltips,
  `Opens {name} in {app}` + ` (opens in {app})`, `{role}, viewed by you`,
  all four state screens + Reload + Open the Hub
- 10/10 appearance strings — Theme/Light/Dark/Auto(+hint)/Accent/Reduce
  transparency/Reduce motion/Language/Saved — via `D()` + `D(s)` in `Tm`'s
  `bm`/`Em` maps (wm language names intentionally raw, as legacy)

Dead in port **and** legacy: `", mock data"` — present in all 8 bundle dicts
but no call site in any bundle (the `?mock` param is stripped by the router);
the port likewise has no call site. Parity.

### Missing dictionary keys — for strings the port renders

**None.** Every `D()` argument exists in the dict. The only rendered strings
with no dict entry are the same ones legacy left English in `lang=ar` mode —
they are *not* `D()`-able without diverging from the bundle:

| String | Where rendered | Legacy behaviour |
|---|---|---|
| `Team scores` | registry `quality-scores` title — nav + `hs`/page head | absent from all 8 dicts → English in ar (the page postdates the dict snapshot — WP-43 §1) |
| `TPH and caps` | registry `tph` title | absent → English in ar |
| `Specialist` | `displayRole()` for specialist users in `{role}, viewed by you` | `bn()` returns raw `'Specialist'`; `fs` has no specialist key → English |
| `CX Helm <app>` titles | interpolated `{app}` values | `Te(S)`/`ke.apps[].title` are English → Latin inside Arabic sentences |
| All page-body copy | purposes, buttons, toasts, view-as banner/picker, popup copy, `hs` "Not built yet.", `Sn` "This page could not load.", cx-notes, `tph-tabs` aria-label, etc. | never dict'd in any bundle → English |
| Boot text `Loading CX Productivity…` | `BootSplash` | dedicated ar swap (boot.js verbatim `جارٍ تحميل …`) — covered, not dict |

The `Team scores`/`TPH and caps` pair is the only *addressable* coverage gap —
fixing it means adding 2 keys to the canonical dict, which deliberately breaks
byte-parity with the bundle. Filed as owner decision → **WP-F24**.

## 7. Fix landed (mechanical gap)

`/auth/*` pages bypass `AppShell` (`SiteChromeBody` returns the bare state
screen), so `applyAppearance(readAppearance())` never ran there — a stored
`theme`/`accent`/`solid` was silently ignored on the login screen (only
`still`+`lang`/`dir` applied via the boot script). Legacy ran `ia(ca())` on
every page. Fix: `useEffect(() => { if (isAuthPage) applyAppearance(readAppearance()) },
[isAuthPage])` in `SiteChromeBody` (`src/features/shared/components/layout/
SiteChrome.tsx`). Live-verified: seeded `{theme:'dark',accent:'blue',solid:true,
still:true,lang:'ar'}` now yields `data-theme=dark data-accent=blue
data-reduce-transparency data-reduce-motion lang=ar dir=rtl` on `/auth/login`.

## 8. Evidence

- Mechanical diffs (this audit): globals.css 820/845 rules identical + 25
  splash rules identical inside `BootSplash.tsx`; dict 80/80 × 8 bundles;
  storage keys 6/6 verbatim; `D()` call sites = legacy's 22 shell + 8 `Tm`
  (hub bundle `ft()`), 1:1.
- Live smoke (Playwright + seeded e2e admin on `next dev`): **31/31 checks**
  — theme ×3 + auto-OS-follow, accent ×4 incl. `--cx-accent` computed values,
  both toggles, `lang=ar` dir=rtl + Arabic rail on 8/8 route groups, `Tm`
  live-toggle of all five dims + persistence + live Arabic re-render.
- Auth-page appearance re-verified after fix (see §7).

## 9. Gates

- `npx tsc --noEmit` — **0 errors in touched files**; 1 pre-existing error in
  `scripts/parity/run.ts:134` — sibling WP-45 in-flight file, unrelated.
- `npx vitest run` — **1126/1126 (46 files) green**.
- `npx eslint` on `SiteChrome.tsx` — **0 errors / 0 warnings**.

## 10. Questions for orchestrator

- WP-F24: add `Team scores` + `TPH and caps` to `legacy-i18n-ar.json`?
  Byte-parity says keep-as-legacy; coverage says add. Needs owner sign-off on
  which invariant wins.
- No other open items: appearance/i18n surface is verbatim end-to-end.
