# Fix leaves: e2e-contract-green (round 1)
Source report: `../PLAN.md` (verified debug report — root causes confirmed; do
NOT re-diagnose except where a leaf says so).
Project root: `C:\Users\AHMED\KPIs\CX-Hub`. Results dir: `../results/`.

**Environment rules (all leaves):**
- A dev server is ALREADY running on http://localhost:3000. NEVER run
  `next dev` or `next build` (dies under Windows Job-Object). Its output is
  appended to `logs/dev-server.log` — grep/tail it for `unstable value` lines.
- No new deps. No package.json/lockfile/.env*/cx-kpis-*.json edits. No commits.
- Verbatim-legacy-port codebase: closure symbol style, section-header comments.
- `dq-*` classes are documented keeps — never rename.
- Heavy command output (tsc/eslint/playwright) -> redirect to `logs/<name>.log`,
  report exit code + bounded tail only.
- Playwright reuses the existing server (`reuseExistingServer`) — just run
  `npx playwright test ...` directly.

## S01: bootstrap `Date.now()` -> `await connection()` (root fix)
Kind: mini
ID: S01
Parent: fix-plan-1
Owner: dev
Depends: none
Criteria: PLAN #1, #3 (prerender crash gone; Firefox `Error` chunk root removed)
Skills: none
Budget: files=1; actions=3; changed_lines=15; minutes=5

### Goal
`getAppBootstrap` no longer calls `Date.now()` during prerender: add
`await connection()` (from `next/server`) before the call so the value is
request-time — per `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md:101`.

### Files
- Edit: `src/features/shared/platform/bootstrap.ts` | `getAppBootstrap` body, line 16

### Context
- `src/features/shared/platform/bootstrap.ts:10-50` | the function; `Date.now()` at :16
- `src/app/layout.tsx:44-52` | RootLayout awaits `getAppBootstrap` in render
- `node_modules/next/server.d.ts:22` | `connection` is exported from `next/server`
- `logs/dev-server.log` | live dev-server output; 58 `unstable value` hits at baseline

### Contract
Return payload unchanged (serverTime/serverDate/serverAt still present).
`connection()` must run before `Date.now()`; do not move `now` into a different
scope or change the early-return shape. Out of scope: any other file, `layout.tsx`,
sweep of other sync-IO offenders (that is S02).

### Actions
1. Add `import { connection } from 'next/server'` and `await connection()` as the
   first statement of `getAppBootstrap` (before the `Promise.all`).
2. `npx tsc --noEmit` -> `logs/s01-tsc.log`, must be clean.
3. Note current `unstable value` count in `logs/dev-server.log`, then `curl`
   `/auth/login`, `/`, `/people-holidays` (follow redirects with `-L`; login
   page must be 200) and confirm the count did NOT increase and no new
   `unstable value`/`while prerendering` block appeared.

### Done when
- `tsc --noEmit` clean.
- Dev log `unstable value` count unchanged after hitting the 3 routes.
- `/auth/login` returns 200 with no error overlay.

### Verify
- Run: `grep -c "unstable value" logs/dev-server.log` before+after the curls -> equal; `npx tsc --noEmit` -> exit 0.

### Handoff
S02 sweeps for residual offenders; S06 re-runs the suite; S07 re-tightens the
allowlist entries that exist only for this crash.
Write results/S01.md (<=10 lines); TL alone updates TRACKER.md.

## S02: residual render-path sync-IO sweep
Kind: mini
ID: S02
Parent: fix-plan-1
Owner: dev
Depends: S01
Criteria: PLAN #1, #3 (zero residual prerender errors; Firefox `Error` chunk gone)
Skills: none
Budget: files=5; actions=4; changed_lines=80; minutes=10

### Goal
After S01, every route in `e2e/routes.ts` is requested once against the running
dev server and `logs/dev-server.log` shows ZERO new `unstable value|while
prerendering` hits; any residual offenders in the named files get the same
`await connection()` fix at the render-path call site.

