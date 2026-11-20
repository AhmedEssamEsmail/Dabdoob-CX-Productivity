# TL report 2 — next-security-upgrade (BUILD, re-sharded e2e leaves)

## Scope
Dispatched re-sharded leaves S01-06..S01-09 (all `maintainer`, all preflight
PASS structural + semantic). S01-01/02/03/05 already verified; no `npm ci`
rerun — install stayed at next@16.4.6. Zero source/manifest/config edits by
any leaf (verification/log-generation only).

## Leaf outcomes (all verified)
- **S01-06** `results/S01-06.md`: 147 failures partitioned — timeout 78,
  login-failed 14, toHaveCount 18, other 37; per-project 12/50/23/16/46.
  Firefox scope = 8 spec files. Evidence: `logs/e2e-failures.txt`,
  `logs/e2e-failure-classes.md`.
- **S01-07** `results/S01-07.md`: chromium rerun @workers=2, 82p/16f.
  10/12 original failures still-failing + 6 new page-contract failures.
  Evidence: `logs/e2e-chromium-rerun.log`.
- **S01-08** `results/S01-08.md`: firefox serial @workers=1, 8 files, 102p/10f.
  Recovery 50->10; all 29 timeout + 10 login-failed recovered →
  **env/auth-saturation class CONFIRMED**; 10 assertion failures persist.
  Evidence: `logs/e2e-firefox-serial.log`.
- **S01-09** `results/S01-09.md`: verdict **REGRESSION** — 26 verbatim
  persistent failures (toBeCloseTo toolbar geometry, `.page-actions x moved`,
  aria-busy toHaveCount, Reminders Toggle) identical across chromium+firefox at
  workers<=2 → deterministic 16.4.6 regression. Evidence:
  `logs/e2e-gate-verdict.md`.

## Disposition — RESHARD_NEEDED
Criterion #3 browser gate is RED on real regressions, not env. S01-09's own
contract escalates via `RESHARD_NEEDED`; app-code fixes are beyond
verification-leaf scope. PM to decide: re-shard fix leaves (likely FIX-mode
from `logs/e2e-gate-verdict.md`) or defer/rollback. TRACKER marks S01
`needs-split`; all prior PASS gates (tsc, eslint=baseline, vitest 1471/1471,
security 4/4, build 156/156, audit) stand unchanged.

## Notes
- No worker staleness; both Playwright runs serialized correctly on :3000
  (webServer self-managed; no manual `next dev`).
- Changed files: only `specs/next-security-upgrade/{logs,results,TRACKER.md}`.
- No leaf requested reviewers/devops; none spawned.
