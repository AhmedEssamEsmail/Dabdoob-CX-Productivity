# RESUME: unified-page-format
Final closeout (tl-8). Task COMPLETE — no paused state; nothing remains to resume.

## Outcome
All ~40 CX-Hub routes unified onto the PageShell frame (h1/sub/actions/
toolbar/stats slots) + instant nav via root `loading.tsx` and `#app[data-booted]`
splash latch. See `specs/unified-page-format/PLAN.md`, `DECISION.md`
(Option A), `spec/00-index.md`, and `docs/PAGE-FRAME.md`.

## Status
- All leaves S01-01..S09-01 and fix leaves e1-*, qa1-*, ux1-*, qa3-01:
  `verified` or `superseded`. No in-progress/blocked/needs-split rows.
- All packages S01–S09 `verified`.
- Final reviews (TRACKER "Review status (final, tl-8 closeout)"):
  qa-1..qa-3 findings all fixed and verified; qa-4 and ux-3 final DELTA
  rounds PASS with 0 open items. ux-1/ux-2 findings verified FIXED.
- Final gates green: `npx tsc --noEmit` exit 0; `npx eslint .` identical
  pre-existing baseline (1 error in tests/golden, 6 out-of-scope warnings);
  `npx vitest run` 114/114 files, 1471/1471 tests; e2e contract+frame 85/85
  chromium green (last full run ux1-fix). See TRACKER "Gate log" for
  per-round commands and `logs/gate-*.log` evidence.

## Deferred / non-blockers (PM-owned)
- qa-5 LOW deferred by PM decision: `/` date eyebrow (Hm kicker) dropped;
  restoring needs a kicker slot that doesn't shift h1.top.
- Approved QA reports and the stray reviewer artifact
  `logs/ux-probe/frame-dark-rtl.spec.ts` (a Playwright spec that broke
  `npx vitest run` suite load) have been deleted; final `npx vitest run`
  exits 0 (114/114 files, 1471/1471 tests).
- Next.js security-upgrade nudge surfaced during e2e dev-server spawn —
  needs maintainer + user approval before any dependency change.

## Housekeeping
- Task files staged for an approved local commit; nothing pushed.
  Logs are excluded/untracked. See `specs/unified-page-format/logs/` for
  evidence.
- If resuming maintenance later: read TRACKER.md (single writer: tech-lead)
  and results/ before any change.