### Files
- Edit: `src/app/auth/login/page.tsx` | render-scope sync IO ~:80-83 — only if offender confirmed in dev log
- Edit: `src/features/cx-queue/lib/pages.ts` | ~:279+ — only if offender confirmed
- Edit: `src/features/shared/components/shell/OneOnOneAlerts.tsx` | render-scope sync IO — only if offender confirmed
- Edit: `src/features/shared/components/shell/Toasts.tsx` | render-scope sync IO — only if offender confirmed
- Edit: `src/features/shared/components/shell/ui.tsx` | render-scope sync IO — only if offender confirmed

### Context
- `e2e/routes.ts` | ROUTES list to request
- `logs/dev-server.log` | append-only dev output; grep `unstable value|while prerendering`
- `src/features/shared/platform/bootstrap.ts:10-18` | the S01 `connection()` pattern to mirror
- `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md:101` | sync-IO rule

### Contract
Fix = `await connection()` (or move the call into the awaiting request-time
function body) ONLY for calls reachable during render/prerender — never inside
event handlers or client-only effects, which are already legal. If the sweep
finds an offender in ANY file not listed above (e.g. `ui/PageShell.tsx`),
do NOT edit it — record it in results and return `RESHARD_NEEDED` for those.
Out of scope: `ui/PageShell.tsx`, agents/roster/my-day pages (S03/S04), css.

### Actions
1. Record `unstable value|while prerendering` hit count + log size in
   `logs/dev-server.log`; request every path in `e2e/routes.ts` once via curl
   (`-L -s -o nul`), unauthenticated is fine — prerender runs regardless.
2. Re-grep the log tail: list each NEW offender route + symbol. For offenders
   inside the 5 named files, apply the S01 fix pattern at the call site.
3. Re-request the previously-offending routes; confirm no new hits.
4. `npx tsc --noEmit` -> `logs/s02-tsc.log` clean; spot-check
   `npx playwright test e2e/page-contract.spec.ts --project=firefox -g "people-holidays|overview"`
   -> `logs/s02-pw.log`: no bare `Error` console entries for those routes.

### Done when
- Log sweep across all ROUTES shows zero new prerender hits after fixes.
- Firefox spot-check routes show no bare `Error` console entries.
- `tsc --noEmit` clean.

### Verify
- Run: `tail -n +<startline> logs/dev-server.log | grep -c "unstable value"` -> 0 after fixes.

### Handoff
Zero-offender confirmation unblocks S07's allowlist re-tighten. Any offender in
unnamed files -> `RESHARD_NEEDED` with route+file list.
Write results/S02.md (<=10 lines); TL alone updates TRACKER.md.

## S03: /admin/roster + /my-day toolbar x-stability
Kind: mini
ID: S03
Parent: fix-plan-1
Owner: dev
Depends: none
Criteria: PLAN #2 (both routes pass contract @375+@1024)
Skills: none
Budget: files=4; actions=3; changed_lines=60; minutes=10

### Goal
Reserve the primary action button's inline size so `.page-actions` x does not
shift when its label flips: `/admin/roster` "Add user"->"Cancel" (+13px) and
`/my-day` "Book focus block"->"Booking…" (+42px) become stable.

### Files
- Edit: `src/features/cx-hub/components/admin-roster-page.tsx` | aside `.page-actions` button :95-101
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | `md-head-actions` primary button :1059-1067
- Edit: `src/app/refresh.css` | `.page-actions` rule family :25-28 (+ per-page min-inline-size rule)
- Edit: `src/app/styles/hub.css` | alternative to refresh.css — pick ONE; use only if `md-head-actions` styling already lives there

