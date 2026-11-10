# tl-6 — TRACKER reconciliation + FULL gate verify (final)

Mode BUILD, final verify. No dispatches, no source edits. (Named tl-6: `tl-4.md`/`tl-5.md`
already exist for the reshard-batch and qa-1-fix rounds and are cited by reports/ux-1.md.)

## TRACKER reconciliation
- Rows added (results-backed, all `done`): S12-14, S12-15, S12-16, S12-17, S12-18,
  S12-19, S12-21, S12-32, S13-08, DQ-1..DQ-7 (S12-33 already had a `verified` row).
- Mis-filed results: S12-15/S12-16/DQ-6/DQ-7 were written to repo-root `results/`
  (known per tl-yours); copies placed under `specs/ux-ui-audit-v2/results/`.
  Root originals left in place (baseline dirty tree — not deleted without approval).
- Status flips: S03-17 needs-split → superseded (→ S03-18 verified); S13-07
  needs-split → superseded (→ S13-08 done); S14-01 blocked → superseded
  (→ S14-06/S14-07 verified).
- Packages closed: S13 (7/7 + S13-08), S14 (6/6 + S14-06/07), S12-DQ (DQ-1..7).
  S12/S03 evidence updated to reflect reshard closure.
- Re-sharding table: S12-08 residual, S13-07, S14-01 residual → RESOLVED.

## Live-state spot checks
- Zero loser class tokens in `className` src-wide (tbl/seg/pw-dialog/tag/page-sub/
  empty/card/pill probe = 0 hits).
- `dq-*` remaining tokens: only documented keeps (dq-editor, dq-editor__actions,
  dq-days, dq-holform) + one `dq-map` comment ref. eslint ratchet error-gates all
  other dq-* (eslint.config.mjs:9).
- `dq-refresh` gone; `cx-refresh` live (hub-shared, queue shared, refresh.css).

## FULL gates (PLAN.md §"Gate commands", logs/tl6-*.log)
| Gate | Command | Result |
|---|---|---|
| typecheck | `npx tsc --noEmit` | PASS exit 0 |
| lint | `npx eslint .` | PASS — 0 errors / 429 warnings (was 957 at tl5, 433 at vfy2; warn-family program closed — remainder = cx-sr/sr-only + feature-boundary/local-defs warns + test backlog) |
| unit | `npx vitest run` | PASS — 1196/1196, 67 files |
| security | `npm run test:security` | PASS — 4/4 |
| perf | `npm run test:performance` | PASS — 14/14 (vacuous stub — NOT an enforced gate per S14-04/DECISION "Stays out"; perf-12 MED carried to PM) |
| build | `npm run build` | PASS — compiled 1.8s, 156/156 static pages |
| e2e r1 | `npm run test:e2e` | FAIL — 110 pass/15 fail/10 skip |
| e2e r2 (post-fix) | `npm run test:e2e` | **124 pass / 1 fail / 10 skip** — sole fail = webkit `e2e login failed` seed flake (env) |

## e2e regression found & fixed (2 fix leaves, `spec/fix-e2e-1.md`)
- **Root cause**: `Empty` renders `title` as `<strong>`; S12-18..21's `empty`→`Empty`
  contract dropped the legacy `.t` `<h2>` → `getByRole('heading')` assertions failed
  (`my-status` ×2 specs ×5 projects = 10 deterministic failures; a11y regression).
- **e2e1-01** (done): `Empty.tsx` — `level?: number` prop (default 2) +
  `<strong role="heading" aria-level={level}>`, CSS untouched, 32 consumers healed.
- **e2e1-02** (done): strict-mode collision — `'This week'` substring-matched new
  heading "No logged time this week yet." → `exact: true` at `e2e/my-status.spec.ts:18`.
- Post-fix re-verify: tsc exit 0, scoped eslint 0 err, vitest 1196/1196 unchanged,
  my-status spec 4/4 chromium; full e2e r2 healed all 10 regression + 4 r1-flake failures.

## Remaining e2e flake (env, non-blocking)
1 fail = webkit `e2e login failed` (seed exhaustion; the flake migrates between
projects run-to-run — r1 firefox×2+mobile, r2 webkit×1). TRACKER "Blocked / needs
user" notes it; not a code defect.

## Blocked / needs user
- Recurring e2e seed/login env flake (above) — needs `e2e/seed-users.mjs` / dev-env attention.
- Deferred LOWs unchanged in TRACKER Review findings (ux-2, ux-3, qa-1 ChipStatus
  casts, qa-2 stale test names, qa-3 stray `nul` files — deletion needs approval).
