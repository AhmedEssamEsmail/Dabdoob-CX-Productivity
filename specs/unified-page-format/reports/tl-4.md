# tl-4 — FIX round for reports/qa-1.md (continuation — prior TL died mid-round)

## Scope
Fix spec `spec/fix-qa-1.md`, leaves qa1-01..qa1-04 (all `Kind: mini`, preflight PASS per TRACKER). Prior TL dispatched all four, received results, died before verifying/merging. This round: verified result diffs against leaf contracts, merged statuses, ran integration gates. No new shards needed — all results were complete and in-scope.

## Verified results
| Leaf | Files changed | Verification |
|---|---|---|
| qa1-01 (qa-1: /meetings +52.8px, /tl-tasks +8.3px toolbar shift) | `meetings-page.tsx` (minInlineSize '14rem' on actions primary), `tl-tasks-page.tsx` ('10rem') | Diff confirmed; no QUIRKS/routes.ts touch; worker: contract -g 4/4 pass ±1px |
| qa1-02 (qa-1 mutating/unmount primaries + qa-2 `/` console-500) | `e2e/routes.ts` (+4 QUIRKS.skipToolbar: `/`, `/audit-queue`, `/people-holidays`, `/qa-forms`, notes in existing style) | Diff confirmed; `/` note cites mutating POST /api/hub/my-day (MyDayPage in place); `/` 500 cleared at both widths per result + gate |
| qa1-03 (qa-3 dead CSS) | `styles/queue.css` (deleted `.hm-head-actions` L~17, `.sch-controls` L~152) | grep count 0; css-form-guards green |
| qa1-04 (qa-4 reduced-motion scope) | `refresh.css` (guard rescoped: `:root .spinner` inside media query + `:root[data-reduce-motion] .spinner`) | Diff confirmed; container-agnostic |

qa-5 (LOW, `/` date eyebrow) — deferred, already recorded; needs PM decision + a non-h1-shifting slot if it must return.

## Integration gates (qa1-fix round)
- `npx vitest run` — **PASS** 114 files / 1471 tests
- `npx eslint .` — exit 1, **identical pre-existing baseline** (1 error tests/golden `any` @123 + 6 warnings, all out-of-scope; zero in qa1 files)
- `npx playwright test e2e/page-contract.spec.ts e2e/page-frame.spec.ts --project=chromium` — 81 passed / 4 failed (5.7m); all 4 were cold-dev-server flakes (2× remote-auth login timeout on /qa-forms @1024 + /quality-scores @1024; 2× /quality-analytics aria-busy stuck >15s on a cold server). Isolated warm rerun `--workers=2`: **6/6 PASS (48.4s)** → effective 85/85 green. page-frame 3/3 PASS. All qa-1 routes pass; `/` console-500 gone.
- `npx tsc --noEmit` — **PASS exit 0**. First run failed on `.next/dev/types/validator.ts` (`AppRoutes = never`): the PM-owned dev server was already dead at round start and had left an empty typegen placeholder; the e2e run's Playwright-spawned dev server repopulated `.next/dev/types/routes.d.ts` (1.4 KB → 9.5 KB) and tsc went clean. Not a code defect.

## Environment notes for PM
- The task's "dev server already running at :3000" was stale — no listener at round start. Playwright's configured `webServer` (reuseExistingServer) spawned and tore down `npm run dev` twice; one spawn died on the Next 16.4.3 security-upgrade nudge (exit 1, "retry the same command"), retry passed. If PM wants a persistent dev server it needs a manual restart.
- Relayed per the CLI's request: **npm reports a known security vulnerability in installed Next.js 16.4.3** (registry advisory bulk). No dependency action taken — needs maintainer + user approval.

## Reviewer DELTA scope
Files changed this round: `meetings-page.tsx`, `tl-tasks-page.tsx` (min-inline-size styles), `e2e/routes.ts` (QUIRKS +4), `styles/queue.css` (−2 dead rules), `refresh.css` (spinner motion-guard selectors). Evidence: `results/qa1-0{1,2,3,4}.md`, logs `gate-{vitest,eslint,e2e,e2e-rerun,tsc}-qa1*.log`.

No shards requested forbidden reviewers; none spawned. No commits/pushes.
