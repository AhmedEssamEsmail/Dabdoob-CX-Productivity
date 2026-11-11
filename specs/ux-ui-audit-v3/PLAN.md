# UX/UI Audit v3 — Megaplan

Successor to `docs/UX-UI Improvement v2.md`. v2 audited once and fixed once;
bugs came back because findings were instance-level and nothing prevented
regression. This plan fixes **bug classes**, verifies **every page** with a
bounded checklist, and locks results with **regression tests**.

Branch: `feat/cx-hub-ui-redesign`. Every fix lands with typecheck + lint + the
page's layout spec green.

---

## Phase 1 — Pattern sweeps (fix the class, not the instance)

Each row is one mini-shard (<=10 files, one grepable pattern, PASS = grep zero
hits + targeted vitest + browser check at 375/1024px where visual).

### A. Known classes (found in this session's fixes)

| ID | Pattern | Search | Fix standard |
|----|---------|--------|--------------|
| A1 | Unstyled section-nav links | `SettingsToc` consumers | `.cx-toc` renders; links have hover + focus-visible states |
| A2 | Toolbar/layout shifts when a control's label or state changes | `cx-refresh`, refresh buttons with inline status text, `useState` toggles that swap text | dedicated toolbar row, fixed-width button cell, status on its own row (the `refresh.css` `.aging-page-head` pattern) |
| A3 | Raw controls bypassing shared UI | bare `<input`, `<select`, `<textarea`, `<button` outside `shared/components/ui` | route through shared `Input`/`Select`/`Textarea`/`Button` |
| A4 | Cramped panels | `narrow=` on `PageShell`; settings sections without `.cx-settings-section` | remove narrow; panels get token padding + responsive form grid |
| A5 | Obsolete legacy/GAS UI | `script.google.com`, `gas`, `exec?`, `connected apps`, `Im`-style url lists | delete the UI (config storage untouched) |
| A6 | Fixed px widths that break small screens | `width|min-width|max-width:\s*\d+px` in `src/app/styles/*.css`, inline `style={{width` | tokens/clamp/%/flex; verify no h-scroll at 375px |
| A7 | `sr-only` vs `cx-sr` stragglers | `sr-only` in className | `cx-sr` (rule already errors — residual check only) |

### B. New classes to sweep

| ID | Pattern | Search | Fix standard |
|----|---------|--------|--------------|
| B1 | Broken/unstyled links (the "corrupted hyperlinks" class) | `<a ` without class or outside nav; `href="#"` | real link styling or `<button>` if it's an action |
| B2 | Icon-only buttons with no accessible name | `<Button[^>]*>\s*<[A-Z][a-zA-Z]*\s*/>` / `aria-label` absent | `aria-label` or visible text |
| B3 | Missing empty/loading/error states | pages rendering `data.map` with no `Empty`/`PageStates` | shared `Empty`/`PageStates` components |
| B4 | Inline styles duplicating tokens | `style={{` with color/spacing/font literals | move to CSS class + `--cx-*` token |
| B5 | Hardcoded colors/shadows/radii | `#[0-9a-fA-F]{3,8}`, `rgba?(`, `box-shadow`, `border-radius` literals in TSX/CSS outside `cx-kit.css`/`theme.css` | design tokens |
| B6 | `transition: all` | `transition:\s*all` | explicit properties |
| B7 | Tables that overflow/collapse at mobile | `.tbl`, `<table` usages without a scroll wrapper | horizontal-scroll wrapper or stacked-card pattern at <768px |
| B8 | Heading hierarchy jumps | `h1..h6` order per page | single h1, no level skips |
| B9 | Modal/dialog inconsistencies | custom `position: fixed` overlays vs shared dialog | shared dialog primitive |
| B10 | Form fields without labels | `<input|<select|<textarea` without `htmlFor`/aria-label | label or `aria-label` |
| B11 | Z-index chaos | `z-index:` values > 10 | token scale (base/overlay/modal/toast) |
| B12 | Duplicate page-header markup | per-feature `page-head`/title blocks | single shared `PageShell` head API |
| B13 | Loading-state layout shift (CLS) | conditional `{loading ? null : <X>}` that resizes parent | skeleton placeholder matching final size |
| B14 | Disabled/readonly controls that look identical to enabled | `disabled`/`readOnly` without `.cx-*` state class | visible disabled state |
| B15 | Buttons used as links / links used as buttons | `<a onClick`, `<button` doing `router.push`/`location.href` | correct element per action vs navigation |
| B16 | Truncation/text-clipping | `text-overflow|ellipsis|line-clamp` without title/tooltip | `title` attr or accessible full text |
| B17 | Number/date formatting inconsistencies | `toLocaleString|toFixed|Intl.` scattered | shared format helpers where they exist |
| B18 | Focus-visible missing on custom controls | `[tabindex]`, `role="button"` without `:focus-visible` style | visible focus ring |

**Gates per shard:** `npx eslint <files>` 0 warnings, `npx tsc --noEmit`,
page loads at 375/1024 with no h-scroll. **UX gate:** ux-ui-expert PASS.

---

## Phase 2 — Page-by-page visual sweep (sharded, bounded checklist)

Split app into 8 packages by feature dir (cx-desk, cx-hub, cx-operations,
cx-people, cx-productivity, cx-quality, cx-queue, shared/shell). For each page
in each package, a ux-ui-expert agent runs in browser at **375 / 768 / 1024 /
1440 px** and answers only these 8 questions (PASS/FAIL + screenshot evidence):

