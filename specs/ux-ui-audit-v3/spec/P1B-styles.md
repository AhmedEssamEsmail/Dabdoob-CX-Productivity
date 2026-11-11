# P1B-04: Styles & tokens — B4 inline styles, B5 hardcoded colors, B6, B11 z-index
Kind: package
ID: P1B-04
Dispatch: NEVER

## Goal and contract
Static `style={{…}}` values (colors, spacing, fonts, display, margins, visibility, min-height) move into feature CSS classes using `--cx-*` tokens; data-driven inline values stay (`--var` setters like `--p`/`--k`/`--days`, computed `%`/`px` positions for gantt bars, tooltips, charts). Hardcoded `#[0-9a-f]{3,8}`/`rgb()`/`box-shadow`/`border-radius` literals outside `cx-kit.css`/`theme.css` move to custom-property tokens; feature-local palettes (`--eco3-*`, `--tph-*`) consolidate as documented token blocks. `z-index` raw values >10 use the `theme.css` scale (`--z-toast:40`, `--z-modal:60`). B6 is a no-op verify (`transition: all` = 0 hits).
Non-goals: token-system redesign, files not listed.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| B4-01 | dev | B13-02, B3-01 | B4 queue styles (7 files) | 7/9/120/10 |
| B4-02 | dev | B13-01, B7-06, B12-05, B3-02, B7-08 | B4 people+productivity (10 files) | 10/10/140/10 |
| B4-03 | dev | B3-02, B10-01, B12-01, B13-02, B13-01 | B4 hub+desk styles (6 files) | 6/8/110/10 |
| B4-04 | dev | B7-04, B12-06 | B4 shared+misc styles (6 files) | 6/7/80/9 |
| B5-01 | dev | none | B5 hub.css eco3 literals | 1/5/60/8 |
| B5-02 | dev | none | B5 productivity.css + quality.css | 2/4/50/7 |
| B5-03 | dev | B4-03, B5-01 | B5 ecosystem-scene literals | 1/7/120/10 |
| B6-01 | dev | none | B6 no-op verify | 0/1/0/2 |
| B11-01 | dev | none | B11 BootSplash z-index | 1/2/5/3 |

## B4-01: literal inline styles — cx-queue
Kind: mini
ID: B4-01
Parent: P1B-04
Owner: dev
Depends: B13-02, B3-01
Criteria: PLAN B4
Skills: none
Budget: files=7; actions=9; changed_lines=120; minutes=10

### Goal
No `style={{` in the listed cx-queue files carries a static literal (color, `px`, `rem`, font weight, display, margin, visibility, min-height); remaining inline styles are data-driven only.

### Files
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | literal styles :223 (whiteSpace/fontWeight), :230/:316/:1129 (skeleton px heights)
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | literal styles :125-203 (display/gap/margin/minHeight/fontWeight/visibility)
- Edit: `src/features/cx-queue/components/aging-page.tsx` | styles :155 (margin), :172, :196, :241
- Edit: `src/features/cx-queue/components/queue-page.tsx` | styles :122, :235 (flexGrow/color), :252
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | styles :237, :369
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | style :713 (`--k` — keep, dynamic)
- Edit: `src/features/cx-queue/components/shared.tsx` | styles :147 (tip px — keep, dynamic), :426, :440 (`--n` — keep)

### Context
- `src/app/styles/queue.css` | feature stylesheet receiving new classes
- `src/app/theme.css` | `--cx-*` tokens to reference

### Contract
Move each static literal to a named class in `queue.css` using `--cx-*` tokens (e.g. `display:'grid', gap:'var(--cx-space-3)'` → a `.chk-*` grid class). Keep all data-driven styles (CSS-var setters, computed percent/px positions, `bandColor()` results, tooltip x/y) inline. Reuse an existing utility class before creating one.
Out of scope: files not listed; `style={{` sites that are purely dynamic.

