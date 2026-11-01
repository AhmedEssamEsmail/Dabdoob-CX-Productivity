# 03 - UI/UX Parity (Phase 3 plan)

Rule: the legacy app is the visual specification. No redesign, modernisation, simplification or UX "improvement". Any visible difference is a defect. This document defines how parity is achieved and measured; nothing here has been implemented.

## 1. Available visual evidence (and its limits)

| Evidence | Location | Covers |
|---|---|---|
| Legacy stylesheet (92 KB, un-minified copy not required; extracted verbatim) | `.devin/work/legacy.css`, `.devin/work/extract/app.css` | All tokens and component CSS of the shared design system |
| Legacy bundle JS (124 KB) | `.devin/work/legacy.js`, `.devin/work/extract/app.js` | Exact DOM structure, class names, copy for the 4 Productivity pages + shell |
| Legacy screenshot harness | `.devin/work/shoot-legacy.mjs`, `legacy-fixtures.mjs`, `lib-shots.mjs` | Serves `index.html` with a stubbed `google.script.run` and fixtures; produces PNG + `.styles.json` (computed styles) + `.dom.txt` outline |
| Legacy screenshots already captured | `.devin/work/shots/legacy/*.png` | status-validation (light, dark, mobile 390, flag detail), my-status (agent), productivity-analytics, tph, no-access, external-app notes |
| Registry / icons / i18n | `data/legacy-route-registry.json`, `data/legacy-i18n-ar.json`, `gs` icon map in the bundle | Rail structure, 40 icon SVG paths, Arabic strings |

**Hard limit**: the bundle only contains components for 4 pages. For the other 36 pages there is no DOM, no copy beyond the one-line purpose, and no screenshot. UI parity for them requires the original TSX sources or live access to the deployed apps (`06`, section 1). Until then the only parity that can be guaranteed for those pages is the shell: header (`page-title`, `page-purpose`), rail entry, icon, role gating and the "Not built yet" shape the legacy shell itself renders for unbundled pages (`hs` component: `.page-head`, `.pending`, `.pending-line` "Not built yet. Covers requirement N in the brief.").

## 2. Method: reuse, do not reinterpret

The current new app re-expresses the legacy look in Tailwind utilities and a 1,781-line `globals.css` with `legacy-*` class names. That is an interpretation. Parity work replaces it with the original CSS and DOM.

1. **Adopt the legacy stylesheet verbatim** as the app's global CSS (split only by layer for maintainability, never by editing rules): `:root` token layer (`--cx-*`, `--font`, `--text-*`, status/age/accent tokens), `[data-theme=dark]`, `[data-accent=blue|plum|rust]`, `[data-reduce-transparency]`, `[data-reduce-motion]`, RTL rules, component CSS (`cx-*`, `nav-*`, `rail-*`, `dq-*`, `pv-*`, `tph-*`, `cc-*`, `va-*`, `popup`, `toast`, `oo-alert*`, `skeleton`, `slot*`, `hm*`, `trk*`, `setting*`, `upnext*`, `ap-*`).
2. **Port React markup 1:1** from the bundle (class names, element order, ARIA attributes, text) for shell and the 4 pages; port the bundle's small utility components (`Y` chip, `Pa` page head, `j` section, `kt` lane strip, `Sn`, `Mn`, `Wt` skeleton, tooltip hook `Ca`, section-fold persistence) as shared components with the same DOM.
3. **Retire** `src/components/ui/*`, `SideRail.tsx` styling, `legacy-*` classes and `src/design/tokens/*.ts` once their replacement passes the diff gates. Tokens live in CSS custom properties, as in legacy.
4. **Fonts**: IBM Plex Sans (400/500/600/700), Plex Sans Arabic (400/600/700), Plex Mono (400/500), `display=swap`. The new layout already loads the same families via `next/font`; confirm weights.
5. **Assets**: copy the three boot-splash PNGs and the rail brand mark from `index.html` (base64 inline, lines 46-48) into `public/` or inline CSS exactly; reproduce splash CSS and the 9 s `bl-cycle`.
6. **Icons**: the 40 route icons come from the bundle's `gs` map (24x24, stroke line style, `currentColor`); replace the 12 hand-drawn icons in `SideRail.tsx`.
7. **Behavioural CSS parity**: animated `nav-ind` slider (`translate`, width/height from the active link, `data-tone`), entrance animation (`is-in`, `is-done`, 820 ms), View Transitions on hash change, reduced-motion/transparency handling, `localStorage` keys `cx.appearance`, `cx.rail-off`, `cx.sections-open`, `cx.oo-alerts-seen`.
8. **Copy**: every string verbatim, including punctuation (curly apostrophes such as "agent's" use `’` in purposes), en-dash/em-dash usage, and the Arabic dictionary for shell chrome.
9. **Time/number formatting**: `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait' ... })`, minute strings "N min", percentages with one decimal as returned by the server.
10. **Routes**: serve legacy URL shapes. Hash routes (`#/status-validation`) and `?page=` / `?tab=` must work; if path routes are used internally, a client shim maps `#/x` -> `/x` (D2).

## 3. Rail and navigation spec (reproduce exactly)

