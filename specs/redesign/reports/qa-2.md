# qa report - redesign - round 2 (DELTA)

Verdict: **PASS** — qa-1/qa-2/qa-3 verified fixed with independently recomputed evidence; only the four pre-deferred LOW nits remain.

Open: **0B / 0H / 0M / 4L**

## Checks run (from project root, this review)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx eslint .` | PASS — 0 errors, 370 warnings (same baseline as tl-2) |
| `npx vitest run` | PASS — 46 files / 1140 tests |
| `npm run test:security` | PASS — 22/22 |
| WCAG contrast recomputation (own sRGB luminance script) | All PASS — see fix verification below |
| `contract-report.json` analysis (103 shots) | 47/47 pages light+dark; `auth-login`+`no-access` now have dark variants; only measured fails = `ecosystem` btnMinH=0 ×2 (known qa-6); no new fails vs round 1 |
| `shoot-new.mjs` diff read | New dark contexts at `:257-259` (no-access) and `:269-270` (auth-login) — mirror existing light passes, no other logic change |
| `theme.css` changed-token read | Exactly the 4 claimed values; dark block untouched; `:root` comment on `--line-strong` documents intent |
| `git status` scope check | Only expected files; `.devin/work` gitignored; no out-of-scope edits vs round-1 tree |

## Prior findings — verification

| ID | Was | Now | Evidence |
|---|---|---|---|
| qa-1 (HIGH) | light `--line-strong` 2.29:1; chip edges 2.48/2.64:1 | **FIXED** | `#828a96` = 3.49 vs `#fff` surface / 3.25 vs `#f6f7f8` paper; dark (inherited) 4.87/5.31. `neutral-edge #6e7887` = 3.70 vs chip bg, 4.47 vs surface. `warn-edge #9a6b12` = 4.15 vs chip bg, 4.68/4.36 vs surface/paper. All ≥3:1 (crit.7 UI boundary). |
| qa-2 (MED) | white on `--age-3` = 3.92:1 | **FIXED** | `--cx-age-ink-3` flipped to `#0f1720` = 4.60 vs `#d05f2a` ≥4.5 (light); dark `#0b121d` on `#f0772d` = 6.60. |
| qa-3 (MED) | `auth-login`, `no-access` light-only shots | **FIXED** | `auth-login-dark.png/.dom/.styles` + `no-access-dark.*` on disk and indexed in contract-report (103 shots); variant sets confirm both pages now light+dark. |

## Findings (open — all carried LOW, unchanged this round)

| ID | Sev | file:line | Issue + evidence (≤2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-4 | LOW | `src/features/cx-hub/components/ecosystem-page.tsx:138-141` | Canvas-paint hex literals (`#86ab98` etc.) still uncommented — canvas can't consume CSS vars. | Read `--c` via `getComputedStyle`, or add `kept raw` waiver comment. | dev |
| qa-5 | LOW | `src/app/cx-kit.css:1312,1328`; `src/app/styles/people.css:226` | Alpha-hex literals `#0a1e1b66/#0a1e1b47/#0a141473` for shadows/backdrop. | Move to `--scrim`-style token or `color-mix`. | dev |
| qa-6 | LOW | `contract-report.json` → `ecosystem-{light,dark}` btnMinH=0 | `eco3-tag` 3D annotation button still the only contract miss; needs documented exemption. | Confirm with UX; if exempt, note in `docs/UI-SYSTEM.md`. | dev |
| qa-7 | LOW | `src/app/theme.css:4-5` | Stale header still claims file "Loads AFTER globals.css and legacy-apps.css" (both unimported). | Correct comment to theme.css → cx-kit.css order. | tech-writer |

## Regression check on DELTA files

- `theme.css`: only the 4 token values differ from round-1 audit; no other rules touched; dark block and `@media prefers-color-scheme` blocks unchanged (verified lines 185-310 still consistent with prior values).
- `shoot-new.mjs`: additions are two context blocks reusing existing `newCtx({dark:true})` + `shoot()` — no change to measurement logic; re-shot output has 0 new contract fails.
- No new TODO/debug/dep; `package.json` untouched.

## Criteria delta

- Crit.7 (a11y): now **PASS** — the only two AA misses closed; focus ring/reduced-motion/RTL evidence unchanged from round 1.
- Crit.4 (shots): now **PASS** — full light+dark coverage on all 47 captured pages (≥ all ~40 routes).
- Crit.9: UX gate remains a separate reviewer; QA side = PASS.

## Not verified / assumptions

- `npx next build` and `npm run test:e2e` **not re-run this round** — round-1 PASS stands; DELTA is 4 CSS color tokens + shot-harness-only edits (no DOM/JS change), and contract-report proves CSS still parses/applies (computed btnMinH/radius/border values present on 103 shots). Recommend CI re-run before ship.
- e2e firefox/webkit still unverified (round-1 note; Supabase rate-limit).
- Contrast spot-checks cover changed tokens + adjacent chip fg/bg pairs; not an exhaustive re-sweep of every token.