### Context
- `src/app/refresh.css:21-35` | `.page-head` space-between + `.page-actions` shrink-wrap
- `src/features/cx-hub/components/admin-roster-page.tsx:90-103` | Button label swap
- `src/features/cx-hub/components/my-day-page.tsx:1043-1084` | `md-head-actions` block
- `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | the 2 findings

### Contract
Button LABELS and click behaviour identical; only a reserved `min-inline-size`
(per-page class or modifier, e.g. `.md-head-actions` scoped rule). Do NOT set a
global `.page-actions`/`.page-head` fixed width — other pages depend on
flex-wrap. Use `--cx-*`/token-consistent values; no literal hex.
Out of scope: `/agents` y-shift (S04), `PageShell.tsx`, spec files.

### Actions
1. Add a scoped `min-inline-size` rule covering each button's widest label
   state (ch-measure the longest label; keep it near-tight, no big padding).
2. Add the per-page modifier class to the roster button (and reuse
   `md-head-actions` or a new class on my-day's button if needed).
3. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "admin-roster|my-day"`
   -> `logs/s03-pw.log`: all 4 tests (2 routes x 2 widths) pass.

### Done when
- Both routes pass page-contract @375 and @1024 (toolbar-stability check).
- No horizontal scroll introduced; button labels unchanged.
- `npx eslint` clean on touched files.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "admin-roster|my-day"` -> 4 passed.

### Handoff
Confirms the reserve-width pattern S04 may reference; refresh.css diff feeds
the UX/UI review delta.
Write results/S03.md (<=10 lines); TL alone updates TRACKER.md.

## S04: /agents @375 toolbar y-shift
Kind: mini
ID: S04
Parent: fix-plan-1
Owner: dev
Depends: none
Criteria: PLAN #2 (/agents passes contract @375+@1024; no skip-annotation)
Skills: none
Budget: files=2; actions=3; changed_lines=80; minutes=10

### Goal
Find and kill the 394px y-jump of `.page-actions` on `/agents` @375 after the
Apply click — keep the toolbar mounted/stable through the `apply()` reload.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | `apply()`/`aside`/`busy` logic :447-611
- Edit: `src/features/shared/components/ui/PageShell.tsx` | busy/aside mounting — only if root cause lands there

### Context
- `src/features/cx-people/components/agents-page.tsx:447-475` | `useSe` data + `apply()`
- `src/features/cx-people/components/agents-page.tsx:565-611` | `aside={data ? ... : null}` + `busy={!data && !error}`
- `src/app/refresh.css:21-28` | `.page-head`/`.page-actions`/status-row rules
- `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | the FINDING (y +394px @375)

### Contract
Reproduce FIRST: run the single failing test and capture DOM before/after the
Apply click (`apply()` at :468/`reload()` at :475) to identify what grows —
suspects: `aside` unmount when `data` nulls (busy skeleton replaces head),
`purpose` text swap, `[role=status]` flex-basis:100% row. Then apply the
smallest fix that keeps `.page-actions` mounted & stationary (e.g. keep last
`data`/aside rendered during reload — check how `useSe`/`reload` treats stale
data). Test must PASS for real: a skip-annotation (actions unmounted) is a
mask, not a fix. If the true fix needs a file not listed -> `RESHARD_NEEDED`.
Out of scope: roster/my-day (S03), other pages, spec files.

### Actions
1. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "agents" --trace on`
   -> `logs/s04-pw.log`; inspect the trace/DOM diff to pin the growing element.
2. Apply the stabilization in `agents-page.tsx` (and `PageShell.tsx` only if
   proven necessary).
3. Re-run the same command: `/agents` passes @375 and @1024 with no
   skip-annotation; `npx tsc --noEmit` + `npx eslint` clean on touched files.

### Done when
- `/agents` contract green at both widths, actions genuinely mounted.
- Trace evidence in `logs/` names the element that caused the 394px shift.
- tsc/eslint clean on touched files.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "agents"` -> 2 passed.

### Handoff
If `useSe` reload semantics need a shared fix beyond the two files ->
`RESHARD_NEEDED` with findings; else done.
Write results/S04.md (<=10 lines); TL alone updates TRACKER.md.

## S05: WebKit fetch "access control checks" classification
Kind: mini
ID: S05
Parent: fix-plan-1
Owner: dev
Depends: none
Criteria: PLAN #4 (written classification + fix or justified env verdict)
Skills: none
Budget: files=3; actions=4; changed_lines=60; minutes=10

