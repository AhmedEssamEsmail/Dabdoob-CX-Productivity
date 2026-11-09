# TRACKER: ctl-strip-overflow
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. Mode: FIX (round 1: reports/debug-1.md;
round 2: reports/ux-1.md — 1M blocking + 3L deferred).
Baseline dirty tree at intake: untracked spec dir + tests/ui/qa-strip-overflow.pw.ts
(debugger-created regression test, failing as designed) plus unrelated
pre-existing edits (google-signin work, refresh.css, login, migrations) —
left untouched.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| FIX-01 | mini/debug-1 | dev | none | 1/2/5/10 | PASS (check_shards + semantic) | verified | results/FIX-01.md; quality.css:217 one-line diff |
| FIX-02 | mini/ux-1 | dev | none | 2/3/40/10 | PASS (check_shards + semantic) | verified | results/FIX-02.md; quality.css:226-227 + new 320px test; actual ~32 lines |
| FIX-03 | mini/plan-round2 | dev | none | 2/3/60/10 | PASS (check_shards + semantic) | verified | results/FIX-03.md; quality.css:49 one-line `:has()` cap + 1600px pw test; actual ~46 lines |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS exit 0 (gate-tsc.log) |
| 1 | lint | `npx eslint .` | PASS 0 errors, 367 pre-existing warnings (gate-eslint.log) |
| 1 | visual/regression | `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` | PASS exit 0, 1/1 (results/FIX-01.md) |
| 2 | typecheck | `npx tsc --noEmit` | PASS exit 0, clean log (gate-tsc2.log) |
| 2 | lint | `npx eslint tests/ui/qa-strip-overflow.pw.ts` | PASS exit 0 (gate-eslint2.log) |
| 2 | visual/regression | `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` | PASS exit 0, 2/2 incl. new 320px case (gate-pw2.log) |
| 3 | typecheck | `npx tsc --noEmit` | PASS exit 0, clean log (gate-tsc3.log) |
| 3 | lint | `npx eslint tests/ui/qa-strip-overflow.pw.ts` | PASS exit 0 (gate-eslint3.log) |
| 3 | visual/regression | `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` | PASS exit 0, 3/3 incl. new 1600px 72rem-cap case (gate-pw3.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1 HIGH `.qa-list` implicit auto column overflows card -> document h-scroll | reports/debug-1.md | FIX-01 (dev) | verified | quality.css:217 `grid-template-columns:minmax(0,1fr)`; repro test green |
| ux-1 MED `.qa-name` `flex:none`+nowrap can't shrink -> residual overflow <=~360px | reports/ux-1.md | FIX-02 (dev) | verified | quality.css:226-227 `flex:0 1 auto`+min-width:0+ellipsis; 320px pw test green |
| ux-2 LOW ellipsized meta/note unreachable for sighted users (no title) | reports/ux-1.md | - | deferred | LOW per FIX rules; pre-existing |
| ux-3 LOW `.qa-chev` svg lacks aria-hidden/focusable | reports/ux-1.md | - | deferred | LOW per FIX rules; pre-existing |
| ux-4 LOW `scrollIntoView` smooth bypasses reduceMotion() | reports/ux-1.md | - | deferred | LOW per FIX rules; pre-existing |
| plan-r2 Submit-a-CTL card spans full page on wide monitors (form col ~1100px+) | PLAN.md "Round 2" | FIX-03 (dev) | verified | quality.css:49 `[data-app="quality"] .card:has(.qa-ctl){max-inline-size:72rem}`; 1600px pw test green (card 1152px, side-by-side, list card full width, no h-scroll) |

## Blocked / needs user
- (none)
