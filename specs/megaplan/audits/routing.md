# WP-43 — Routing / compat sweep + route-audit regen

Regenerated `specs/cx-hub/route-audit.json` (the tracked path) against the live
app and verified every compat surface the WP asks for. One real gap found and
fixed inline (page-level `?param` deep links), plus one upstream registry
nuance documented.

## 1. Registry → route matrix (40/40 resolved, 0 missing)

Source of truth: `specs/legacy-parity/data/legacy-route-registry.json` — 40
paths, matching `PAGES` in `src/features/shared/components/shell/registry.ts`
entry-for-entry (paths, titles, groups, reqs, roles, purposes).

Extraction nuance worth recording: in `.devin/work/extract/*/registry.json`
only the **quality** bundle carries all 40 entries. The other 7 bundles
(hub/queue/people/operations/desk/fcr/productivity) carry a 39-entry registry
missing `quality-scores` — the "Team scores" page predates those bundle
snapshots. The 40-entry canonical list (quality bundle) is authoritative and
is what `PAGES` encodes.

| Status | Count | Routes |
|---|---|---|
| `page` (real `src/app/<path>/page.tsx`) | 36 | all except the 4 below |
| `placeholder` (catch-all → `UnbuiltPage`) | 4 | `hard-cases`, `kpi-close`, `escalation-matrix`, `fcr` |
| `redirect` | 0 | none required |
| `missing` | 0 | — |

Verified mechanically: every `PAGES` path with a `page.tsx` exists on disk;
the 4 placeholders have no directory and resolve through
`src/app/[...slug]/page.tsx` → `PAGES.find(slug.join('/'))` → `UnbuiltPage`
("Not built yet." — legacy `hs()`), which is exactly what the legacy bundle
rendered for them.

Hidden / extra routes (unchanged from the previous audit, re-verified):
- `ecosystem` — `src/app/ecosystem/page.tsx`, hidden URL-only page; renders
  bare (no rail/banner/popups) via the `n1` early return at `AppShell.tsx:287`.
- `admin/roster`, `admin/config` — non-registry sub-pages backing `/api/roster`
  and `/api/config`.
- `tph-grid` — the TPH implementation route; registry `/tph` re-exports it
  (`src/app/tph/page.tsx`), so both URLs serve the page.
- `auth/login`, `auth/logout` — bare auth chrome (SiteChrome skips the shell
  for `/auth/*`).
- `/` — `src/app/page.tsx` renders the fallback page in place (legacy
  empty-hash root branch).

## 2. Shim coverage (`#/path`, `?page=`, `?tab=`) — verified, params now consumed

`HashShim` (`src/features/shared/components/shell/HashShim.tsx`) is mounted
globally for every non-`/auth/` route (`SiteChrome.tsx:41`):

- **`#/path?q` → `/path?q`** — query forwarded verbatim; path validated against
  `/^[a-z0-9-]+$/`; listens on mount + `hashchange` (legacy `sa()` +
  hash-router).
- **`?page=path&rest` → `/path?rest`** — only when the hash is empty (same
  condition as legacy `sa()`); drops `page`/`mock`/`role`, forwards every
  other param — including `tab`.
- `?tab=` is not a shim token — it is a page param (TPH only, confirmed against
  all 8 extract bundles). It rides along inside `#/tph?tab=x` and
  `?page=tph&tab=x` → `/tph?tab=x`.

**Gap found + fixed (in scope).** The shim forwarded params into
`location.search` correctly, but **six page-level consumers still read the
verbatim legacy `location.hash`**, so deep links lost their state:

| Consumer | Params | File |
|---|---|---|
| `useHashParams` (aging) | `ticket`, `mine`, `unassigned`, `flagged` | `src/features/cx-queue/components/shared.tsx:118` |
| `useHashParams` (checkins) | `slot` | same helper, `checkins-page.tsx:49` |
| `hashParam` (1:1s) | `schedule`, `log` | `src/features/cx-people/components/pw.tsx:177` |
| `readHash`/`writeHash` (team scores) | `p`, `from`, `to`, `by`, `tl`, `agent`, `basis` | `src/features/cx-quality/components/quality-scores-page.tsx:374-385` |
| `hashTl` (TL performance) | `tl` | `src/features/cx-desk/components/tl-performance-page.tsx:91` |
| inline read (trackers) | `t` | `src/features/cx-operations/components/trackers-page.tsx:753` |
| `Yt` + `select` (TPH) | `tab` | `src/app/tph-grid/page.tsx:316-318, 1911` |

Fix: new `pageParams()` in `src/features/shared/shell/gates.ts` — a
`#/path?…` hash tail takes precedence when present (it is the newer,
pre-shim form of the link — the shim always consumes it, so the tail only
coexists with stale search params during the `hashchange` window), with
`location.search` filling the rest (the canonical post-shim form). All six
readers route through it; the two writers (`writeHash`, TPH `select`) now
write `location.pathname + '?' + params` instead of `#/path?params`, so the
URL is immediately canonical and survives reloads. Behaviour is otherwise
identical — params remain mount-time seeds for `useState`, exactly as in the
legacy closures (verified `aging.closure.js` uses the same one-shot read).

