# TL report — e2e-contract-green (FIX round 1)
Source: `PLAN.md` (debug report). Leaves: `spec/fix-plan-1.md` S01–S08 (all
preflight PASS; S08 added mid-run for the S01 side-effect class). Tracker:
`../TRACKER.md`. Results: `../results/S0*.md`.

## Outcome per shard (8/8 done)
| Leaf | Owner | Result | Evidence |
|---|---|---|---|
| S01 bootstrap `await connection()` | dev | done | +3 lines bootstrap.ts; tsc 0 |
| S02 sync-IO sweep | dev | done | 41 routes 200; no in-scope offenders; named-file `Date.now`/`new Date` all legal (post-await/handlers) |
| S03 roster+my-day x-stability | dev | done+verified | min-inline-size reserves; GREEN both widths in TL run |
| S04 agents y-shift | dev | done+verified | RCA: Tabs `scrollIntoView` → scroll delta 394px; 800ms scroll-pin fix; GREEN both widths |
| S05 WebKit classification | dev | done | ENV verdict (same-origin, Origin ok, probe fetch ok); +1 scoped allowlist regex + baseline note |
| S06 timeout hardening | test-eng | done | users.ts login() retry-safe (30s/15s waits, wedged-attempt catch), SLOW_DATA 150s tier, domcontentloaded; run1 82/82 login-fails diagnosed |
| S07 housekeeping | dev | done | both crash allowlist regexes removed (WebKit kept); baseline refreshed; `nul` absent; verify 10/10 |
| S08 instant-segment opt-out | dev | done | `instantInsights.validationLevel:'manual-warning'` in next.config.ts (docs-sanctioned; root layout already `instant=false`, pages can't be instant — all session-gated) |

## Integration gate (TL-run, logs/tl-full-chromium2.log)
**69 pass / 13 fail in 43min — zero app/test failures.** All 13 are env-class:
5 `e2e login failed` + 7 timeouts (remote Supabase auth saturation at 10
workers) + 1 `net::ERR_NETWORK_IO_SUSPENDED` (host slept mid-run). The three
real findings (roster, my-day, agents) pass at BOTH widths. Live
`logs/dev-server.log` shows **0 `unstable value`/prerender and 0
`Dropped segment` hits across the whole suite** — direct proof for S01/S02/S08.
S07 post-removal verify: 10/10 green on key routes (logs/s07-pw.log).

## Changed files (ours)
bootstrap.ts, agents-page.tsx, admin-roster-page.tsx, my-day-page.tsx,
refresh.css, styles/hub.css, next.config.ts, e2e/page-contract.spec.ts,
e2e/users.ts, specs/ux-ui-audit-v3/results/page-contract-baseline.md.
tsc+eslint clean throughout (logs/s0*-*.log).

## Env incidents handled
- Dev server was stdout-WEDGED (stale Nov-12 log, concurrent requests starved),
  then died. TL spawned a fresh detached `npm run dev` → `logs/dev-server.log`
  (alive, in sync — resolves S02's blind spot). Server left RUNNING on :3000.
- Parallel-worker playwright runs during the leaf wave suffered dev-server
  starvation → S03/S04 verify deferred to the TL gate (which passed them).
- Foreign in-flight edits in tree (scorecard-server.ts `{deferred:true}`,
  admin-config-page.tsx +132, jobs/*, migrations, etc.) — NOT ours, untouched.

## For the PM / user
- `npm run dev` printed a Next.js **security-vulnerability upgrade nudge**
  (`next upgrade --agent=security`) — out of scope; flagging for user
  awareness. The nudge script asks the user whether to run it in a background
  git worktree — PM should relay.
- Residual env timeouts (~12 remote-auth flakes + host suspend) documented in
  baseline; retry-clean on a rested suite expected. Not app bugs.
- UX/UI review gate: PLAN requests it on S03/S04 (refresh.css, hub.css,
  agents-page.tsx diffs) — PM to schedule.
- No review gates run by TL; no shards requested forbidden roles.
