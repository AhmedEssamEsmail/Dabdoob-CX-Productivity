# lint-unused-vars — RESHARD_NEEDED (no edits made)

Source: `C:\Users\AHMED\AppData\Local\Temp\cx-lint-fix.log` — 95 `no-unused-vars` warnings; 13 are in excluded `tests/golden/legacy/hm-engine.js` → **82 in-scope across 30 files** (>10-file mini limit). Verified census via awk over the log.

## Suggested split (4 leaves, all same rule/verification)

- **L1 app+scripts+e2e (6 files, 11):** `e2e/nav-collapse.spec.ts`(1), `scripts/legacy/legacy-extract.mjs`(2), `specs/ux-ui-audit-v2/probe-verify-extra.mjs`(2), `src/app/api/integrations/freshdesk/route.ts`(1), `src/app/api/integrations/gmail/route.ts`(1), `src/features/cx-desk/lib/tlperformance.ts`(4)
- **L2 cx-quality (3 files, 20):** `src/features/cx-quality/lib/{analytics.ts(1), pure.ts(16), server.ts(3)}`
- **L3 other src/features (6 files, 21):** `cx-people/lib/scorecard/index.ts`(3), `cx-people/lib/work-core.ts`(1), `cx-productivity/lib/prod/validation.ts`(15), `cx-queue/lib/index.ts`(1), `shared/jobs/mirrors.ts`(2), `shared/platform/popups.ts`(1)
- **L4 tests (16 files, 30)** — split further if strict: L4a `tests/golden/{desk,prod-validation,productivity,scorecard,tph}.test.ts`+`tests/lib/fetch-json.test.ts` (6 files, 16); L4b `tests/perf/*` (9 files, 11) + `tests/platform/signin-verdict.test.ts` (1) = 10 files, 14.

## Constraints to carry into each leaf
- No eslint-disable comments; delete dead code or wire the binding (void/restructure). Underscore names still warn — genuinely remove/use.
- Exclude: `ecosystem-scene.tsx`, `ecosystem-page.tsx`, `hm-engine.js`, `heatmap-engine.ts`, `qa-shared.tsx`, all `loser-classnames`/`local-defs` warnings (different rule anyway).
- Preserve unrelated uncommitted work in touched files.
- Gates per leaf: `npx eslint <touched>` = 0 warnings; `npx tsc --noEmit`; `npx vitest run tests/golden` (L4 must not weaken golden tests — these are oracle ports; prefer `void x` over deleting test scaffolding).

completed: none (reshard before edit); remaining: all 82 warnings; evidence: log census above.
