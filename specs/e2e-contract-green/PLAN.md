# PLAN: e2e-contract-green
Type: bug-fix   Status: draft (for a new PM agent to implement)
Date: 2026-11-16   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Make `e2e/page-contract.spec.ts` green: eliminate the `Date.now()` prerender
crash that fires on every route, fix the three remaining toolbar-stability
findings, resolve or classify the WebKit fetch failures, and de-flake the
env-class timeouts. Update the baseline doc and allowlist afterwards.

## Evidence (chromium re-run on current main, 82 tests, 4 workers)
68 pass / 14 fail. Baseline: `specs/ux-ui-audit-v3/results/page-contract-baseline.md`.

**Still failing — real findings:**
- `/admin/roster @1024` — `.page-actions` x moved **12.97px** (baseline FINDING)
- `/agents @375` — `.page-actions` y moved **394px** (baseline FINDING)
- `/my-day @1024` — `.page-actions` x moved **41.95px** (intermittent in baseline)

**Still failing — env/timeouts (11):**
`/scheduler`×2, `/status-validation`×2, `/tl-performance @1024`, `/tl-tasks`×2,
`/tph @1024`, `/tph-grid`×2, `/trackers @375` — all `page.goto`/`networkidle`
or login timeouts under parallel load.

**Cross-browser (5-project run earlier):** Firefox fails every route with bare
console `Error` entries = the same `Date.now()` prerender crash relayed via the
RSC error chunk (chromium's allowlist regex covers it; the Firefox message text
doesn't match). WebKit fails with `Fetch API cannot load http://localhost:3000/…
due to access control checks` + timeouts. Mobile/tablet = login/networkidle
timeouts.

## Root causes (verified)
1. **`getAppBootstrap` calls `Date.now()` during prerender** —
   `src/features/shared/platform/bootstrap.ts:16`, reached from `RootLayout`
   (`src/app/layout.tsx:47`). Next.js docs
   (`node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md:101`)
   state sync IO (`Date.now()`, `new Date()`, `Math.random()`,
   `crypto.randomUUID()`) during prerender is a **build error that
   `instant = false` does NOT clear** — fix is `await connection()` before the
   call (or `<Suspense>` / client component). This is the systemic root: the
   RSC 500s, the Firefox generic `Error` console entries, most of the
   dev-server log noise, and likely a chunk of the timeout slowness.
2. **`.page-actions` origin moves when the primary button changes size** —
   `.page-head{display:flex;justify-content:space-between}` +
   `.page-actions{display:flex;flex-wrap:wrap}` (refresh.css:21-27). The box
   shrink-wraps its content and hugs the right edge; any label/width change
   on click shifts the measured x. `/admin/roster`: "Add user"→"Cancel"
   (admin-roster-page.tsx:96-101) shrinks the box → x+13px. `/my-day`:
   "Book focus block"→"Booking…" (my-day-page.tsx:1060-1067) → x+42px.
   `/agents @375`: y+394px = a reflow after `apply(from,to)` (agents-page.tsx:596)
   — the head first-child (`purpose` text/`busy` skeleton) or a
   `[role=status]`/`flex-basis:100%` row pushes the aside down; needs
   reproduction to pin the exact element.
3. **WebKit "access control checks"** — fetch to same-origin `/api/*` rejected
   inside Playwright WebKit. Logged URL shows `http: /localhost:3000` (odd
   formatting). Likely env-class (WebKit localhost heuristics vs dev server),
   but unproven — needs one diagnostic run, not a blind allowlist.
4. **Timeouts** — dev server serving prerender-crash 500s on every route +
   remote Supabase login under parallel workers. Expect most to clear once #1
   lands; keep a hardening shard for the residual.
5. **Stray `nul` file** at repo root (Windows device-name slip from a
   `> nul` redirect) — delete via `\\?\` path form.

## Success criteria
1. Dev server log shows zero `unstable value 'Date.now()' while prerendering`
   on any route; `npm run build` does not hit the blocking-prerender error.
2. page-contract chromium: `/admin/roster`, `/agents`, `/my-day` pass at both
   widths; no new failures vs the 68-pass baseline.
3. Firefox route failures caused by the RSC `Error` chunk are gone (spot-check
   `--project=firefox` on ~5 routes incl. `/people-holidays`, `/`).
4. WebKit root cause classified (app bug fixed, or env finding documented in
   the baseline + a justified allowlist entry).
5. Chromium timeout count ≤ baseline env flakes; if not, the hardening shard
   documents why.
6. `nul` gone; `page-contract-baseline.md` refreshed; CONSOLE_ALLOWLIST
   re-tightened per its own TODO (line 31-32).
7. `npx tsc --noEmit` clean; `npx eslint` clean on touched files.

## Scope / Non-goals
In: bootstrap.ts; the three toolbar-shift pages (+ their page-head CSS if
needed); e2e spec allowlist/baseline doc; stray `nul`.
Out: no visual redesigns; no playwright.config restructure beyond what's a
shard's acceptance check needs; other specs' in-flight work; production deploy.

## Risk flags (y/n)
arch n · db n · data n · auth n · external-api n · ui y · perf n · deps n
· tests y · docs y · deploy n
Review gates: QA (always) · UX/UI: run on S03/S04 · Security: skip · Data: skip

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`
unit: `npx vitest run`
contract: `npx playwright test e2e/page-contract.spec.ts --project=chromium`
contract-full: `npx playwright test e2e/page-contract.spec.ts`
Prereq: `node e2e/seed-users.mjs` must have run once (real Supabase auth users).

## Conventions (<=10 lines)
- Verbatim-legacy-port codebase: closure symbol style; section-header comments.
- Forbidden: package.json/lockfile, .env*, cx-kpis-*.json. No new deps.
- dq-* classes (dq-editor/dq-holform/dq-days) are documented keeps — never rename.
- Tree has in-flight streams; stage ONLY a shard's own files when committing.
- Heavy gate output → log file + bounded tail; don't cat logs.
- Do not commit/push unless the user asks.

## Shards

### S01 — bootstrap Date.now → `connection()` (root shard; everything depends)
Files: `src/features/shared/platform/bootstrap.ts` (+ maybe `src/app/layout.tsx`).
In `getAppBootstrap`, add `await connection()` (from `next/server`) before
`const now = Date.now()` at line 16 — per Next docs this marks the value
request-time so the prerender validator accepts it. Verify `connection` is
exported (`node_modules/next/server.d.ts` already confirmed).
Checks:
- `tsc --noEmit` clean.
- `next dev` + `curl`/browse 3 routes (/ , /people-holidays, /auth/login) →
  zero `unstable value` lines in server output.
- `bootstrap` still returns serverTime/serverDate/serverAt (unchanged payload).

### S02 — residual render-path sync-IO sweep (after S01)
Diagnostic+fix: with S01 landed, `next dev` hit every route once (script loop
over `e2e/routes.ts` paths is fine) and grep server output for
`unstable value|while prerendering`. Any residual offenders → same
`connection()` fix at the call site (or move into the awaiting function body).
Prime suspects to grep first (server-render reachability, not event handlers):
`src/app/auth/login/page.tsx:80,83`, `src/features/cx-queue/lib/pages.ts:279+`,
`src/features/shared/components/shell/*` `new Date(`/`Math.random(`/
`crypto.randomUUID(`/`Date.now(` in render scope.
Checks: dev-log sweep = 0 hits; page-contract firefox spot-check (5 routes)
shows no bare `Error` console entries.

### S03 — /admin/roster + /my-day toolbar x-stability (parallel w/ S04)
Root: shrink-wrap `.page-actions` in `space-between` header; primary button
label swap resizes the box → x shifts.
Fix approach (pick lightest that works): give the primary Button a
`min-inline-size` covering its widest label state — e.g. a per-page class
(`.roster-actions__toggle`, `.md-book` exists? verify) or shared
`.page-actions__primary{min-inline-size:X}`. Do NOT change `.page-actions` to
fixed widths globally — other pages' skip/logic depends on flex-wrap.
Files: `admin-roster-page.tsx`, `my-day-page.tsx`, `refresh.css` (or hub.css
md-head-actions). Buttons' *labels stay identical*; only width reserved.
Checks: page-contract chromium both routes @375+@1024 pass; visual: header
buttons don't jump on click.

### S04 — /agents @375 toolbar y-shift (parallel w/ S03)
Reproduce first: run just `/agents` contract @375 with a trace/screenshot on
`--project=chromium -g agents`; capture DOM before/after the Apply click to
find what grows (suspects: `purpose` text swap via `data` reload, `[role=status]`
flex-basis row inside `.page-actions`, busy skeleton height, Seg wrap).
Then stabilize: likely keep `purpose`/aside mounted during `apply()` reload
(don't null `data` → remount bounce), or bound the reflowing element.
Files: `agents-page.tsx` (apply()/aside/`busy` logic ~:560-611), possibly
`PageShell.tsx` busy handling.
Checks: `/agents` contract @375+@1024 pass on chromium; no skip-annotation
(which would mean actions unmounted — mask, not fix).

### S05 — WebKit fetch "access control checks" classification (independent)
Diagnostic only until classified: run
`npx playwright test e2e/page-contract.spec.ts --project=webkit -g "people-holidays"`;
capture the failed request's URL/Origin/referer (page.on('requestfailed')).
If env (WebKit localhost quirk): document in baseline + add a scoped allowlist
entry. If app bug (malformed URL/`credentials`/`mode` on fetch): fix in
`src/features/shared/lib/fetch-json.ts` or the caller.
Checks: written classification in `results/` + either fix or documented env
verdict; webkit spot-run on the diagnosed route reflects it.

### S06 — env-timeout hardening (after S01; may shrink to docs)
Re-run `--project=chromium`. If timeouts persist beyond baseline flakes:
raise the 45s `test.setTimeout` for remote-auth routes or serialize the worst
offenders (`/tph*`, `/scheduler`, `/status-validation`, `/tl-*`, `/trackers`)
— check whether these routes share slow server data paths first (tph pages =
heavy compute). Prefer a test-side fix (retries/workers/`fullyParallel:false`
for a tagged group) over touching app code.
Checks: full chromium run timeout count ≤ 3 and all are retry-clean on a
second run; documented residual in baseline.

### S07 — housekeeping + allowlist re-tighten (last)
- Delete stray `nul` (Windows: `Remove-Item '\\?\C:\Users\AHMED\KPIs\CX-Hub\nul'`).
- `e2e/page-contract.spec.ts:29-32`: after S01 lands, re-tighten the two
  prerender/500 allowlist entries (they exist only for this crash — remove or
  narrow) so real 500s surface again.
- Refresh `specs/ux-ui-audit-v3/results/page-contract-baseline.md` with the
  new run numbers.
Checks: `git status` clean of `nul`; contract run still green on chromium.

## Order
S01 → (S02, S03, S04, S05 parallel) → S06 → S07.
TL gates after each shard: tsc + targeted contract grep for the shard's routes.
