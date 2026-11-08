# qa report - redesign - round 4 (DELTA)

Verdict: FAIL
Open: 0B / 0H / 1M / 0L

Scope: tl-5's four leaves (cx-kit.css native checkbox/radio rule; theme.css
accent-swatch tokens; hub.css swatch/eco3-h1 tokenization; people/queue/desk.css
font-size literals -> `--cx-text-*` scale) + prior open LOWs.

## Checks run
| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint .` | PASS, 0 errors / 370 pre-existing warnings (baseline unchanged) |
| `npx vitest run` | **FAIL** — 1145/1148; 3 failures in `tests/golden/hub-admin.test.ts`, all oracle key-set mismatches caused by `reminders_enabled` added in uncommitted non-shard WIP (`src/features/shared/platform/settings.ts`, belongs to `specs/reminders-master-switch/`). Not attributable to this delta. |
| `npm run test:security` | PASS, 22/22 |
| `npx playwright test --config=tests/ui/playwright.config.ts` | PASS, 96/96 (Chromium/Firefox/WebKit) |
| `npx next build` | PASS, exit 0 |
| `npm run test:e2e`, `shoot-new.mjs` | not run — live harness resets remote users/roster; deferred per tl-5/qa-3 |

## Diff review (per leaf)
- `cx-kit.css` `:root input[type=checkbox|radio]` (l.430-442): specificity
  (0,2,1) ties `.cx-toggle/.cx-switch input` and `[data-app] * input` rules;
  verified inert — hidden inputs are `opacity:0;pointer-events:none` or wrapped
  in `<label>` (`.hm-chip`, `.trk-kind`), and app sheets load per-page after
  cx-kit so `.hm-toggle input { margin-top:3px }` still wins. `.pw-check input`
  18px == 1.125rem. Intended accent restyle lands only on visible raw controls.
- `theme.css`: 8 new `--cx-accent-{pine,blue,plum,rust}` + `--cx-swatch-*`
  tokens in light + both dark blocks — byte-identical to replaced literals.
- `hub.css`: swatch/preview rules tokenized with identical values; eco3 h1
  `1rem`->`--cx-text-lg` (1.0625rem, +6% — recorded in tl-5).
- people/queue/desk.css: every literal mapped to scale; value deltas
  (.9375->md, 1.125->lg) match tl-5's recorded tightenings; `.6em`/`.7em`
  relative units legitimately kept.

## Findings
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-8 | MED | `src/features/shared/platform/settings.ts:31` (+12 more files) | Uncommitted non-shard WIP (`specs/reminders-master-switch/`, `specs/maint-src-boundaries/`) red-gates `npx vitest run`: hub-admin oracle now lacks `reminders_enabled`. Not a defect of this delta, but criterion-8 "gates green" cannot hold in the shared tree until it is landed or isolated. | Land/stash the foreign WIP or update the hub-admin oracle to accept the superset key; rerun vitest clean before any redesign commit. | dev |

## Prior LOWs — all closed
- qa-4 FIXED: waiver comment `kept raw: WebGL/Three.js palette values cannot
  consume CSS custom properties` at `ecosystem-page.tsx:137`.
- qa-5 FIXED: zero `#[hex]{4|8}` alpha literals remain in theme/kit/styles.
- qa-6 FIXED: `docs/UI-SYSTEM.md:555-561` "Scene annotation exception"
  documents the eco3-tag geometry exemption.

## Not verified / assumptions
- No live authenticated E2E or screenshot sweep (remote-mutating harness);
  unchanged from qa-3.
- FAIL verdict is environmental: every check attributable to the tl-5 delta
  passed; the MED belongs to a concurrent task's WIP, not to redesign code.