### Goal
Classify the WebKit `Fetch API cannot load http://localhost:3000/… due to
access control checks` failure: capture the failing request's URL/Origin and
either fix an app bug (bounded to the named files) or document an env verdict
with a scoped allowlist entry + baseline note.

### Files
- Edit: `src/features/shared/lib/fetch-json.ts` | fetch options/URL building — app-bug path only
- Edit: `e2e/page-contract.spec.ts` | CONSOLE_ALLOWLIST :21-33, one scoped WebKit entry — env path only
- Edit: `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | WebKit verdict paragraph — env path only

### Context
- `e2e/page-contract.spec.ts:21-33` | CONSOLE_ALLOWLIST shape
- `src/features/shared/lib/fetch-json.ts` | shared fetch wrapper to inspect
- `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | baseline doc to amend
- `logs/dev-server.log` | may show the rejected request URL

### Contract
Diagnostic only until classified: instrument with `page.on('requestfailed')` /
`request` listeners or console capture to record the exact failed URL, Origin
header and referer on the diagnosed route — the odd `http: /localhost:3000`
formatting in the message is a key clue. Env verdict requires concrete evidence
(same-origin URL, correct Origin, works in chromium/ff) — not a guess; write
the scoped allowlist entry as narrow as possible (WebKit-only text). App bug
beyond `fetch-json.ts` (e.g. a caller building a bad URL) -> `RESHARD_NEEDED`.
Out of scope: other spec files, playwright.config, timeouts (S06).

### Actions
1. `npx playwright test e2e/page-contract.spec.ts --project=webkit -g "people-holidays"`
   -> `logs/s05-pw.log` with a temporary `requestfailed`/console listener to
   dump failing URL + origin (listener may live in the spec only as a
   committed narrow allowlist afterwards — keep instrumentation out of the
   final diff).
2. Decide env vs app bug from the captured evidence; write the verdict in
   `results/S05.md`.
3. Apply the matching path: fix `fetch-json.ts` OR add the scoped allowlist
   entry + baseline paragraph.
4. Re-run the same webkit `-g` command: failure gone (fix) or still present
   but documented (env).

### Done when
- Written classification with captured URL/Origin evidence in results/S05.md.
- Either a fix landing, or a justified narrow allowlist entry + baseline note.
- tsc/eslint clean on touched files.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=webkit -g "people-holidays"` -> verdict reflected in output.

### Handoff
Verdict feeds S07's baseline refresh; allowlist entry must survive S07's
re-tighten only if it is NOT one of the two prerender-crash entries.
Write results/S05.md (<=10 lines); TL alone updates TRACKER.md.

## S06: env-timeout hardening
Kind: mini
ID: S06
Parent: fix-plan-1
Owner: test-engineer
Depends: S01
Criteria: PLAN #5 (timeout count <= baseline flakes, or documented why)
Skills: none
Budget: files=4; actions=4; changed_lines=60; minutes=10

### Goal
After S01 lands, cut the parallel-load `page.goto`/networkidle/login timeouts
(`/scheduler`, `/status-validation`, `/tl-*`, `/tph*`, `/trackers`) to <=3 per
full chromium run via a test-side fix — or document why the residual stands.
KNOWN PRIMARY SUSPECT (TL triage, verified 2026-11-16): `login()` in
`e2e/users.ts` runs a 4-attempt retry loop where ONE attempt can take ~25s
(goto + sticky fills + 12s POST wait + 8s URL wait + backoff), but
`test.setTimeout(45000)` lets only ~1.5 attempts fit — any session-check
bounce = test death before retry 3. API login itself is healthy (curl POST
/api/auth/login = 200/~3s; GET / = 200/~3s). Widen the budget: bigger
`test.setTimeout` for auth-gated routes and/or leaner per-attempt waits.

### Files
- Edit: `e2e/page-contract.spec.ts` | per-route `test.setTimeout` / tagging :84 area
- Edit: `e2e/users.ts` | `login()` :41-70 retry/wait budget — only if needed for the timeout budget
- Edit: `playwright.config.ts` | retries/timeout for this spec only — only if needed, no global restructure
- Edit: `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | residual-timeout note

