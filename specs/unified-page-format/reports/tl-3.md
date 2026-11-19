# TL report 3 — unified-page-format: S08 e2e specs + S09 dead CSS + e2e fix wave COMPLETE

## Leaves this wave
| ID | Owner | Status | Changed files | Evidence |
|---|---|---|---|---|
| S08-01 page-frame spec | test-engineer | done | e2e/page-frame.spec.ts (new ~270l) | results/S08-01.md; spec correct — found real geometry violations |
| S08-02 nav-no-splash spec | test-engineer | done | e2e/nav-no-splash.spec.ts (new ~195l) | results/S08-02.md; exit 0, 8 passed / 2 skipped non-chromium |
| S09-01 dead head CSS | dev | done | refresh.css, queue.css, hub.css, people.css | no results file (worker ended mid-write); TL-verified: `.aging-page-head` block+carve-out, `.ag-actions-full`, `.md-head-actions`, `.kicker--block` deleted; `.pw-page` → `--main-pad`; zero `src/` refs |
| e1-01 `/` kicker | dev | done | my-day-page.tsx (kicker prop + `Hm` helper dropped) | results/e1-01.md |
| e1-02 actions-edge diagnosis | dev | blocked→superseded | none (no edits) | results/e1-02.md — measured shared root cause; fix file outside leaf → e1-04 |
| e1-04 actions-edge fix | dev | done | refresh.css (+`margin-inline-start:auto`) | results/e1-04.md; six routes ±2px |
| e1-03 /ctls h-scroll | dev | done | quality.css (+`overflow-wrap:anywhere` on `.qa-note-txt--full`) | results/e1-03.md; hScroll 0 @375 |
| e1-05 guard retarget | dev | done | tests/css-form-guards.test.ts, refresh.css (+control guard on `:root .page-actions`) | results/e1-05.md; 22/22 |

## Findings fixed (spec/fix-e2e-1.md — preflight PASS ×5)
S08-01's spec caught 3 real violations → e1-01 (`/` kicker), e1-02/04 (`.page-actions` wrap on 6 routes — shared flex cause), e1-03 (`/ctls` 328px overflow: unbreakable URL in `agentNote`). Plus e1-05: S09-01 fallout — css-form-guards SITES entry referenced deleted `.aging-page-head`; retargeted to unified `.page-actions` and the canonical control guard moved up to the slot rule.

## Integration gates (TL-run)
- `npx tsc --noEmit` — PASS exit 0
- `npx eslint .` — 1 error + 6 warnings, identical pre-existing baseline; zero in wave-3 files
- `npx vitest run tests/css-form-guards.test.ts` — PASS 22/22 (full suite = PM gate; interim full run's only fail was the e1-05 file, now fixed)
- `npx playwright test e2e/page-frame.spec.ts --project=chromium` — **PASS 3 passed (3.6m)**: head geometry uniform @1024/@1440, 375px stack + no h-scroll, all 37 frame routes
- `npx playwright test e2e/nav-no-splash.spec.ts` — PASS (leaf run): no splash, no #app empty, rail mounted once, `.page-loading` only wait cue

## Scope check
PASS — every wave-3 file inside a declared leaf list; worker temp scripts (ctls-*.cjs/json, logs at root) removed; e1-01/e1-03 results files written to root `results/` were consolidated into `specs/unified-page-format/results/`.

## Notes for PM
- Criteria #3 #4 #5 now have green spec evidence; remaining spec criteria need PM review gates.
- Dead CSS still flagged by S03-02 (`.hm-head-actions`, `.sch-controls` in queue-area stylesheets) is OUT of S09-01's Files list — candidates for a future cleanup leaf if PM wants.
- No reviewers spawned (PM-run gates); no commits/pushes; dev server untouched (PM-owned).
- Workers intermittently die at the results-file write step (S09-01, and e1-01/e1-03 wrote to root `results/` instead of the spec dir); verify leaf evidence in-tree regardless.
- Full `npm run test:e2e` (page-contract + both new specs, all browsers) remains the PM's final gate.
