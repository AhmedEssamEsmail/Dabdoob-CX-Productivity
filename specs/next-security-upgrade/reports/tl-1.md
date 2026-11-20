# TL report 1: next-security-upgrade (BUILD)

## Outcome
4/5 leaves verified; **S01-04 -> RESHARD_NEEDED** (e2e gate fail at 16.4.6).
Package S01 not done — blocked on S01-04 re-shard decision by PM.

## Preflight
`check_shards.py spec/S01.md#S01-01..05`: PASS x5 (structural); semantic vs
LIMITS.md PASS (largest S01-02: 5f/5a/10l/10m). All leaves verification-only.

## Leaf results (all owner=maintainer, 1 attempt each, no stale workers)
- S01-01 verified: `npm ci` exit 0 (458 pkgs); `npm ls` = next@16.4.6 +
  eslint-config-next@16.4.6, no invalid; package.json/lockfile byte-identical.
- S01-02 verified: tsc exit 0; eslint exit 1 = documented baseline exactly
  (1 error tests/golden + 6 warnings, zero new); vitest 114/114 files,
  1471/1471; test:security 4/4.
- S01-03 verified: `npm run build` exit 0; compile 49s; 156/156 pages;
  zero warnings/deprecations.
- S01-05 verified: `npm audit` = 0 advisories for next/eslint-config-next;
  after-set identical to before-baseline (7 moderate minimatch dev-chain),
  recorded not remediated (logs/audit-diff.md).
- S01-04 **needs-split**: `npm run test:e2e` ran 750/750, exit nonzero —
  603 pass / 147 fail (chromium 12, firefox 50, webkit 23, mobile 16,
  tablet 46). Signatures: 121 test timeouts (90/120s), 14 `e2e login failed`
  (e2e/users.ts:78), 18 `toHaveCount` contract/toolbar assertions. Chromium
  failures are real assertion/timeouts, not infra-only. Verbatim spec list:
  `logs/e2e.log` numbered lines; summary `results/S01-04.md`.

## Integration / gates
All PLAN gate commands were executed by leaves; evidence in TRACKER gate log.
Criteria: #1 PASS, #2 PASS (manifests unchanged), #3 PARTIAL (all static +
build PASS; route/browser gate FAIL), #4 PASS.

## Scope hygiene
- Zero source/manifest edits; `git status` on package.json/package-lock.json
  empty throughout. No `.env*`, no commit/push/deploy.
- `specs/unified-page-format/logs/` preserved untouched.
- Collateral: the e2e suite itself rewrote `specs/ui-shell-polish/reports/*.png`
  screenshots (test-generated output, uncommitted) — noted, not reverted.

## For PM
- RESHARD_NEEDED: `spec/S01.md#S01-04` — 147-spec e2e failure set at 16.4.6;
  remaining outcome = green route/browser gate (or documented pre-existing
  baseline). Evidence: `logs/e2e.log`, `results/S01-04.md`.
- Worker rollback copies of manifests at %TEMP%/s01-01-rollback (unused).
- No leaf requested forbidden reviewer/architect roles. NEEDS_USER: none.
