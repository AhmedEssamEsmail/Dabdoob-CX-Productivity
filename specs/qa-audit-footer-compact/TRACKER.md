# TRACKER: qa-audit-footer-compact (FIX mode, reports/debug-1.md)
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`.

Baseline dirty tree at start (do not revert): `M src/app/styles/quality.css`,
`M src/features/cx-quality/components/quality-analytics-page.tsx`,
`?? specs/qa-audit-footer-compact/`, `?? tests/quality/qa-audit-footer-compact.test.tsx`.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| debug-1 | package/- | - | - | n/a | not dispatchable | done | reports/debug-1.md; all 4 children done, targeted 6/6 |
| dbg1-01 | mini/debug-1 | dev | none | 1/1/2/5 | PASS | verified | results/dbg1-01.md; row label assertion passes |
| dbg1-02 | mini/debug-1 | dev | none | 1/1/2/5 | PASS | verified | results/dbg1-02.md; PassForm label assertions pass |
| dbg1-03 | mini/debug-1 | dev | none | 1/1/1/5 | PASS | verified | results/dbg1-03.md; rows assertion passes |
| dbg1-04 | mini/debug-1 | dev | dbg1-03 | 1/1/2/5 | PASS | verified | results/dbg1-04.md; 6/6 targeted green |
| qa-1 | package/- | - | - | n/a | not dispatchable | done | reports/qa-1.md round-1 FAIL -> fixed |
| qa1-01 | mini/qa-1 | dev | none | 3/3/12/10 | PASS | verified | results/qa1-01.md; 6/6 targeted, tsc+eslint clean |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| fix-1 | targeted unit | `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` | PASS 6/6 (reports/vitest-fix.log) |
| fix-1 | typecheck | `npx tsc --noEmit` | PASS clean, empty log (reports/tsc.log) |
| fix-1 | lint (touched files) | `npx eslint <3 files>` | PASS exit 0 (reports/eslint.log) |
| fix-1 | unit full | `npx vitest run` | 1524/1526 pass; 2 failures PRE-EXISTING, unrelated to diff: sheets-freeze-scan (scripts/ops repo scan), table-center-align (baseline quality.css edit) — reports/vitest-full.log |
| fix-1 | e2e contract | `npx playwright test e2e/page-contract.spec.ts` | 350/410 pass; 60 fails environmental (e2e login failed / 500s) across ~30 unrelated routes; /audit-queue PASS on chromium/firefox/webkit/tablet, sole mobile fail = login infra error, not contract (reports/e2e-contract.log) |
| fix-2 | targeted unit | `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx` | PASS 6/6 (reports/vitest-fix2.log) |
| fix-2 | typecheck | `npx tsc --noEmit` | PASS clean (reports/tsc2.log) |
| fix-2 | lint (touched files) | `npx eslint qa-shared.tsx + test` | PASS exit 0 (reports/eslint2.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1 row toggle label Pass->Skip | reports/debug-1.md | dbg1-01 | verified | results/dbg1-01.md |
| dbg-2 PassForm labels Confirm skip/Skipping | reports/debug-1.md | dbg1-02 | verified | results/dbg1-02.md |
| dbg-3 #qa-comment rows prop | reports/debug-1.md | dbg1-03 | verified | results/dbg1-03.md |
| dbg-4 footer buttons size=sm | reports/debug-1.md | dbg1-04 | verified | results/dbg1-04.md |
| qa-1 #qa-comment still too large/full-width (HIGH) | reports/qa-1.md | qa1-01 | verified | results/qa1-01.md |
| qa-2 baseline .qa-whylist li edit breaks table-center-align (MED) | reports/qa-1.md | — | blocked | Baseline dirty edit owned by sibling spec; revert forbidden; needs PM/user routing to owning spec |
| qa-3 stray untracked logs (LOW) | reports/qa-1.md | — | deferred | LOW -> deferred per FIX mode |

## Blocked / needs user
- qa-2: `src/app/styles/quality.css` dirty `.qa-whylist li` edit predates this shard (baseline) and breaks `tests/css/table-center-align.test.ts`. It belongs to a sibling spec's in-flight change; TL must not revert. PM to route to the owning spec or get user decision.
