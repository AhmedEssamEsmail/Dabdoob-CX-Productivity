# TRACKER: next-security-upgrade
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at TL start (do not revert):
- `?? specs/next-security-upgrade/` (this spec, untracked)
- `?? specs/unified-page-format/logs/` (unrelated — preserve, do not stage/delete)
- `logs/npm-audit-before.json` pre-exists as S01-05 baseline input.

Preflight: `check_shards.py` PASS x5 (structural); semantic vs LIMITS.md PASS
(largest leaf S01-02: 5 files/5 actions/10 lines/10 min — within caps).
R2 preflight (done): `check_shards.py spec/S01.md#S01-10..#S01-14` PASS x5
structural; semantic vs LIMITS.md PASS (largest S01-10: 5f/5a/150l/10m).
S01-10..13 are USER-APPROVED bounded app-code fixes (owner dev;
each reads its cited `node_modules/next/dist/docs/` guide first); all other
leaves stay verification/log only; manifests byte-identical throughout.
R2 dispatch: S01-10 + S01-13 wave 1 (disjoint files; staggered on :3000),
S01-11 + S01-12 wave 2, S01-14 after all four.

R4 FIX (reports/qa-1.md): preflight `check_shards.py spec/fix-qa-1.md#qa1-01
+#qa1-02` PASS x2 structural; semantic vs LIMITS.md PASS (4f/5a/120l/10m and
1f/2a/60l/5m). qa-3 LOW = deferred (provenance note below); qa-4 LOW =
deferred (e2e PNG output noise, left uncommitted, excluded from change set).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | all criteria #1-#4 evidenced; browser gate GREEN post-fix (S01-14); S01-12 needs-split = optional server-side dedupe leaf, PM decision |
| S01-01 | mini/S01 | maintainer | none | 3/3/10/5 | PASS | verified | results/S01-01.md; next@16.4.6 + eslint-config-next@16.4.6, no invalid; manifests byte-identical |
| S01-02 | mini/S01 | maintainer | S01-01 | 5/5/10/10 | PASS | verified | results/S01-02.md; tsc 0, eslint=baseline, vitest 1471/1471, security 4/4 |
| S01-03 | mini/S01 | maintainer | S01-01 | 2/2/10/5 | PASS | verified | results/S01-03.md; build exit 0, 156/156 pages, zero warnings |
| S01-04 | mini/S01 | maintainer | S01-03 | 2/2/10/5 | PASS | superseded | e2e FAIL 603/750 pass, 147 fail (121 timeouts, 14 login-failed, 18 toHaveCount); evidence preserved: results/S01-04.md + logs/e2e.log; remaining scope -> S01-06..S01-09 |
| S01-05 | mini/S01 | maintainer | S01-01 | 3/3/25/5 | PASS | verified | results/S01-05.md; 0 next advisories; 7 minimatch moderates = baseline |
| S01-06 | mini/S01 | maintainer | none | 3/3/30/5 | PASS | verified | results/S01-06.md; 147 = timeout 78, login 14, toHaveCount 18, other 37; firefox scope 50f/8 files (logs/e2e-failure-classes.md) |
| S01-07 | mini/S01 | maintainer | S01-03 | 2/2/10/5 | PASS | verified | results/S01-07.md; exit 1, 82p/16f; 10/12 originals still-failing (geometry toBeCloseTo, aria-busy toHaveCount), 2 now-passing; 6 new page-contract aria-busy failures — real-regression candidates |
| S01-08 | mini/S01 | maintainer | S01-06, S01-07 | 2/3/10/5 | PASS | verified | results/S01-08.md; exit 1, 102p/10f @workers=1; recovery 50->10 — all 29 timeout + 10 login-failed recovered (env saturation CONFIRMED); 10 persist verbatim (toBeCloseTo geometry, .page-actions moved, Reminders toHaveCount) |
| S01-09 | mini/S01 | maintainer | S01-07, S01-08 | 2/2/20/5 | PASS | verified | results/S01-09.md + logs/e2e-gate-verdict.md; verdict REGRESSION — 26 verbatim persistent failures; re-sharded to S01-10..S01-14 |
| S01-10 | mini/S01 | dev | none | 5/5/150/10 | PASS | verified | results/S01-10.md; root cause = [role=status] inflating flex max-content width; fix = absolute-positioned status spans in refresh.css (content now in HEAD via parallel-session commit 7511b13); verify 15/15 (logs/e2e-fix-geometry.log); tsc 0 |
| S01-11 | mini/S01 | dev | none | 5/5/80/10 | PASS | verified | results/S01-11.md; DONE-WITHOUT-EDITS: aria-busy green workers=1+2 (logs/e2e-fix-ariabusy.log); root cause = /api/qa/* handlers >15s only under full-suite saturation — env class; tsc 0, zero source edits |
| S01-12 | mini/S01 | dev | none | 3/5/60/10 | PASS | deferred | results/S01-12.md; RESHARD_NEEDED: 500 originates in src/app/api/prod/analytics/route.ts (outside Files); serial chromium+firefox PASS = load-correlated env class; StrictMode double-mount dedupe needs new leaf |
| S01-13 | mini/S01 | dev | none | 4/5/60/10 | PASS | verified | results/S01-13.md; suspect (b): rendered .cx-switch not .cx-toggle — admin-page.tsx now uses canonical <Toggle>; item5 chromium serial PASS (logs/e2e-fix-reminders.log); tsc 0 |
| S01-14 | mini/S01 | dev | S01-10..13 | 3/3/15/5 | PASS | verified | results/S01-14.md; verdict GREEN — all 26 cleared serially; chromium 97p/1f (/checkins ERR_NETWORK_IO_SUSPENDED infra flake, rerun 2/2 pass), firefox 98p/0f |
| qa1-01 | mini/fix-qa-1 | dev | none | 4/5/120/10 | PASS | verified | results/qa1-01.md; verdict GREEN — webkit 121p/1f (auth login timeout, rerun 8/8), mobile 122p/1f (page-frame login timeout, rerun 1/1), tablet 122p/1f (nav-no-splash 600s, rerun 2/2); all residuals env-class recovered serially; `#/aging` signature resolved all 3 projects (logs/e2e-verify-{webkit,mobile,tablet}.log + e2e-verify-r4-verdict.md) |
| qa1-02 | mini/fix-qa-1 | dev | none | 1/2/60/5 | PASS | verified | results/qa1-02.md; reports/deferred-qa2.md — qa-2 documented deferred env-class w/ evidence (S01-12 serial pass, S01-14 non-recurrence); future fix site use-page-data.ts/route |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| S01-12 | root cause outside leaf Files: GET /api/prod/analytics 500s in route.ts under load (serial runs green); optional StrictMode dedupe in use-page-data.ts | none — PM deferred: env-class per serial-green evidence; fix site documented in reports/deferred-qa2.md | deferred |
| S01-04 | e2e gate FAIL at 16.4.6: 147/750 specs fail (chromium 12, firefox 50, webkit 23, mobile 16, tablet 46); timeouts/login-failed/toHaveCount signatures — compatibility break or env issue needs PM triage, not a leaf fix | S01-06 (classify), S01-07 (chromium rerun @workers=2), S01-08 (firefox serial rerun @workers=1), S01-09 (verdict/escalate) | re-sharded |
| S01-09 | verdict = REGRESSION: 26 deterministic failures (identical across chromium+firefox at workers<=2) — real 16.4.6 app-code regression; USER-APPROVED scope expansion | S01-10 (toolbar geometry), S01-11 (aria-busy settle), S01-12 (productivity console errors), S01-13 (Reminders Toggle), S01-14 (verify @workers=1 both projects) | re-sharded |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | sync | `npm ci` | PASS (S01-01, logs/npm-ci.log) |
| 1 | versions | `npm ls next eslint-config-next --depth=0` | PASS — both 16.4.6, no invalid (logs/npm-ls.log) |
| 1 | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/gate-tsc.log) |
| 1 | lint | `npx eslint .` | PASS = baseline exactly: 1 err + 6 warnings, zero new (logs/gate-eslint.log) |
| 1 | unit | `npx vitest run` | PASS 114 files / 1471 tests (logs/gate-vitest.log) |
| 1 | security | `npm run test:security` | PASS 4/4 (logs/gate-security.log) |
| 1 | build | `npm run build` | PASS exit 0, 156/156 pages, 0 warnings (logs/build.log) |
| 1 | e2e | `npm run test:e2e` | FAIL 603/750 pass, 147 fail (logs/e2e.log) -> needs-split |
| 1 | audit | `npm audit --json` | PASS 0 next advisories; 7 minimatch = baseline (logs/npm-audit-after.json, audit-diff.md) |
| 2 | e2e-classify | log analysis of logs/e2e.log | 147 = timeout 78 / login 14 / toHaveCount 18 / other 37 (logs/e2e-failures.txt, e2e-failure-classes.md) |
| 2 | e2e-chromium-rerun | `npx playwright test <5 spec files> --project=chromium --workers=2` | FAIL exit 1: 82p/16f; 10/12 originals still-failing + 6 new page-contract (logs/e2e-chromium-rerun.log) |
| 2 | e2e-firefox-serial | `npx playwright test <8 spec files> --project=firefox --workers=1` | FAIL exit 1: 102p/10f; env class recovered 50->10, 10 assertion failures persist (logs/e2e-firefox-serial.log) |
| 2 | browser-gate verdict | evidence composition (S01-06..08) | REGRESSION — 26 verbatim persistent failures (logs/e2e-gate-verdict.md) |
| 3 | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/gate-tsc-r3.log) |
| 3 | unit | `npx vitest run` | PASS 118 files / 1493 tests (logs/gate-vitest-r3.log) |
| 3 | e2e-verify chromium | `npx playwright test <5 files> --project=chromium --workers=1` | 97p/1f — sole fail infra flake (ERR_NETWORK_IO_SUSPENDED), targeted rerun 2/2 pass (logs/e2e-verify-chromium.log) |
| 3 | e2e-verify firefox | same, `--project=firefox` | PASS 98/98 (logs/e2e-verify-firefox.log) |
| 4 | e2e-verify webkit | `npx playwright test <12 union files> --project=webkit --workers=1` | 121p/1f — auth login timeout env-class; rerun 8/8 pass (logs/e2e-verify-webkit.log) |
| 4 | e2e-verify mobile | same `--project=mobile` | 122p/1f — page-frame login timeout env-class; rerun 1/1 pass (logs/e2e-verify-mobile.log) |
| 4 | e2e-verify tablet | same `--project=tablet` | 122p/1f — nav-no-splash 600s env-class; rerun 2/2 pass (logs/e2e-verify-tablet.log) |
| 4 | browser-gate verdict r4 | logs/e2e-verify-r4-verdict.md | GREEN — all 5 projects now serially verified post-fix |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 HIGH: webkit/mobile/tablet never re-verified | reports/qa-1.md | qa1-01 (dev) | fixed-verified | logs/e2e-verify-{webkit,mobile,tablet}.log + e2e-verify-r4-verdict.md — GREEN, residuals env-class recovered serially |
| qa-2 MED: /api/prod/analytics StrictMode double-mount | reports/qa-1.md | qa1-02 (dev) | deferred-documented | reports/deferred-qa2.md (env-class evidence; future fix use-page-data.ts/route — PM scheduling) |
| qa-3 LOW: S01-10 fix landed in parallel commit 7511b13 | reports/qa-1.md | TL (doc only) | deferred-done | Noted: refresh.css content reached HEAD via `specs/table-center-align` commit 7511b13; end-state verified green (S01-14, qa-1 build re-run) |
| qa-4 LOW: 11 regenerated e2e PNGs uncommitted | reports/qa-1.md | - | deferred | Test output noise under specs/ui-shell-polish/reports/; left uncommitted, excluded from this change set |

## Blocked / needs user
- (none)
