# tl report — ui-shell-polish — round 3 (FIX qa-1)

Input: `reports/qa-1.md` (verdict FAIL, 4 findings — task routed all 4 as
blocking; report tags qa-3/qa-4 LOW). Fix spec: `fix-qa-1.md` (leaves
qa1-01…qa1-04, all preflight PASS). All 4 leaves done; no needs-split, no
blocked, no retries needed.

## Changed files (DELTA scope for re-review)

| Leaf | Files | Change |
|---|---|---|
| qa1-01 (dev) | `src/app/auth/login/page.tsx` | navWatch stop branch now distinguishes navigated vs 15s-timeout: timeout-while-still-on-`/auth/login` dismisses overlay + `setError('Sign-in timed out — try again.')` + `setLoading(false)`; navigated path unchanged (qa-1 fixed — no more dead-end "Signing in…") |
| qa1-02 (test-engineer) | `e2e/ui-shell-polish.spec.ts` | item1: per-column `tdLeft!==null && |thLeft−tdLeft|<=1` assert (6-col guard + col name in message); item3: asserts `samples.some(url==='/auth/login' && busy)` + `dead.length===0` — post-nav `.spinner` locator race removed (qa-2 fixed) |
| qa1-03 (dev) | `src/features/shared/components/shell/AppShell.tsx` | `navigate` adds `window.setTimeout(() => setPendingHref(h => h === href ? null : h), 8000)` — silent nav no-op self-clears `data-pending`/`aria-busy` (qa-3 fixed) |
| qa1-04 (dev) | `.gitignore`, `nul`, `logs/` | `nul` + 3 stale gate logs deleted; `/logs/` added to `.gitignore`; live `logs/dev-server.log` kept (qa-4 fixed) |

Owner results: `results/qa1-01.md` … `results/qa1-04.md` (all PASS, no blockers).

## Integration gates (run after all writers finished)

| Gate | Command | Result |
|---|---|---|
| tsc | `npx tsc --noEmit` | exit 0 |
| eslint | `npx eslint src/app/auth/login/page.tsx src/features/shared/components/shell/AppShell.tsx e2e/ui-shell-polish.spec.ts .gitignore` | exit 0 (1 ignore-warning: .gitignore has no config) |
| vitest | `npx vitest run` | 85/86 files, 1295/1299 — only foreign `tests/perf/audit-queue-memo.test.tsx` ×4 (TableScroll mock; untouched by this round, same as int-1 + qa-1) |
| polish e2e | `npx playwright test e2e/ui-shell-polish.spec.ts` | 27/30 first pass → fails: firefox item1/item2, mobile item2 (30s data-render waits while in-page probes returned 200 — shell rendered, content late) → rerun `-g "item1\|item2" --project=firefox --project=mobile --workers=1`: **4/4 PASS** → env flake of the documented firefox/mobile class (dev-server + Supabase-auth load under 5 concurrent projects), not a diff regression |

Evidence: `logs/qa1-gate-tsc.log`, `qa1-gate-eslint.log`, `qa1-gate-vitest.log`,
`qa1-gate-e2e.log`, `qa1-gate-e2e-rerun.log`.

## Notes for the reviewer

- DELTA = the 4 files/rows above only. Round-1 changes (quality.css, cx-kit.css,
  refresh.css, admin-page.tsx, earlier AppShell + login regions) were already
  reviewed in qa-1 and are untouched this round — the cumulative working-tree
  diff shows both rounds.
- None of the 4 fixes alters behaviour exercised before the failing locators:
  qa1-01 runs only inside login's post-submit watch; qa1-03 only inside
  `navigate` clicks (item4 only — passed on all projects); qa1-02 edits sit
  after the locators that failed. The 3 first-pass e2e failures are therefore
  attributed to the documented env flake class; serial rerun passed 4/4 with
  fresh evidence (`item2 overlaps: []`, item1 alignment thLeft===tdLeft).
- New honest assertion in item3 relies on samples collected while the URL is
  still `/auth/login`; with the qa1-01 timeout path the overlay now also
  resolves at 15s — both branches satisfy the assertion's intent.
- No findings requested a reviewer/debugger/architect role; nothing ignored.
- `results/qa1-04.md` also appears as ` M results/qa1-04.md` at repo root in
  `git status` — that is a DIFFERENT pre-existing tracked file (foreign
  baseline, from another task); the leaf's file is
  `specs/ui-shell-polish/results/qa1-04.md`.

## Outstanding / blocked

- None from this round. Pre-existing foreign items unchanged: vitest
  `audit-queue-memo` mock gap; page-contract env noise; `/admin/roster` toolbar-x
  baseline. `e2e/ui-shell-polish.spec.ts` remains untracked (new file from
  round 1 — expected).
