# qa1-01 round-4 verdict — webkit / mobile / tablet @workers=1 (serial)

Command per project: `npx playwright test <12 union spec files> --project=<p> --workers=1 --reporter=list`
Logs: `logs/e2e-verify-webkit.log`, `logs/e2e-verify-mobile.log`, `logs/e2e-verify-tablet.log` (reruns appended).

## Per-project results

| project | tests | passed | failed | skipped | residual |
|---|---|---|---|---|---|
| webkit | 125 | 121 | 1 | 3 | auth.spec.ts login — env-class |
| mobile | 125 | 122 | 1 | 2 | page-frame @1440px — env-class |
| tablet | 125 | 122 | 1 | 2 | nav-no-splash crawl — env-class |

## Residual classification

1. **webkit** `e2e/auth.spec.ts:5` "user can log in with valid credentials" —
   `Test timeout of 30000ms exceeded` inside `e2e/users.ts:78` login retry loop.
   Class: **env-class (login-under-load)** per `logs/e2e-failure-classes.md`
   (login-failed signature). Confirming rerun appended to webkit log:
   `e2e/auth.spec.ts --project=webkit` -> **8/8 passed (20.2s)**. Recovered.

2. **mobile** `e2e/page-frame.spec.ts:181` "uniform head geometry @1440px" —
   `Test timeout of 900000ms exceeded` inside `login()` (`e2e/users.ts:78`)
   reached via `collectFrame` (`page-frame.spec.ts:134`). Class: **env-class
   (login-under-load)**. Confirming rerun appended to mobile log:
   `-g "uniform head geometry across routes @1440px"` -> **1/1 passed (1.8m)**.
   Recovered.

3. **tablet** `e2e/nav-no-splash.spec.ts:131` "client nav crawl never shows the
   boot splash" — `Test timeout of 600000ms exceeded`, `locator.click` waiting
   for `.nav a[href="/overview"]` at `nav-no-splash.spec.ts:142`. Class:
   **env-class (timeout-under-load)** — the crawl walks every route serially;
   accumulated remote-backend latency exhausted the 600s budget. Confirming
   rerun appended to tablet log: whole spec -> **2/2 passed (52.5s / 8.8s)**.
   Recovered.

## qa-1 specific signatures — resolved

- `#/aging did not rewrite to /aging` (webkit+tablet, e2e-failure-classes.md
  :122,:155): `hash-anchors.spec.ts:38` **passed on all three projects**
  (webkit 3.8s, mobile 7.9s, tablet 3.8s). Resolved post-fix.
- `toBeVisible` fails (mobile ui-shell-polish:152, tablet my-status:157-161):
  all passed in these runs. Resolved.
- a11y-keyboard, status-validation, nav-no-splash (throttled variant): all
  passed. Only residuals are the three env-class items above.

## Verdict

**GREEN** — all 3 previously-unverified projects re-run serially at
`--workers=1` against the fixed tree; every residual failure is env-class
(login/timeout under remote-Supabase load) and recovered on a single targeted
serial rerun. Zero real regressions. This closes qa-1 (criterion: browser gate).

Note: `git status --porcelain src` shows `M src/features/cx-hub/components/
admin-page.tsx` — pre-existing uncommitted change documented in
`reports/qa-1.md:18` (Toggle migration, in-scope for this task), not introduced
by this leaf. e2e/tests/playwright.config/manifests otherwise clean.
