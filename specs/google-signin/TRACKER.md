# TRACKER: google-signin
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at start (not ours, never revert):
- `M specs/perf-remediation/TRACKER.md`
- `?? specs/google-signin/` (this spec dir)
- `?? specs/migration-remaining/`

Preflight: `check_shards.py` structural PASS on all 7 leaves (2026-11-09);
semantic review vs LIMITS.md PASS — all `Kind: mini`, one outcome, <=2 files,
<=5 actions, <=5 checks, <=180 lines, <=10 min, disjoint files per wave.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | mini/google-signin | dev | none | 2/4/180/10 | PASS | done | results/S01.md; vitest tests/platform 84/84; tsc clean |
| S02 | mini/google-signin | dev | none | 2/3/120/8 | PASS | done | results/S02.md; vitest 3/3; tsc clean |
| S03 | mini/google-signin | dev | S01 | 2/4/160/10 | PASS | done | results/S03.md; vitest 5/5; tsc clean |
| S04 | mini/google-signin | dev | S02 | 2/5/100/10 | PASS | done | results/S04.md; tsc clean; eslint clean |
| S05 | mini/google-signin | supabase-expert | none | 1/2/60/8 | PASS | done | results/S05.md; migration 20261109123839_before_user_created_domain_gate.sql; local-tx tested |
| S06 | mini/google-signin | test-engineer | S04 | 1/3/60/8 | PASS | done | results/S06.md; playwright auth.spec 40/40; repeat 15/15 |
| S07 | mini/google-signin | tech-writer | S02 S03 S05 | 2/2/140/8 | PASS | done | results/S07.md; docs/GOOGLE_SIGNIN_SETUP.md + ARCHITECTURE.md pointer |
| F01 | mini/google-signin | dev | none | 2/2/40/10 | PASS | done | results/F01.md; vitest 6/6 callback-route; ~23 lines churn |
| F02 | mini/google-signin | dev | none | 1/3/20/5 | PASS | done | results/F02.md; googleBusy + "Redirecting…"; tsc/eslint exit 0 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS (clean; log gate-tsc.log) |
| 1 | lint | `npx eslint .` | PASS (0 errors, 367 pre-existing warnings; gate-eslint.log) |
| 1 | unit | `npx vitest run` | PASS 1144/1144, 58 files (gate-vitest.log) |
| 1 | security | `npm run test:security` | PASS 4/4 (gate-security.log) |
| 1 | build | `npx next build` | PASS compiled 14.4s, 156 static pages (gate-build.log) |
| 1 | e2e | `npm run test:e2e` | PASS 110 passed, 10 pre-existing data-dependent skips, 0 failed (gate-e2e.log) |
| 2 | typecheck | `npx tsc --noEmit` | PASS exit 0 (fix2-tsc.log) |
| 2 | lint | `npx eslint <2 changed files>` | PASS exit 0 (fix2-eslint.log) |
| 2 | unit | `npx vitest run` | PASS 1145/1145, 58 files (fix2-vitest.log) |
| 3 | typecheck | `npx tsc --noEmit` | PASS exit 0 (fix3-tsc.log) |
| 3 | lint | `npx eslint src/app/auth/login/page.tsx` | PASS exit 0 (fix3-eslint.log) |
| 3 | unit | `npx vitest run` | PASS 1145/1145, 58 files (fix3-vitest.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 (MED): `roleForEmail` throw -> unhandled 500, signOut skipped, live session | reports/qa-1.md | F01 -> dev | done | results/F01.md; route.ts:33-39 try/catch + signOut + `?error=auth`; regression test added |
| qa-2 (LOW): migration comment vs deny-by-default code | reports/qa-1.md | supabase-expert | deferred | LOW per FIX rules |
| qa-3 (LOW): `redirectTo` built from `req.url` Host header | reports/qa-1.md | dev | deferred | LOW per FIX rules |
| qa-4 (LOW): `error:null` + missing `data.user.email` branch untested | reports/qa-1.md | test-engineer | deferred | LOW per FIX rules |
| qa-5 (LOW): foreign staged files risk sweeping into commit | reports/qa-1.md | dev | deferred | LOW; unstage needs git reset (forbidden) -> user |
| ux-1 (MED): shared `loading` relabels email submit on Google click | reports/ux-1.md | F02 -> dev | done | results/F02.md; page.tsx :32,:63,:77,:166,:191,:193 |
| ux-2 (LOW): quiet Google CTA lacks "G" mark | reports/ux-1.md | dev | deferred | LOW per FIX rules |
| ux-3 (LOW): any `?error=<x>` shows Google banner; param persists | reports/ux-1.md | dev | deferred | LOW per FIX rules |
| ux-4 (LOW, pre-existing): dead "Forgot password?" span looks like link | reports/ux-1.md | dev | deferred | LOW per FIX rules |

## Blocked / needs user
- Applying the S05 migration to the live remote DB requires user approval (file-only shard; runbook S07 documents dashboard hook enablement).
