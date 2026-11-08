# Accent sweep - final fix

User approval: "Sweep + final verify" after UX round 3.
Performed directly in the main session; no additional subagents.

## Root cause and fix
- `--cx-accent` describes a fill/boundary, not a small-text foreground.
  Dark pine `#3d8f76` on card `#1a232b` measured 4.085:1, below 4.5:1.
- Added `--cx-accent-text: var(--cx-accent-hover)` to the shared token layer.
  It follows all explicit/system theme and accent overrides without changing fills.
- Routed seven text rules through it: hub link, queue breadcrumb, heatmap
  total, selected segment, checked toggle, selected tab, current nav text.
  The heatmap's existing neutral-text dark override stays intact.
- Preserved accent fills, button ink, SVG strokes and boundaries. The nav SVG
  remains the only direct `color: var(--cx-accent)` use, with a 3:1 non-text contract.
- Updated UI token guidance and corrected the stale theme import-order header.
  `qa-7` is now fixed.

## Regression proof
- Before source changes: the new unit guard failed on all seven text rules.
- Before source changes: Chromium dark-pine browser case failed on hub link
  and breadcrumb at 4.085:1 (card), 3.887:1 (sunken), 3.304:1 (accent-soft).
- After changes: 90 browser cases pass, zero skipped/flaky/failing:
  three engines x six explicit/system modes x five accent selections.
- Five surfaces per case: paper, surface, surface-2, sunken, accent-soft.
  4,500 foreground measurements include selected controls, icons and primary
  button normal/hover colors. Canvas resolves actual CSS OKLab mixes to sRGB.
- Minimum measured accent text contrast: 5.293:1. Dark pine on cards:
  6.543:1. Minimum primary-action text: 4.853:1. Nav SVG: 3.304:1.

## Files
- Source: `src/app/theme.css`, `src/app/cx-kit.css`,
  `src/app/styles/hub.css`, `src/app/styles/queue.css`.
- Tests: `tests/lib/accent-contract.test.ts`,
  `tests/ui/playwright.config.ts`, `tests/ui/accent-contrast.pw.ts`.
- Docs: `docs/UI-SYSTEM.md`. No dependency, API, auth or DB changes.

## Gates actually run
| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint .` | PASS, 0 errors / 370 existing warnings |
| `npx vitest run` | PASS, 47 files / 1141 tests |
| `npm run test:security` | PASS, 22 tests |
| `npx next build` | PASS, 154 pages generated |
| `npx playwright test --config=tests/ui/playwright.config.ts` | PASS, 90 tests, Chromium/Firefox/WebKit |

Raw local logs: `.devin/work/final-accent-{lint,unit,build}.log`;
browser JSON: `.devin/work/final-accent-browser.json`.
24 fixture screenshots: `test-results/ui-contrast/**/accent.png`;
light/dark pine Chromium fixtures were opened for visual inspection.

## Limits
This is a CSS-only delta review, not a new full application audit. Prior
route/RTL/mobile evidence remains in earlier reports. The live screenshot
harness was not rerun: it resets remote Supabase users and upserts roster
rows. Live authenticated E2E was also not rerun; the earlier suite had
rate-limit failures and the prior QA review verified Chromium only.
No remote writes, deployment, commit or push were performed this round.
