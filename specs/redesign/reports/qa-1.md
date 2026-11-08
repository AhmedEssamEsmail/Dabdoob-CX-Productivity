# qa report - redesign - round 1 (FULL)

Verdict: **FAIL** — gates all green and implementation is high quality, but two measurable AA misses against PLAN criterion 7 and a shot-coverage gap on criterion 4.
Open: **0B / 1H / 2M / 4L**

## Checks run (all from project root, this review)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx eslint .` | PASS — 0 errors, 322 warnings (pre-existing unused-vars + `kept raw` directives) |
| `npx vitest run` | PASS — 46 files / 1140 tests |
| `npx next build` | PASS — BUILD_ID `L2EF7ecy3xKtmndMCtshj`, 46 prerender routes |
| `npx playwright test --project=chromium` | PASS — `.last-run.json`: `status: passed, failedTests: []` (all 4 specs incl. auth, my-status, status-validation, responsive) |
| `npm run test:security` | PASS — 22/22 |
| `.devin/work/shots/redesign/contract-report.json` analysis | 101 shots/47 pages; target 36px fine / 44px coarse all pass; rowH=36 on 44/44 measured; baseFont=13 on 44/44; btnBorderW=1px on 100/100; only real fail = eco3-tag btnMinH=0 |
| `grep <button\|<input\|<select\|<textarea` outside `components/ui/` | 46 buttons + 31 inputs — every survivor carries a `kept raw: <reason>` waiver (verified programmatically, prev-line + same-line) |
| `globals.css`/`legacy-apps.css` import scan | 0 imports — only `theme.css` + `cx-kit.css` in `layout.tsx`; families live in `src/app/styles/*.css` (md- 83, dq- 73, qa- 168, pv-/tph- 198 refs) |
| hex scan of changed `.tsx` | only eco3 canvas scene + waived BootSplash pre-paint palette; `fontSize:'1rem'` literals replaced by `var(--cx-text-lg)` |
| WCAG contrast computation (sRGB rel. luminance) | see findings qa-1/qa-2 — light-theme edge tokens below 3:1 |
| `git diff` DOM-hook regression scan | `data-app`, `#nav`, `aria-*`, `role`, `name=` all preserved (name attrs moved into `Seg` which re-emits them — verified `Seg.tsx`); no deleted files; no console.log/debugger/TODO; `package.json` untouched |