### Context
- `e2e/page-contract.spec.ts:80-100` | test loop + `test.setTimeout(45000)` at :84
- `e2e/users.ts:41-70` | `login()` 4-attempt loop, 12s/8s internal waits
- `playwright.config.ts:1-25` | timeout:30000, fullyParallel, retries CI-only
- `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | the 11 timeout rows

### Contract
Prefer test-side levers IN THIS ORDER: (a) higher `test.setTimeout` for the
remote-auth/slow-data routes, (b) a tagged serial group (`fullyParallel`
overrides or `test.describe.configure({ mode: 'serial' })`) for the worst
routes, (c) `retries: 1` scoped to this spec via a project/config clause.
Do NOT touch app code, do not rewrite the config — a bigger change ->
`RESHARD_NEEDED`. First check whether the failing routes share a slow server
data path (`/tph*` heavy compute); note findings in results.
Out of scope: app source, other spec files, webkit/firefox projects.

### Actions
1. `npx playwright test e2e/page-contract.spec.ts --project=chromium`
   -> `logs/s06-run1.log`; count timeout-class failures vs baseline's 11.
2. If >3 timeouts: apply the lightest lever(s) on the named routes only.
3. Re-run -> `logs/s06-run2.log`; every residual timeout must be retry-clean
   on a second run or get a baseline note explaining why.
4. Record final counts + lever used in results and the baseline doc.

### Done when
- Full chromium run: timeout count <=3, residual retry-clean or documented.
- No app-code changes; config diff minimal (if any).
- Spec still self-contained; other projects unaffected.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium` -> timeout fails <=3.

### Handoff
Final pass/fail numbers + residual list feed S07's baseline refresh.
Write results/S06.md (<=10 lines); TL alone updates TRACKER.md.

## S07: housekeeping + allowlist re-tighten + baseline refresh
Kind: mini
ID: S07
Parent: fix-plan-1
Owner: dev
Depends: S01, S02, S05, S06
Criteria: PLAN #6 (nul gone; allowlist re-tightened; baseline refreshed)
Skills: none
Budget: files=2; actions=4; changed_lines=80; minutes=10

### Goal
Delete the stray `nul` file, re-tighten the two prerender-crash
CONSOLE_ALLOWLIST entries now that S01/S02 cleared the root cause, and refresh
`page-contract-baseline.md` with the new run numbers.

### Files
- Edit: `e2e/page-contract.spec.ts` | CONSOLE_ALLOWLIST :26-32 — remove or narrow the two crash entries
- Edit: `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | new run numbers + closed findings

### Context
- `e2e/page-contract.spec.ts:21-33` | allowlist incl. the TODO at :31-32
- `specs/e2e-contract-green/results/` | S01/S02/S05/S06 evidence to cite
- `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | doc to refresh

### Contract
The `/unstable value `Date\.now\(\)` while prerendering/` entry and the
500-status entry exist ONLY for this crash — remove both (keep S05's narrow
WebKit entry if env-verdicted). Real 500s must surface again. Baseline update
records: fixed findings (roster/my-day/agents), S05 verdict, residual timeouts.
Deleting the stray `nul` file is action 1 (a deletion, not an edited file).
Out of scope: any other file, app code, spec logic beyond the allowlist.

### Actions
1. Delete `nul`: `powershell -c "Remove-Item '\\?\C:\Users\AHMED\KPIs\CX-Hub\nul'"`
   (or `rm '\\?\C:\Users\AHMED\KPIs\CX-Hub\nul'`); confirm `git status` clean of it.
