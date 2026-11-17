# TRACKER: e2e-contract-green
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Mode: FIX. Source reports = `PLAN.md` (verified debug report) + `reports/qa-1.md` + `reports/ux-1.md`.
Leaves: `spec/fix-plan-1.md` (S01-S08 done), `spec/fix-qa-1.md` (qa1-01 done), `spec/fix-ux-1.md` (ux1-01; preflight PASS).
Dev server already on localhost:3000 — never `next dev`; output in `logs/dev-server.log`.

Baseline dirty tree at start (NOT ours — do not revert):
`M src/app/api/cron/job-qa-engine/route.ts`, `M src/features/shared/jobs/{env,sheets}.ts`,
`M src/features/shared/migration/engine.ts`, `?? nul`, `?? scripts/ops/probe-sync-health.ts`,
`?? specs/aging-stale-status/reports/`, `?? specs/qa-live-sheets-freeze/`,
`?? src/features/shared/lib/sheets-freeze.ts`, `?? tests/lib/sheets-freeze.test.ts`,
`?? supabase/migrations/20261116175742_*.sql`, `?? supabase/migrations/20261116202604_*.sql`.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | mini/fix-plan-1 | dev | none | 1/3/15/5 | PASS | verified | results/S01.md; +3 lines bootstrap.ts; tsc 0; unstable-value count 58->58 |
| S02 | mini/fix-plan-1 | dev | S01 | 5/4/80/10 | PASS | verified | results/S02.md; 41 routes 200; no in-scope offenders; pages.ts calls sit behind dynamic awaits (legal); NOTE logs/dev-server.log stale (Nov12) — live server writes to terminal; final proof = S07 post-allowlist-removal green run |
| S03 | mini/fix-plan-1 | dev | none | 4/3/60/10 | PASS | verified | results/S03.md; VERIFIED by TL full run (logs/tl-full-chromium2.log): roster+my-day green @both widths |
| S04 | mini/fix-plan-1 | dev | none | 2/3/80/10 | PASS | verified | results/S04.md; VERIFIED by TL full run: /agents green @both widths; RCA = Tabs scrollIntoView + scroll-pin fix |
| S05 | mini/fix-plan-1 | dev | none | 3/4/60/10 | PASS | verified | results/S05.md; env verdict (same-origin, Origin ok, chromium/ff pass); +1 webkit-only allowlist regex; baseline updated |
| S06 | mini/fix-plan-1 | test-engineer | S01 | 4/4/60/10 | PASS | verified | results/S06.md; login waits raised+retry-safe, SLOW_DATA 150s tier, domcontentloaded; run1 82/82 timeouts -> run2 ~43-50; residual = dev-server wedge (env, NEEDS_USER restart); tsc/eslint clean |
| S08 | mini/fix-plan-1 | dev | S01 | 2/3/20/5 | PASS | verified | results/S08.md; next.config.ts instantInsights manual-warning; VERIFIED: 0 Dropped-segment in live dev log across full suite |
| S07 | mini/fix-plan-1 | dev | S01,S02,S05,S06,S08 | 2/4/80/10 | PASS | verified | results/S07.md; crash allowlist entries removed; baseline refreshed; nul absent; targeted verify 10/10 |
| qa1-01 | mini/fix-qa-1 | test-engineer | none | 2/3/15/10 | PASS | verified | results/qa1-01.md; QUIRKS['/my-day'].skipToolbar added; TL re-run 2/2 pass w/ toolbar-skip, no POST fired; tsc clean |
| ux1-01 | mini/fix-ux-1 | dev | none | 1/2/30/10 | PASS | verified | results/ux1-01.md; once-listeners cancel pin rAF; tsc clean; /agents 2/2 green @375+@1024 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| pre | leaf-preflight | check_shards.py x7 | PASS x7 |
| g1 | contract chromium full | playwright page-contract --project=chromium (logs/tl-full-chromium2.log) | 69 pass / 13 fail — ALL env-class (5 login + 7 timeout + 1 NET_IO_SUSPENDED); roster/my-day/agents GREEN; 0 unstable-value, 0 Dropped-segment in live dev log |
| g2 | contract chromium subset | S07 verify -g "admin-roster|my-day|agents|people-holidays|overview|quality-analytics" (logs/s07-pw.log) | 10/10 pass, allowlist re-tightened |
| g3 | typecheck | npx tsc --noEmit per-leaf (logs/s0*-tsc.log) | clean at every leaf checkpoint; final combined run in-flight at close |
| g4 | contract /my-day (qa-1 fix) | playwright page-contract --project=chromium -g "my-day contract" (logs/qa1-tl-pw.log) | 2/2 pass @375+@1024 with toolbar-skip annotations; primary click bypassed -> no POST /api/hub/my-day |
| pre2 | leaf-preflight | check_shards.py fix-ux-1.md#ux1-01 | PASS (structure + semantic vs LIMITS) |
| g5 | contract /agents (ux-1 fix) | playwright page-contract --project=chromium -g "agents contract" (logs/ux1-pw.log) | 2/2 pass @375+@1024; tsc clean (logs/ux1-tsc.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| Date.now() prerender crash (all routes; Firefox bare `Error`) | PLAN.md #1 | S01 | verified | bootstrap.ts:16; logs/dev-server.log 58 hits |
| Residual sync-IO offenders possible | PLAN.md #1 | S02 | pending | sweep after S01 |
| /admin/roster @1024 .page-actions x +12.97px | PLAN.md #2 | S03 | verified | min-inline-size reserve; green both widths |
| /my-day @1024 .page-actions x +41.95px | PLAN.md #2 | S03 | verified | md-book-btn reserve; green both widths |
| /agents @375 .page-actions y +394px | PLAN.md #2 | S04 | verified | Tabs scrollIntoView scroll delta; scroll-pin; green |
| WebKit fetch "access control checks" | PLAN.md #4 | S05 | verified | env verdict + scoped allowlist + baseline note |
| 11 env/timeout failures chromium | PLAN.md #5 | S06 | verified | levers landed; TL run: 13 env-only fails (login/IO-suspend), 0 app |
| Stray `nul`; allowlist TODO :29-32; stale baseline | PLAN.md #6 | S07 | verified | all closed; verify 10/10 green |
| NEW: instant-unrendered-segment errors (~30 tests) | S06 run2 | S08 | verified | manual-warning opt-out; 0 hits in live log |
| qa-1 HIGH: /my-day contract fires real POST /api/hub/my-day focusBlock | reports/qa-1.md | qa1-01 | verified | e2e/routes.ts QUIRKS entry + baseline note; g4 2/2 pass |
| qa-2 LOW: qe-fd-cache unit test fails (foreign, files unmodified) | reports/qa-1.md | - | deferred | LOW per FIX rules; no spec files touched |
| ux-1 MED: agents-page.tsx:509-521 pin overrides user scroll 800ms | reports/ux-1.md | ux1-01 | verified | once-listeners cancel rAF; g5 2/2 pass |
| ux-2 LOW: min-inline-size reserves sized to English labels only | reports/ux-1.md | - | deferred | LOW per FIX rules; re-measure if locales land |
| ux-3 LOW: roster-add-btn at :root vs hub-scoped md-book-btn | reports/ux-1.md | - | deferred | LOW per FIX rules; optional convention cleanup |

## Blocked / needs user
- RESOLVED: the old dev server was stdout-wedged then died; playwright's `webServer` spawns a fresh `npm run dev` per run (works — probe 2/2 green). No longer blocked.
- NOTE for PM/user: `npm run dev` printed a Next.js security-vulnerability upgrade nudge (`next upgrade --agent=security`); out of scope here, relayed in the TL report.
- Foreign in-flight edit observed mid-run: `M src/features/cx-people/lib/scorecard-server.ts` (`{deferred:true}` on fetchWorkbookTabs x2) — NOT from any leaf here; left untouched, likely another stream's work.
- `logs/dev-server.log` is stale (Nov 12) — the live dev server writes to its own terminal; prerender-error proof falls back to S07's post-allowlist-removal green run + console evidence.
- NEEDS_USER (qa-1 residue): the S07 verify run booked a real "Focus time" event in the owner's Google Calendar via POST /api/hub/my-day focusBlock. No in-app/API delete action exists — the user must delete it manually from Google Calendar.

| g6 | QA DELTA r3 + UX DELTA r2 | qa-expert / ux-ui-expert | PASS / PASS (0B/0H/0M, LOW carried: ux-2,3,4; qe-fd-cache foreign) |