### Actions
1. `scheduler-page.tsx`: classify :223,:230,:316,:1129 `style={{` sites; move statics to `queue.css` classes.
2. `checkins-page.tsx`: classify :125-203 literal styles; move statics.
3. `aging-page.tsx`: classify :155,:172,:196,:241; move statics.
4. `queue-page.tsx`: classify :122,:235,:252; move statics.
5. `analytics-page.tsx`: classify :237,:369; move statics.
6. `heatmap-page.tsx`: verify :713 (`--k` — dynamic, keep).
7. `shared.tsx`: classify :147,:426,:440; keep dynamic sites, move statics.
8. Add the new classes to `queue.css` under `[data-app="queue"]` with `--cx-*` values.
9. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "style={{" <listed files>` remaining hits are dynamic-only (no literal color/px/font/spacing)

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components` -> clean

### Handoff
None.
Write results/B4-01.md (<=10 lines); TL alone updates TRACKER.md.

## B4-02: literal inline styles — cx-people + cx-productivity
Kind: mini
ID: B4-02
Parent: P1B-04
Owner: dev
Depends: B13-01, B7-06, B12-05, B3-02, B7-08
Criteria: PLAN B4
Skills: none
Budget: files=10; actions=10; changed_lines=140; minutes=10

### Goal
No `style={{` in the listed files carries a static literal; remaining inline styles are data-driven only.

### Files
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | styles :429-959 (9 hits — mostly dynamic %; fix literals)
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | style :383 (tip — verify)
- Edit: `src/features/cx-people/components/agents-page.tsx` | styles :91 (dynamic), :93 (`height:'6%'` literal + var color)
- Edit: `src/features/cx-people/components/my-actions-page.tsx` | styles :54,88 (display/gap/flex literals)
- Edit: `src/features/cx-people/components/coaching-page.tsx` | styles :55,94
- Edit: `src/features/cx-people/components/pw.tsx` | style :106
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | styles :129,177 (`--p` — keep)
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | styles :86,231,239 (dynamic %; check :86 multi-line)
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | style :135 (marginBlock literal)
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | styles :137-325 (6 hits; e.g. `margin:0` literals)

### Context
- `src/app/styles/people.css` / `productivity.css` | receiving feature classes

### Contract
As B4-01 — statics → feature css classes with `--cx-*`; dynamics stay.

### Actions
1. `tl-tasks-page.tsx`: classify :429-959 (9 hits; mostly dynamic %); move literal statics to `people.css` classes.
2. `one-on-ones-views.tsx`: verify :383 (tip — dynamic or literal?).
3. `agents-page.tsx`: classify :91,:93 — `height:'6%'` + var color; move statics.
4. `my-actions-page.tsx`: classify :54,88 (display/gap/flex literals); move to `people.css`.
5. `coaching-page.tsx`: classify :55,94; move statics.
6. `pw.tsx`: classify :106.
7. `tph-grid-views.tsx`: verify :129,177 (`--p` — keep).
8. `pv-shared.tsx`: classify :86,231,239 (check :86 multi-line); move statics to `productivity.css`.
9. `status-validation-page.tsx`: move :135 `marginBlock` literal to `productivity.css`.
10. `productivity-analytics-page.tsx`: classify :137-325 (6 hits; e.g. `margin:0`); move statics; then `npx eslint` + `npx tsc --noEmit`.

