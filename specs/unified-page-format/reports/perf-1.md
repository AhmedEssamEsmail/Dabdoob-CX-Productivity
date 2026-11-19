# perf report - unified-page-format - round 1 (FULL)

Verdict: PASS
Open: 0B / 0H / 0M / 0L

## Measurements

Route-switch latency — Playwright probe (chromium, 1280px, admin login) on self-managed `npm run dev` (Next 16.4.3 Turbopack, Cache Components). In-page MutationObserver + 4ms poll recorded URL-commit, `.page-loading` mount/dismount, new `h1` render, `.boot-splash` computed-visibility, `#app` emptiness, `.rail` element identity. Two passes over all 38 unique rail hrefs (`specs/unified-page-format/logs/perf-nav-probe.log`):

| Metric | Cold-compile pass | Warm pass | Budget/criterion |
|---|---|---|---|
| URL commit after nav click (pathname change) | p50 536ms, p90 1468ms, max 7574ms | **p50 106ms, p90 175ms, max 182ms** | "feels instant" — met |
| New page `h1` rendered (content swap) | p50 552ms, max 7574ms (`/disputes` compile) | **p50 310ms, p90 1083ms, max 3622ms** (`/calibration`, remote-data) | content swap only — met |
| `.page-loading` mount time | 3/38 navs, ~100ms | 38/38, p50 106ms | mounts at commit |
| `.page-loading` DOM dwell | p50 118ms, max 812ms | p50 190ms, p90 903ms, max 3514ms | visible only after 150ms CSS delay — no flash |
| `.boot-splash` computed-visible | 0 / 37 navs | 0 / 38 navs | never — met |
| `#app` emptied | never | never | met |
| `.rail` remount | — | same element (data tag persisted) | shell never unmounts — met |

Delayed-show verified: `.page-loading` DOM-mounts at commit (~106ms) but `refresh.css:584-588` `animation: page-loading-in .15s ease .15s backwards` keeps it invisible ~150ms — warm p50 dwell 190ms ⇒ most navs paint the spinner <~100ms or not at all; genuine waits (`/calibration` 3.5s) correctly show it. Matches PLAN #5 and nav-no-splash.spec.ts PASS (qa-2, 2/2 chromium).

Bundle weight — `git diff` vs HEAD (working tree carries the whole spec):
- Tracked `src/` delta: +20,769B / −20,582B → **net +187B source** (markup/class swaps across ~40 files).
- CSS: refresh.css net +468B (`.page-loading`/`.spinner`/nav-group rules minus `.aging-page-head` carve-outs); other CSS net −506B (dead head CSS deleted). Global CSS net ≈ −38B.
- New shipped modules (gzip): `RefreshButton.tsx` 1,959B → **899B gz** (client; replaces two duplicated `RefreshNow` impls → net ≤0); `Spinner.tsx` 429B → 275B gz (no `'use client'`, server-safe); `src/app/loading.tsx` 219B → 194B gz (server fallback, ~0 client JS).
- New client JS ≈ **≤1KB gz total** vs budget "no route JS growth >10% or >30KB gz" → PASS. No new deps; only 2 added import lines (barrel `RefreshButton` re-export).

Data fetching / DB / jobs: spec is markup+shell-only; diff contains no query, API-route, or fetch changes — nothing to EXPLAIN. N/A.

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| — | — | — | none | — | — |

## Mechanism verified
Root `src/app/loading.tsx` (server component) yields instant commit + Suspense fallback; `SiteChrome.tsx:39-43` `#app[data-booted]` latch + `BootSplash.tsx:11` `#app[data-booted]+.boot-splash{display:none}` guards splash re-appearance — 0 sightings across 75 navigations.

## Not measured / assumptions
- Numbers are dev-server (Turbopack dev compile + remote Supabase/FD data); production h1T will be lower — relative mechanism (instant commit ~106ms, delayed spinner, latch) is what was verified. No production build run: budget is a *growth* check, measured precisely as ≈+1KB gz via source diff + module gzip.
- Cold pass n=37: first rail href was the current route (`/`), pathname never changed — excluded, not a defect.
- `/calibration` warm 3622ms is remote-data latency on an untouched page (qa-2 notes the same cold-flakiness); not attributable to this diff. The `>150ms` delayed spinner handled it as designed.
- Env: dev spawn hit the known Next 16.4.3 security-nudge exit (documented in tl-4/qa-2); retry succeeded. Advisory relayed, no dependency action taken.
