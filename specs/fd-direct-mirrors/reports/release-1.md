# release report - fd-direct-mirrors - 1 (DEPLOY, production)

Verdict: PASS (app live; drop-cols migration pending auto-apply at last check — mechanism expected, runtime unaffected)
Deployment: https://dabdoob-cx-productivity-761xfn8ok-ismails-projects-f1e5c1e6.vercel.app · dpl_573a25bWszG5mNas5wsdsNgEqwEP · ● Ready @ ~16:09 UTC 2026-11-13
Previous good: dpl n3da4hfh0 (● Ready, 5d) — rollback target.

## Scope committed (grant #7)
- `c2126c5` — 93 files: src mirror writers/readers + adapters, tests, 5 migrations
  (…150304, …150305, …150724, …150725, …20261113115521 drop-cols), specs/fd-direct-mirrors/**.
- `64a6895` — fix-forward: repoint tests/jobs/mirror-cells.test.ts off gitignored
  migration/ script (see build-1 failure).
- Pushed `HEAD:main` (was 32 ahead / 0 behind origin/main) — both commits on main.
- Excluded foreign/baseline: docs/PERF_BASELINE.md, results/qa1-0{1,3,4}.md deletions
  (foreign cx-people results, not this spec), specs/ui-shell-polish PNGs,
  docs/Reference_Code.gs, specs/headcount-access-split/**, root results/*.md
  scratch (qa-5 deferred; S00-02/S01-02/S03-01 moved into spec results/). No .env*/secrets.

## CHECK (pre-flight)
- Gates (ran, not trusted): `npx tsc --noEmit` exit 0; `npx vitest run` 95 files /
  1355 tests ALL PASS; `npx eslint` (16 touched files) exit 0. Post-fix re-run:
  tsc 0, eslint 0, mirror-cells.test 6/6.
- Env names vs `vercel env ls production`: FRESHDESK_API_KEY/FRESHDESK_DOMAIN,
  FRESHCHAT_*, MAQSAM_*, SUPABASE_*, GOOGLE_* all present; no new vars needed.
- DB: 4 spec migrations confirmed applied (results/remote-migrations.md);
  pending = 20261113115521 only (expected; named in grant #7). Supabase CLI
  needs the IDE-injected SUPABASE_ACCESS_TOKEN (`env -u` variant 403s — opposite
  of old caveat; read-only queries need --read-only in agent mode).
- Tree: feat/cx-hub-ui-redesign, ff-able to main. No `select('cols')` left in src
  (grep clean; tlqueue `r.cols` reads are adapter-synthesized, not DB selects).

## Steps
- push c2126c5 -> build j328r2fng -> **ERROR** (1m57s): `tests/jobs/mirror-cells.test.ts(9,39)
  TS2307 Cannot find module '../../migration/backfill-mirror-columns'` — file exists
  locally (gitignored) so local tsc/build passed; Vercel typecheck failed.
- fix 64a6895 (test now asserts shipped adapter contract in src mirror-cells.ts)
  -> push -> build 761xfn8ok -> **READY** (compile 61s, typecheck clean).
- Local `next build` also verified green end-to-end before the fix push.

## Smoke (prod domain behind Vercel Deployment Protection; `vercel curl` bypass)
- `/` -> 307 -> auth login (correct unauth redirect)
- `/auth/login` -> 200 real HTML (boot-splash markup)
- `/api/health` -> app-guarded `{"error":"Unauthorized"}` (route executes)
- Public `curl` returns protection interstitial — expected, not an app failure.

## Logs
- `vercel logs` (15:41-16:11 UTC window): 3 runtime records, no errors; traffic
  minimal at deploy time. Crons next fire 06:30 UTC 2026-11-14
  (job-productivity-daily) — new API-direct + floor code is live well ahead of it.

## Migrations
- Applied pre-deploy (grant #1): 20261112150304, …150305, …150724, …150725.
- 20261113115521 (DROP cols x3): committed to main; `migration list --remote`
  showed remote `-` (pending) through 16:29 UTC (polled ~22min post-push) — Supabase GitHub integration expected
  to auto-apply (established repo path, per AGENTS.md/grant #7). Runtime safe
  either way: no code path reads or writes `cols` since S05-03. Verify later:
  `npx supabase migration list --remote` (with token; check last row local=remote).

## Rollback
- `vercel rollback` to previous good dpl n3da4hfh0 if runtime issues appear.
- DB migrations never auto-revert; if cols drop proves problematic, forward-fix
  migration to re-add (data is typed; re-derivable).

## Needs approval
- none. (Concurrent ops1-03 resume activity observed in-tree post-commit —
  TRACKER.md/ops1-03-resume.log modifications + results/ops1-03.md are another
  agent's live work, left untouched.)

## Notes
- Stated deadline 06:30 UTC 2026-11-13 had passed when this task ran (~15:56 UTC);
  deploy landed ~16:09 UTC — next writer cron is 2026-11-14 06:30 UTC, ~14h margin.
- First prod build error was a repo-hygiene gap (test importing gitignored ops
  script); fix keeps identical coverage on the shipped adapter.