- Group order: Hub, Quality, Productivity, Queue & Workforce, People & Performance, Operations & Trackers, TL desk, FCR; each with `data-tone` (work/team/quality/system as in `01` section B).
- In an app context the active group lists its visible pages (after `En()`/`Qt()` gating) under `nav-group-label`; every other group renders one `nav-group--app` entry whose label is the group label, icon is that group's default-page icon, with external glyph and tooltip "Opens <page> in <App>" (internal link under D1; "not connected" state retained only if D1 keeps separate apps).
- Brand: mark + app title (`CX Productivity` etc.); footer: user name, role label (Admin / Team lead / Agent / "No access"; "<role>, viewed by you" in View as), collapse chevron; `View as` entry above the footer for the owner only.
- Mobile: rail collapses to header with "Menu"/"Close" button; `nav-open` state.

## 4. Per-page parity checklist template

Every page ticket must attach: (a) legacy screenshot(s) for each role and state, (b) computed-style JSON diff, (c) DOM outline diff, (d) interaction script results. States to capture per page: loading skeleton, populated, empty, error ("This page could not load. <msg> Try again"), each role (admin, tl, agent, specialist where relevant), light/dark, accents (pine, blue, plum, rust), `lang=ar` RTL, viewport 1440x900 / 1024x768 / 768x1024 / 390x844, reduced motion, View as banner, hover/focus/active for every interactive control, open modals (flag detail, View as picker, pop-up, 1:1 alert, task form).

## 5. Acceptance harness (to build in Phase 5, module 0)

Extend the existing `.devin/work` tooling into a repeatable suite under `e2e/parity/`:

1. **Legacy side**: `shoot-legacy.mjs` with fixtures (already working for 4 pages). Freeze the clock (`page.clock`/`Date` stub) so relative times match; stub `Math.random`; disable the splash animation by pausing at t=0; fixtures extended per page.
2. **New side**: Playwright screenshots of the new app at the same URLs/states using the same fixtures served by a test mode (`?mock`-style toggle, as the legacy bundle supports `?mock` and `?role=`; parameters `mock`/`role` are stripped from deep links).
3. **Pixel diff** (`pixelmatch` or Playwright `toHaveScreenshot`) with thresholds: 0 changed pixels in rail/headers; <= 0.1% elsewhere on identical fixtures; anti-aliasing tolerance only. **Computed-style diff** of the selector list in `lib-shots.mjs` (`STYLE_SELECTORS`, `STYLE_PROPS`) must be empty. **DOM outline diff** (`domOutline` depth 8) must match modulo framework wrappers.
4. **Interaction parity**: scripted flows (open flag, accept/revert, TPH paint/task/cases, View as, pop-up Later/Log it now, 1:1 alert dismiss, rail collapse, language/theme switch) assert identical text, focus order, `aria-*`, and keyboard behaviour.
5. CI gate: parity suite must pass for a module before its work package can close.

## 6. Known and suspected divergences (to be measured, not assumed)

| Area | Observation | Confidence |
|---|---|---|
| Class namespace | New uses `legacy-nav-*`, `legacy-rail*`, Tailwind arbitrary values; legacy uses `nav-*`, `rail-*`, `cx-*`, `dq-*`, `pv-*`, `tph-*` | `[V]` (`SideRail.tsx`, `my-status/page.tsx`) |
| Icons | New rail uses 12 hand-drawn icon paths; legacy uses 40 distinct icons | `[V]` |
| Rail structure | New adds an "Admin" group (Config, Roster) and a "Productivity" group listing that is always shown; legacy shows the active app's group only and an Admin page inside Hub | `[V]` |
| Rail entries | New shows disabled app entries with no destination; legacy shows live single-entry links | `[V]` |
| Landing page | New `/` is a marketing-style page ("Make the work visible."); legacy `/` is Home (`overview`) | `[V]` (`page.tsx`) |
| Boot splash | Absent in new | `[V]` (no splash assets in `public/`) |
| My status, TPH | Different structure from legacy (sections, tabs) | `[V]` (page sizes and absent strings) |
| Dark mode, accents, RTL | New has theme + language toggles only; accent set absent | `[V]` |
| Status validation | Unknown; page is large (587 lines) and uses `pv-*`-like ids (`pending-title`, `decided-title`, `source-title`) | `[H]` needs diff |
| Status chip palette | Legacy tokens: ok `#17744a/#e4f4ec`, warn `#7d5000/#fdf0d6`, bad `#b3261e/#fbe9e7`, info `#0f5a96/#e3eefa`, neutral `#46546a/#e6eaf1`; aging scale `--cx-age-0..6` `#aab5c4 -> #65171c`; dark and accent overrides in CSS | `[V]` legacy values; new values unmeasured |

## 7. Out of scope for "parity" decisions (flag, do not decide)

- Replacing Google's per-app web-app URLs with in-app routes changes the URL bar and cross-app link behaviour (D1).
- Browser title changes ("New: <title>", "1:1 now") and Web Audio chime must be reproduced; they are behaviours, not styling.
- Features that exist only in the bundle but not on the server (disputes) need an owner decision (D5) before being reproduced.