## Findings

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-1 | HIGH | `src/app/theme.css:39` (`--line-strong`), `:146-148` (`--cx-status-neutral-edge`), `:155-157` (`--cx-status-warn-edge`) | PLAN crit.7 requires 3:1 UI contrast on chips/buttons/inputs in both themes. Light theme fails systematically: `--cx-line-strong` (oklab 45% #4f5d6b + 55% #e0e5ea) = **2.29:1 vs surface, 2.14:1 vs paper**, and it is the sole 1px border color of `.btn`/`.cx-btn`/`.cx-input`/`.cx-select`/`.cx-seg`/`.cx-switch`/fieldsets/cards (~15 rules in cx-kit.css:141,197,266,305,340,656,797,1014…). Input fill = `--cx-surface` = same white as card, so the border is the only boundary. Chip edges: neutral `#8a96a8` on `#e6eaf1` = **2.48:1**, warn `#c68a1a` on `#fdf0d6` = **2.64:1** (chip bg→surface ≈1.1:1, so the edge IS the component boundary). Dark theme edges pass (3.5–5.2:1). | Raise light `--line-strong` mix toward `--ink-2` (~70% ≈ 3.4:1) or set a literal ≈`#8a93a1`→verify ≥3:1 vs both `#fff` and `#f6f7f8`; darken neutral-edge →≈`#6e7887`, warn-edge →≈`#9a6b12` (≥3:1 vs chip bg AND vs surface/paper). | dev |
| qa-2 | MED | `src/app/theme.css:29` (`--age-3: #d05f2a`) + `:173` (`--cx-age-ink-3: #ffffff`) | White badge text on `--age-3` = **3.92:1 < 4.5:1** text AA in light theme (age chips on aging/queue surfaces). Levels 4–6 pass (6.0–11.4). | Either darken `--age-3` to ≈`#b8531f` (≥4.6:1 with white) or flip `--cx-age-ink-3` to `#0f1720` like ink-0/1/2 (5.4:1 vs `#d05f2a`). | dev |
| qa-3 | MED | `.devin/work/shoot-new.mjs:96,253-259` + `shots/redesign/contract-report.json` | PLAN crit.4: "every page in light+dark". 45/47 shot pages have both variants; `auth-login` and `no-access` are shot in light only (anon/unknown-role contexts bypass the dark loop). `auth/login` is a real route — its dark render (prefers-color-scheme path) has no visual evidence for UX review. | Add `auth-login` (and `no-access` if desired) to a dark-context pass in `shoot-new.mjs` and re-shoot, or document the exemption. | dev |
| qa-4 | LOW | `src/features/cx-hub/components/ecosystem-page.tsx:138-141` | New hex literals added in component code (`ok:#86ab98` etc.) — criterion 6 says none; they mirror `.eco3-s-*` tokens in `styles/hub.css:132-135` (canvas can't consume CSS vars). | Read `--c` via `getComputedStyle` at paint time, or add a `kept raw`-style waiver comment explaining the canvas constraint. | dev |
| qa-5 | LOW | `src/app/cx-kit.css:1312,1328`; `src/app/styles/people.css:226` | Literal alpha-hexes outside token blocks (`#0a1e1b66`, `#0a1e1b47`, `#0a141473`) for alert-shadow/dialog-backdrop — rest of the kit is token-clean. | Move to `--scrim`/token or `color-mix`. | dev |
| qa-6 | LOW | `src/app/ecosystem` scene | First `button` on ecosystem = `eco3-tag` 3D annotation, `min-height:0` — only contract failure in 101 shots (TL-flagged exempt-by-design). Needs documented exemption, not silence. | Confirm with UX; if exempt, note in `docs/UI-SYSTEM.md` a11y/geometry section. | dev |
| qa-7 | LOW | `src/app/theme.css:4-5` | Stale header comment claims file "Loads AFTER globals.css and legacy-apps.css" — both are unimported; could mislead future edits into re-adding them. | Update comment to reflect theme.css→cx-kit.css order only. | tech-writer |

## Criteria coverage summary

1. **PASS** — `theme.css` (480 ln) full token layer, light + `html[data-theme]` + `prefers-color-scheme` dark, 4 accents; `cx-kit.css` (1347 ln) reskins all shared classes at `:root .cls` (0,2,0); legacy sheets fully unimported; families migrated to `styles/*.css`.
2. **PASS** — 19 ui/ files, all required primitives incl. `Table`+parts, `Modal` (`<dialog>` top-layer), `Toasts` (`aria-live`), `Seg` (`radiogroup`+name), `Toggle`, `Tabs`; `docs/UI-SYSTEM.md` (565 ln) documents every component with variant/state tables.
3. **PASS** — 46 raw `<button>` + 31 raw inputs outside ui/, all with `kept raw` waivers (some plain comments rather than `eslint-disable` — no eslint rule exists to waive; intent met).
4. **PASS w/ gap** — 101 shots, 47 pages (≥44 routes incl. dev-overlay extras), light+dark+mobile(6)+rtl(3); see qa-3 for 2 missing dark variants.
5. **PASS** — rowH 36px on all 44 measured table shots; baseFont 13px on all 44; `--cx-target` 36 fine / 44 coarse (verified in contract-report; post-`fix-s13-rowh` state).
6. **PASS w/ nits** — geometry contract verified on 100 measured buttons (1px, radius 8px, min-height=target; eco3-tag exception qa-6); component-code hex essentially eliminated (qa-4, qa-5).
7. **FAIL** — focus ring verified (2px `--focus` + halo, `forced-colors` fallback); reduced-motion/transparency honored in tokens; RTL shots on 3 pages; but light-theme UI-boundary contrast misses 3:1 (qa-1) and age-3 badge text misses 4.5:1 (qa-2).
8. **PASS** — all gates green this run (see table).
9. **PENDING** — UX gate is a separate reviewer; QA verdict = FAIL while qa-1..qa-3 open.

## Not verified / assumptions

- e2e firefox/webkit projects not run by me (chromium all-pass; TL's earlier 7 failures were Supabase login rate-limit — the named DOM-contract specs are now green on chromium; recommend a full multi-browser re-run when env settles).
- AA audit covered accent, danger, all 5 status triples, age ramp, focus, ink/ink-2, line/line-strong in both themes — not every token permutation.
- TL's "7 pre-existing pageerrors on dev-overlay pages" — final shot artifacts record `errors: []` everywhere; could not reproduce in the post-fix capture set.
- `git diff` reviewed in full for hooks/deletions; behavior-level spot checks on `qa-forms`, `ViewAs`, `AppShell`, `tph-grid`, `qa-shared`, `analytics` — DOM contract and handlers preserved (Toggle/Seg/Field API adaptations verified against component sources).