### Done when
- remaining `style={{` hits in listed files are dynamic-only

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-people/components src/features/cx-productivity/components` -> clean

### Handoff
None.
Write results/B4-02.md (<=10 lines); TL alone updates TRACKER.md.

## B4-03: literal inline styles — cx-hub + cx-desk
Kind: mini
ID: B4-03
Parent: P1B-04
Owner: dev
Depends: B3-02, B10-01, B12-01, B13-02, B13-01
Criteria: PLAN B4
Skills: none
Budget: files=6; actions=8; changed_lines=110; minutes=10

### Goal
No `style={{` in the listed files carries a static literal; remaining inline styles are data-driven only.

### Files
- Edit: `src/features/cx-hub/components/ecosystem-scene.tsx` | style :3097 (loading-bar literal block — move to `.eco3-*` classes)
- Edit: `src/features/cx-hub/components/ecosystem-ui.tsx` | style :43 (tag positioning — check dynamic vs literal)
- Edit: `src/features/cx-hub/components/hub-shared.tsx` | styles :167,175 (skeleton % — verify), :352 (tip), :447,462 (`--n`)
- Edit: `src/features/cx-hub/components/overview-page.tsx` | styles :204,564,590 (dynamic % — verify only)
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | styles :131,876
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | style :152 (`--p` — keep)

### Context
- `src/app/styles/hub.css` / `desk.css` | receiving feature classes

### Contract
As B4-01. The `eco3` scene uses the `--eco3-*` palette (see B5-01) — classes go to `hub.css` `.eco3-*` namespace.

### Actions
1. `ecosystem-scene.tsx`: move :3097 loading-bar literal block to `.eco3-*` classes in `hub.css`.
2. `ecosystem-ui.tsx`: classify :43 tag positioning (dynamic vs literal); move if static.
3. `hub-shared.tsx`: classify :167,175 (skeleton % — verify), :352 (tip), :447,462 (`--n`); move statics.
4. `overview-page.tsx`: verify :204,564,590 (dynamic % — verify only).
5. `my-day-page.tsx`: classify :131,876; move statics.
6. `tl-performance-page.tsx`: verify :152 (`--p` — keep).
7. Add needed classes to `hub.css`/`desk.css` under the feature scope with `--cx-*` values.
8. `npx eslint` + `npx tsc --noEmit`.

### Done when
- remaining `style={{` hits in listed files are dynamic-only

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-hub/components src/features/cx-desk/components` -> clean

### Handoff
B5-03 continues on ecosystem-scene.tsx (serialized after this leaf).
Write results/B4-03.md (<=10 lines); TL alone updates TRACKER.md.

## B4-04: literal inline styles — shared ui/shell + misc
Kind: mini
ID: B4-04
Parent: P1B-04
Owner: dev
Depends: B7-04, B12-06
Criteria: PLAN B4
Skills: none
Budget: files=6; actions=7; changed_lines=80; minutes=9

### Goal
No `style={{` in the listed files carries a static literal.

### Files
- Edit: `src/features/shared/components/shell/ui.tsx` | styles :53,65,282
- Edit: `src/features/shared/components/shell/ViewAs.tsx` | style :45
- Edit: `src/features/shared/components/ui/Meter.tsx` | style :27 (dynamic width — verify only)
- Edit: `src/features/shared/components/ui/TableScroll.tsx` | style :39 (`minWidth` prop application — API behaviour, keep; verify only)
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | style :196 (dynamic % — verify only)
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | styles :165-260 (6 hits — fix literals, keep dynamics)

### Context
- `src/app/cx-kit.css` | shared-component styles live here (edit only if a shared ui.tsx/ViewAs/Meter static needs a class)
- `src/app/styles/quality.css` / `productivity.css` | feature classes

### Contract
As B4-01. `TableScroll`'s `minWidth` prop contract is intentional — do not remove it.
Out of scope: rewriting shared component style APIs.

### Actions
1. `shell/ui.tsx`: classify :53,65,282; move statics to `cx-kit.css`.
2. `ViewAs.tsx`: classify :45; move if static.
3. `Meter.tsx`: verify :27 (dynamic width — keep).
4. `TableScroll.tsx`: verify :39 (`minWidth` prop — API behaviour, keep).
5. `quality-scores-page.tsx`: verify :196 (dynamic % — keep).
6. `my-status-page.tsx`: classify :165-260 (6 hits); move literals to `productivity.css`.
7. `npx eslint` + `npx tsc --noEmit`.

### Done when
- remaining `style={{` hits in listed files are dynamic-only or the TableScroll minWidth API

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/shared/components src/features/cx-quality/components/quality-scores-page.tsx src/features/cx-productivity/components/my-status-page.tsx` -> clean

### Handoff
None.
Write results/B4-04.md (<=10 lines); TL alone updates TRACKER.md.

## B5-01: hardcoded literals — hub.css eco3 palette
Kind: mini
ID: B5-01
Parent: P1B-04
Owner: dev
Depends: none
Criteria: PLAN B5
Skills: none
Budget: files=1; actions=5; changed_lines=60; minutes=8

### Goal
`hub.css` has zero raw `#[0-9a-f]{3,8}`/`rgb()`/`rgba()` literals in declarations — the `eco3` palette lives entirely in `--eco3-*` custom properties.

### Files
- Edit: `src/app/styles/hub.css` | literals :110-172 (palette var defs + rgb() literals in `.eco3-*` rules :138,148-150,166-167,172)

### Context
- `src/app/theme.css` | `--cx-*` token conventions; `--eco3-*` stays a feature-scoped palette
- `src/features/cx-hub/components/ecosystem-scene.tsx` | consumer (edited by B5-03 after this leaf)

### Contract
Convert every raw `rgb()`/`#hex` used inside `.eco3-*` rule declarations into `--eco3-*` var references (extend the existing palette block :110-116). Palette var *definitions* may keep literal values (that's where the value lives) — only declaration-site literals move. Add a one-line comment marking the palette as the intentional eco3 token block.
Out of scope: ecosystem-scene.tsx (B5-03), other css files.

### Actions
1. Extend the `--eco3-*` palette block (:110-116) with vars for every literal used in `.eco3-*` declarations; add one-line `/* eco3 palette tokens */` comment.
2. Replace `rgb()`/`hex` literals in `.eco3-*` rules :138,148-150 with var references.
3. Replace literals in `.eco3-*` rules :166-167,172 with var references.
4. Re-grep the file: literals remain only inside `--eco3-*` var definitions.
5. `npx eslint` (stylelint if configured) + `npx tsc --noEmit` unaffected check.

### Done when
- `grep -n "#[0-9a-fA-F]\{3,8\}\|rgba\?(" src/app/styles/hub.css` → hits only inside `--eco3-*` definitions

### Verify
- Run: `npx tsc --noEmit` -> clean; ecosystem page renders unchanged (visual check)

### Handoff
`--eco3-*` var names published for B5-03 (ecosystem-scene.tsx literal migration).
Write results/B5-01.md (<=10 lines); TL alone updates TRACKER.md.

## B5-02: hardcoded literals — productivity.css + quality.css
Kind: mini
ID: B5-02
Parent: P1B-04
Owner: dev
Depends: none
Criteria: PLAN B5
Skills: none
Budget: files=2; actions=4; changed_lines=50; minutes=7

### Goal
`productivity.css` and `quality.css` have no unexplained raw color literals — the `--tph-*` chart palette is consolidated/documented, and the `#fff` fallback is justified or tokenized.

### Files
- Edit: `src/app/styles/productivity.css` | `--tph-*` palette defs :74,77-78 (keep as token block; ensure no other literal declarations — audit `border-radius:[0-9]`/`box-shadow:[0-9]` hits too)
- Edit: `src/app/styles/quality.css` | `fill:var(--cx-surface, #fff)` :116 + `border-radius`/`box-shadow` literal audit

### Context
- `src/app/theme.css` | token conventions

### Contract
Keep `--tph-c*`/`--tph-a*` custom-property definitions (they ARE tokens) — add a one-line `/* tph chart palette */` comment; fix any literal `border-radius`/`box-shadow`/color used directly in declarations (e.g. `border-radius:3px` where a `--cx-radius-*` token fits, `#fff` fallback → `var(--cx-surface)` alone or token fallback).
Out of scope: other css files.

### Actions
1. `productivity.css`: add `/* tph chart palette */` comment on the `--tph-*` block :74,77-78 (kept as token defs).
2. `productivity.css`: replace declaration-site literal colors/`border-radius`/`box-shadow` with tokens/nearest vars.
3. `quality.css`: fix `fill:var(--cx-surface, #fff)` :116 fallback + any literal `border-radius`/`box-shadow` hits.
4. `npx tsc --noEmit`.

### Done when
- `grep -n "#[0-9a-fA-F]\{3,8\}\|rgba\?(\|border-radius:\s*[0-9]\|box-shadow:\s*[0-9]" src/app/styles/productivity.css src/app/styles/quality.css` → hits only inside var definitions or documented px-exact comments

### Verify
- Run: `npx tsc --noEmit` -> clean

### Handoff
None.
Write results/B5-02.md (<=10 lines); TL alone updates TRACKER.md.

## B5-03: hardcoded literals — ecosystem-scene.tsx
Kind: mini
ID: B5-03
Parent: P1B-04
Owner: dev
Depends: B4-03, B5-01
Criteria: PLAN B5
Skills: none
Budget: files=1; actions=7; changed_lines=120; minutes=10

### Goal
`ecosystem-scene.tsx` has no raw `#[0-9a-f]{3,8}`/`rgb()`/`rgba()` literals outside the intentional 3D-scene material constants — CSS-facing colors use `--eco3-*`/existing vars.

### Files
- Edit: `src/features/cx-hub/components/ecosystem-scene.tsx` | 88 literal hits :119-2738 (audit; migrate CSS-facing colors to vars, keep documented three.js material colors)

### Context
- `src/app/styles/hub.css:110-172` | `--eco3-*` palette (post B5-01)

### Contract
Migrate CSS-facing style colors (tag/tooltip/overlay styles) to `--eco3-*` var references via the established `style={{ '--x': … }}` pattern or `var(--eco3-…)` strings. Keep three.js material/lighting constants that have no token equivalent — mark that block with `/* 3D-scene palette: intentional raw colors, no DOM token equivalent */`.
Out of scope: hub.css (B5-01 done it), other files.

### Actions
1. Grep the 88 literal hits; classify each as DOM-style (style props, tag/tooltip/overlay colors) vs three.js material/lighting internals.
2. Migrate DOM-facing color literals to `var(--eco3-*)` references or `--var` setters.
3. Migrate remaining DOM-facing rgba()/gradient literals.
4. Mark the scene-internal palette block with `/* 3D-scene palette: intentional raw colors, no DOM token equivalent */`.
5. Re-grep: remaining hits confined to the annotated block.
6. `npx eslint` + `npx tsc --noEmit`.
7. Render the ecosystem page once; confirm unchanged visuals.

### Done when
- `grep -n "#[0-9a-fA-F]\{3,8\}\|rgba\?(" <file>` → remaining hits confined to the annotated scene-palette block

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-hub/components/ecosystem-scene.tsx` -> clean

### Handoff
None.
Write results/B5-03.md (<=10 lines); TL alone updates TRACKER.md.

## B6-01: transition:all — no-op verification
Kind: mini
ID: B6-01
Parent: P1B-04
Owner: dev
Depends: none
Criteria: PLAN B6
Skills: none
Budget: files=0; actions=1; changed_lines=0; minutes=2

### Goal
Confirm zero `transition: all`/`transition-all` usage (audit grep found none in src).

### Files
- None (verification only)

### Actions
1. `grep -rn "transition:\s*all\|transition-all" src` → confirm 0 hits; record in results.

### Done when
- grep returns 0 hits

### Verify
- Run: `npx tsc --noEmit` -> clean (unchanged baseline)

### Handoff
Status recorded → index keeps B6 marked `no-op`.
Write results/B6-01.md (<=10 lines); TL alone updates TRACKER.md.

## B11-01: BootSplash z-index → token
Kind: mini
ID: B11-01
Parent: P1B-04
Owner: dev
Depends: none
Criteria: PLAN B11
Skills: none
Budget: files=1; actions=2; changed_lines=5; minutes=3

### Goal
`BootSplash.tsx`'s raw `z-index:50` uses the theme token scale.

### Files
- Edit: `src/features/shared/components/shell/BootSplash.tsx` | `.boot-splash{…z-index:50…}` :9

### Context
- `src/app/theme.css:117-119` | `--z-toast:40`, `--z-modal:60` — the scale; BootSplash must sit above everything pre-paint

### Contract
Replace `z-index:50` with `z-index:calc(var(--z-modal) + 10)` (or add a `--z-splash` next to the theme tokens — prefer reusing, no new token unless needed). All other z-index values in src are ≤10 (allowed) or already `var(--z-*)`.
Out of scope: other files.

### Actions
1. Swap `z-index:50` for the token expression.
2. `npx tsc --noEmit`; reload and confirm splash still covers the app.

### Done when
- `grep -rn "z-index:\s*[0-9][0-9]" src` → 0 hits

### Verify
- Run: `npx tsc --noEmit` -> clean

### Handoff
None.
Write results/B11-01.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
All 9 child leaves done; `style={{` literals eliminated outside documented dynamic/palette sites, feature css declarations use tokens, `transition:all` confirmed absent, no raw z-index >10.