2. Remove the two prerender-crash allowlist regexes; keep unrelated entries
   (incl. S05's WebKit one).
3. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "admin-roster|my-day|agents|people-holidays|overview|quality-analytics"`
   -> `logs/s07-pw.log`: green — proves no masked crash/500 returned on the
   key routes. (The full 82-test run already ran at TL gate:
   logs/tl-full-chromium2.log — 69 pass / 13 env-only fails, 0 prerender or
   Dropped-segment errors in live logs/dev-server.log.)
4. Rewrite the baseline doc sections for this plan with final numbers + verdicts.

### Done when
- `git status` shows no `nul`; allowlist diff removes exactly the 2 crash entries.
- Chromium contract run still green (or only documented residuals remain).
- Baseline doc reflects final numbers.

### Verify
- Run: `git status --short | grep -c "nul"` -> 0; chromium run green.

### Handoff
Final baseline is the QA reviewer's DELTA reference.
Write results/S07.md (<=10 lines); TL alone updates TRACKER.md.

## S08: `instant-unrendered-segment` noise — global validation opt-out
Kind: mini
ID: S08
Parent: fix-plan-1
Owner: dev
Depends: S01
Criteria: PLAN #2 (no new console-error failures vs baseline)
Skills: none
Budget: files=2; actions=3; changed_lines=20; minutes=5

### Goal
Stop the dev-mode `instant-unrendered-segment` / "Dropped segment" console
error that S01's `await connection()` unmasked on every route (~30 test
failures in logs/s06-run2.log): opt the app out of automatic instant-nav
validation, since every route is session-gated and cannot be instant.

### Files
- Edit: `next.config.ts` | `experimental.instantInsights.validationLevel: 'manual-warning'` next to `cacheComponents: true` (:5 area)
- Edit: `src/features/shared/platform/bootstrap.ts` | keep `await connection()` — revert only if a smaller fix proves better

### Context
- `next.config.ts:1-15` | `cacheComponents: true` already set
- `src/app/layout.tsx:18` | `export const instant = false` ALREADY on root layout — covers only the static-shell check, page segments still validate
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md:103-124` | `instantInsights.validationLevel` semantics: 'manual-warning' validates only segments exporting `instant`
- `logs/s06-run2.log` | "Dropped segment: src/app/<route>/page.tsx" errors with [render]/[ignore] fix hints

### Contract
Mechanism (verified by TL against Next docs): dev validates every Page/Default
segment for instant navigation; the pre-S01 Date.now() crash short-circuited
it. With the crash fixed, each session-gated page (all do `requireRole`/
dynamic awaits, none can render instantly) is reported as a "Dropped segment".
Per-segment `instant = false` would need ~40 page files — instead set
`experimental.instantInsights.validationLevel: 'manual-warning'` in
next.config.ts so only segments that explicitly export `instant` validate
(none do). This is the docs-sanctioned opt-out, NOT an allowlist mask — flag
the config change in results for reviewer visibility. Do NOT touch
playwright.config or add CONSOLE_ALLOWLIST entries for this error.
Out of scope: Suspense/PPR refactors, page.tsx files, spec files.

### Actions
1. Add `instantInsights: { validationLevel: 'manual-warning' }` under
   `experimental` in `next.config.ts` (merge with existing keys; keep
   `cacheComponents: true`).
2. Light-verify against the running dev server (it is wedged under
   concurrency but serves single requests ~1.4s): curl ONE heavy page doc
   (`/` then `/people-holidays`) — and if feasible one single playwright
   `page.goto` with a console listener — confirm no
   `instant-unrendered-segment`/`Dropped segment` text in the response or
   console. Note: dev server may need restart for config change to apply —
   if the error persists after the config edit AND a hot-reload settle,
   record "pending server restart" in results instead of forcing it.
3. `npx tsc --noEmit` -> `logs/s08-tsc.log`; report per-route evidence.

### Done when
- `manual-warning` set; no `Dropped segment` evidence on the probed routes
  (or explicitly recorded as pending a dev-server restart).
- tsc/eslint clean; S01's `connection()` retained.

### Verify
- Run: `grep -c "instant-unrendered-segment" logs/s08-*.log` -> 0 on probed routes.

### Handoff
If config proves insufficient (segments still flagged), return
`RESHARD_NEEDED` naming the still-flagged segment files — do NOT hand-add
`instant = false` to pages. Reviewer note: this trades a dev-only validation
for silence; production behaviour unchanged.
Write results/S08.md (<=10 lines); TL alone updates TRACKER.md.