Also verified:
- Deep-link producers resolve correctly: `#/aging?unassigned=1`,
  `#/aging?mine=1&band=top`, `#/checkins?slot=…`, `#/one-on-ones?schedule=…`,
  `#/one-on-ones?log=…`, `#/tl-performance?tl=…`, `#/aging?ticket=…` — either
  as `<a href="#/…">` (→ `hashchange` → shim) or through `resolveLink` /
  `appLink`.
- `band=top` on `#/aging` is a **dead param in the legacy too** (the aging
  closure ignores it) — parity, no change.
- `notes-page.tsx:139` `location.hash = '#/tl-tasks'` still works (a real
  `hashchange` fires → shim routes it).

## 3. Unknown paths → `redirect('/')` — verified

`src/app/[...slug]/page.tsx`: `PAGES.find(slug.join('/'))` — registered path
without a page → `UnbuiltPage`; anything else → `redirect('/')`. `/` then
renders the role-appropriate fallback in place (root `page.tsx`), matching the
legacy hash router's default-page behaviour. Multi-segment unknowns (e.g.
`/admin/xyz`) likewise redirect.

A registered path the user can't see does **not** hit the catch-all: the
shell's legacy `k/A/V` redirect (`AppShell.tsx:167-183`) sends them to the
first visible page with `?from=<path>` and the `cx-note` ("…is not available
to you, so you are on …"), verbatim.

## 4. State screens — all four, on every page

The four full-area `.state-screen` states live in `AppShell`, which wraps every
non-`/auth/` route — coverage is uniform across the 36 pages, the 4
placeholder routes (catch-all renders inside the shell), `/`, `tph-grid`,
`admin/*`, and `ecosystem` (the three pre-shell states fire before the `n1`
bare early-return):

| State | Trigger | Ported copy (verbatim) | Site |
|---|---|---|---|
| could-not-start | boot fetch/parse fails | `{app} could not start` + error + Reload | `AppShell.tsx:238-252` |
| not-set-up | `user.role === 'unknown'` | `You are not set up yet` + roster note | `AppShell.tsx:273-284` |
| no-access | `user.role === 'unknown'` under View-as | `{name} has no access` | `AppShell.tsx:258-272` |
| nothing-for-you | no visible page for the role in this app | `Nothing in {app} for you yet` + Open the Hub | `AppShell.tsx:323-336` |

All four texts byte-match the bundle (`app.pretty.js:5800/5822/5838/5876`,
Arabic dictionary entries present). Per-page denial is the `cx-note` +
fallback-redirect path (§3), not a fifth screen — same as legacy.

## 5. `BUILT_ROUTES` completeness — 36 + 4 + ecosystem

`BUILT_ROUTES` was dropped deliberately in `bcd4089` ("drop dead
APP_KEY/APP_TITLE/BUILT_ROUTES"): in the port the filesystem is the build
registry (`registry.ts` `Xt` comment). The equivalent invariant holds exactly:
**36 registry paths have a real `page.tsx`, 4 registry paths intentionally
fall through to `UnbuiltPage`, plus the hidden `ecosystem` page** — matching
the "36 built + 4 placeholders + ecosystem" target.

## 6. Changes made in this WP

- `src/features/shared/shell/gates.ts` — added `pageParams()` (search-first,
  hash-tail fallback).
- `src/features/cx-queue/components/shared.tsx` — `useHashParams` → `pageParams`.
- `src/features/cx-people/components/pw.tsx` — `hashParam` → `pageParams`.
- `src/features/cx-quality/components/quality-scores-page.tsx` — `readHash` →
  `pageParams`; `writeHash` writes `pathname + '?' + params`.
- `src/features/cx-desk/components/tl-performance-page.tsx` — `hashTl` →
  `pageParams`.
- `src/features/cx-operations/components/trackers-page.tsx` — `?t=` read →
  `pageParams`.
- `src/app/tph-grid/page.tsx` — `Yt` → `pageParams`; `select` writes
  `pathname + '?tab='`.
- `specs/cx-hub/route-audit.json` — regenerated (this audit).

## 7. Residuals / observations (no WP-F needed)

- **Cross-app `appLink`/`_e` stays verbatim-external** — e.g. the
  `#/tl-performance?tl=` PerfLink on 1:1s resolves via `boot.appUrls['desk']` +
  the `?page=` shim, rendering the legacy "not connected" muted note when the
  app URL isn't configured. That is the ported verbatim behaviour; the unified
  rail already links every group internally via `resolveLink`, so reachability
  is unaffected.
- **`?page=` with an unregistered/invalid value** — no rewrite (regex /
  registry miss), param stays in the URL; same as legacy.
- **No `redirect()` aliases needed** — legacy `doGet` serves the shell, no
  `AppRedirect` exists, and `ScriptApp.getService().getUrl()` only feeds email
  `link` fields whose `#/…` targets are all registered paths (routed by the
  shim).

## Gates

- `npx tsc --noEmit` — **0 errors**.
- `npx vitest run` — **1126/1126 tests green, 46/46 files**. (An earlier run
  mid-WP caught `tests/golden/viewas-sweep.test.ts` — untracked WP-42
  work-in-progress — failing at import on a missing
  `SUPABASE_SERVICE_ROLE_KEY` env; the WP-42 agent fixed it during this WP and
  the final run is fully green.)
- `npx eslint` on all 7 touched files — **0 errors, 0 warnings**.
