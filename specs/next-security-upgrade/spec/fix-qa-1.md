# Fix leaves — reports/qa-1.md (round 4)

Blocking findings routed: qa-1 (HIGH) -> qa1-01; qa-2 (MED, disposition:
document as deferred env-class with evidence) -> qa1-02. LOW findings qa-3
(TRACKER provenance note — TL writes it) and qa-4 (e2e PNG noise, leave
uncommitted) are deferred, no leaf.

## qa1-01: Re-verify browser gate for webkit + mobile + tablet @workers=1
Kind: mini
ID: qa1-01
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #3 (browser gate) — close qa-1
Skills: none
Budget: files=4; actions=5; changed_lines=120; minutes=10

### Goal
Prove the post-fix tree green (or classify every residual) on the three
projects never re-run: webkit, mobile, tablet — serially at `--workers=1`,
same verification mode accepted for chromium/firefox in S01-14.

### Files
- Create: `specs/next-security-upgrade/logs/e2e-verify-webkit.log` | full run output
- Create: `specs/next-security-upgrade/logs/e2e-verify-mobile.log` | full run output
- Create: `specs/next-security-upgrade/logs/e2e-verify-tablet.log` | full run output
- Create: `specs/next-security-upgrade/logs/e2e-verify-r4-verdict.md` | per-project verdict + residual classification

### Context
- `specs/next-security-upgrade/logs/e2e-failure-classes.md` | per-project failing spec files + signatures (webkit 9 files, mobile 7, tablet 9; union listed below)
- `specs/next-security-upgrade/logs/e2e-gate-verdict.md` | the 26-failure regression set + env-saturation precedent
- `specs/next-security-upgrade/results/S01-14.md` | chromium/firefox serial GREEN evidence
- `specs/next-security-upgrade/reports/qa-1.md:25` | finding qa-1 exact requirement
- `playwright.config.ts:16-42` | project names webkit/mobile/tablet

### Contract
Verification only — zero edits to `src/`, `e2e/`, `tests/`, `playwright.config.ts`,
manifests. Run the union of each project's failing spec files:
`e2e/aging-refresh-layout.spec.ts e2e/page-contract.spec.ts e2e/my-status.spec.ts
e2e/toolbar-stability.spec.ts e2e/hash-anchors.spec.ts e2e/page-frame.spec.ts
e2e/auth.spec.ts e2e/input-sizing.spec.ts e2e/ui-shell-polish.spec.ts
tests/e2e/a11y-keyboard.spec.ts e2e/status-validation.spec.ts e2e/nav-no-splash.spec.ts`
Out of scope: fixing any newly surfaced real failure beyond ONE confirming
rerun (report it; TL re-shards); qa-2; qa-4 PNG files.

### Actions
1. `npx playwright test <12 union files> --project=webkit --workers=1` > e2e-verify-webkit.log
2. Same set `--project=mobile --workers=1` > e2e-verify-mobile.log
3. Same set `--project=tablet --workers=1` > e2e-verify-tablet.log
4. Triage every residual failure: match signature vs env-saturation classes
   (timeout/login-under-load per e2e-failure-classes.md); ONE targeted
   `--workers=1` rerun for any non-env-class or infra-flake failure, appended
   to its log.
5. Write e2e-verify-r4-verdict.md: per-project pass/fail counts, residual
   list each labelled env-class/infra-flake/real-regression, overall verdict.

### Done when
- All 3 projects ran serially at workers=1 vs the fixed tree; logs exist.
- Every residual failure is labelled env-class, infra-flake (with rerun
  evidence), or real-regression (escalated, not fixed).
- Verdict doc states GREEN or names the real regressions.
- `git status --porcelain` on src/e2e/tests/playwright.config/manifests: clean.

### Verify
- Run: `npx playwright test e2e/hash-anchors.spec.ts --project=webkit --workers=1`
  -> included in log evidence; hash-anchors `#/aging did not rewrite` signature
  resolved or classified.

### Handoff
logs/e2e-verify-r4-verdict.md = criterion-3 evidence for the reviewer.
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-02: Document deferred StrictMode double-mount analytics 500 (qa-2)
Kind: mini
ID: qa1-02
Parent: S01
Owner: dev
Depends: none
Criteria: qa-2 disposition — document as deferred env-class with evidence
Skills: none
Budget: files=1; actions=2; changed_lines=60; minutes=5

### Goal
Produce the deferral-evidence document for the duplicate
`GET /api/prod/analytics` -> 500 defect so the PM can record qa-2 as a
deferred env-class item instead of fixing it in this task.

### Files
- Create: `specs/next-security-upgrade/reports/deferred-qa2.md` | deferral disposition + evidence

### Context
- `specs/next-security-upgrade/results/S01-12.md` | RESHARD_NEEDED: root cause in `src/app/api/prod/analytics/route.ts`, serial run passed (logs/e2e-fix-console.log)
- `specs/next-security-upgrade/results/S01-14.md` | 500 did not recur in final serial verification
- `specs/next-security-upgrade/reports/qa-1.md:26` | finding qa-2 text
- `src/features/cx-hub/lib/use-page-data.ts` | where dedupe/stable-loader would live (read-only)

### Contract
Documentation only — zero source edits. Doc must state: defect description
(StrictMode double-mount -> two concurrent identical analytics GETs -> 500
under load); evidence it is load-correlated env-class under this suite (S01-12
serial pass, S01-14 non-recurrence); that it is out of this PLAN's scope;
proposed future fix location (`use-page-data.ts` dedupe or route hardening);
disposition = deferred pending PM scheduling.
Out of scope: implementing the dedupe, touching route.ts, e2e runs.

### Actions
1. Compile the evidence citations (file paths above).
2. Write reports/deferred-qa2.md per the contract.

### Done when
- Doc exists, cites >=3 evidence paths, states deferred disposition and the
  future-fix location.
- No source/test/config files touched.

### Verify
- Run: `git status --porcelain src e2e tests` -> clean.

### Handoff
PM uses reports/deferred-qa2.md to close qa-2 as deferred.
Write results/qa1-02.md (<=10 lines); TL alone updates TRACKER.md.