1. Header/toolbar stays put across loading → loaded → error → empty states (click refresh/toggle; anything jump?)
2. Every control is a shared component, labeled, keyboard-focusable, visible focus ring
3. No unstyled/raw links, buttons, inputs, or leftover legacy UI
4. No overflow, overlap, clipped text, or horizontal scroll at any width
5. Empty/loading/error states exist and look designed (not a raw string)
6. Spacing/typography consistent with the `--cx-*` scale; no hardcoded values visible in DOM styles
7. Heading hierarchy sane; landmark regions present (nav, main, labelled sections)
8. Interactive states distinct: hover, disabled, selected, active, error

FAILs become fix shards (same mini-shard limits), each verified by re-running
the same 8 questions. PASS pages recorded in `results/ux3-<pkg>.md`.

**Route inventory:** enumerate `src/app/**/page.tsx` at shard time — do not
hand-list; some routes are auth/role-gated and need fixture login (reuse the
existing e2e login helpers).

---

## Phase 3 — Regression lock-in (make it impossible to come back)

| ID | Guard | Detail |
|----|-------|--------|
| C1 | Page-contract e2e spec | `e2e/page-contract.spec.ts`: parametrized over the route inventory; per route asserts at 375+1024px: no `document.documentElement.scrollWidth > innerWidth`, header toolbar bounding-box identical before/after clicking its primary action, no console errors, every `<input/select/textarea>` has an accessible name, every `<button>` has accessible name |
| C2 | Per-bug-class specs | one spec per Phase-1 fix that reproduces the original bug (pattern: `e2e/aging-refresh-layout.spec.ts`, `e2e/heatmap-time-layout.spec.ts`) — toolbar stability, toc link styling, settings width, connected-apps absence, input sizing |
| C3 | Lint rules for the new classes | extend `eslint.config.mjs` local rules where a class is statically detectable: `transition: all` in strings (B6), hardcoded hex in className strings (B5-lite), raw `<input>`/`select` outside shared/ui (B3-lite) — warn first, error after burn-in |
| C4 | Design-token guard | script or lint rule flagging new `style={{...}}` literals containing `#hex`, `px`, `rgb(` in features/ (B4) |
| C5 | Definition-of-done | add to `AGENTS.md`: "a page isn't done until the 8-question contract passes at 375/1024" — prevents new pages shipping unstyled |
| C6 | Visual diff baseline (optional) | Playwright screenshot snapshots per route at 2 widths; update on intentional change |

**Exit criteria for the whole plan:**
1. `npm run lint` 0 warnings (already true — keep it that way)
2. Every route in the inventory has a PASS row in `results/`
3. `e2e/page-contract.spec.ts` green across all routes
4. No Phase-1 pattern grep returns hits

## Phase 1B grep census (spec-architect, 2026-11)
- B1 `<a `: 19 files; `href="#"` 0. Shared `.cx-link` class does NOT exist (foundation leaf adds it; `.qa-link` is quality-local).
- B2: `variant="icon"`, `<Button>‹Icon/›`, `cx-btn--icon` consumers = 0 → no-op. B6 `transition:all` = 0 → no-op.
- B3: `.map(` in 63 component files; 15 lack `Empty`/`PageStates` import. B7 `<table` = 34 tsx files; `TableScroll` adopters = 8. `.tbl` class = 0.
- B10: 17 feature files with raw `<input|select|textarea` (heatmap 8 hits, admin-page 5). B9: 3 hand-rolled `<dialog>` (trackers, heatmap, tph-grid-matrix); ViewAs/Popups already use `useDialogModal`.
- B11: raw `z-index` values are 1,2,50 — only BootSplash:9 `50` exceeds 10 (`--z-toast:40`,`--z-modal:60` exist in theme.css).
- B14: `disabled`/`readOnly` on RAW elements = 3 files (trackers, queue-page, CommandPalette); 19 `:disabled` css rules exist.
- B12: 28 feature files contain `page-head|page-title` strings (raw markup confirmed, e.g. trackers:804-811); `PageShell` API covers title/purpose/aside.
- B13: `? null` = 28 files; loading-conditional subset ≈ 11 files. B16: truncation-class consumers = 14 files. B18: `tabIndex|role="button"` = 25 files; universal `:focus-visible` rule exists at cx-kit.css:120.
- B4 `style={{` = 29 files; majority are dynamic (`--var` setters, `%` positions) — leaves fix literals only. B5 literal colors: hub.css eco3 palette, productivity.css `--tph-*` defs, quality.css `#fff` fallback, ecosystem-scene.tsx (88 hits, three.js internals annotated), BootSplash (documented exception).
- B17: `fmt` duplicated in cx-queue + cx-people `shared.tsx`; `formatDate_` in adapters.ts → new `shared/lib/format.ts`.

## Execution notes

- Sequencing: Phase 1 first (cheap, covers most pages at once), Phase 2 only
  finds what patterns missed, Phase 3 lands after fixes stabilize.
- Mixed-WIP files: stage lint/UI hunks only (the `git apply --cached` hunk
  workflow used for the lint commits) — the perf-pushdown work is in-flight.
- Do not restyle by deleting comments or adding `eslint-disable`; fix causes.
- Track status in this folder: `TRACKER.md` per shard ID, `results/<shard>.md`.
