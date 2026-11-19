# Page Frame Contract

Every routed page renders through `PageShell`
(`src/features/shared/components/ui/PageShell.tsx`). This document is the
contract of record for how a page head is composed; it exists so any future
page conforms without reading source. Token values below are the real custom
properties from `src/app/theme.css`, consumed by rules in
`src/app/refresh.css` (`.page-head`, `.page-actions`, `.page-bar`,
`.page-stats`, `.page-loading`) and `src/app/cx-kit.css` (`.main`,
`.page-purpose` base type, `.stat`, `.spinner`).

## Slot order

`PageShell` renders, top to bottom:

1. `kicker` — `<p class="kicker">` above the title (eyebrow label).
2. `title` — `<h1 class="page-title">`, the only `h1` on the page.
3. `sub` — `<p class="page-purpose">`, one-line description; `purpose` is a
   back-compat alias and `sub` wins when both are passed.
4. `actions` — right end of the `.page-head` row, wrapped by PageShell in
   `<div class="page-actions">`. `aside` is a legacy alias rendered bare
   (callers wrap it themselves); new code uses `actions`.
5. `toolbar` + `status` — optional `.page-bar` row: tools left
   (`.page-bar__tools`), freshness/status notes right
   (`.page-bar__status`, pushed by `margin-inline-start: auto`). Renders only
   when at least one of the two props exists.
6. `stats` — optional `.page-stats` KPI strip; renders only when passed.
7. `children` — page body. `busy` → `LinesSkeleton`; `error` → `Failed`
   with `onRetry`; `id`/`aria-labelledby`/`className`/`aria-busy` semantics
   are unchanged.

## Token geometry

All values are tokens — never hard-code px or hex.

| Element | Tokens |
|---|---|
| Page inset (`.main`) | `padding: var(--main-pad) var(--gutter)` = `clamp(1.25rem,2.5vw,2rem)` / `clamp(1rem,2.5vw,3rem)`; uniform across apps |
| `h1.page-title` | `font-size: var(--text-title)` = `clamp(1.5rem,1.25rem + .9vw,2.125rem)`; `line-height: var(--lh-tight)` (1.2); `font-weight: 700`; `letter-spacing: -.02em` |
| `p.page-purpose` (`sub`) | `font-size: var(--cx-text-md)`; `line-height: var(--lh-snug)` (1.35); `color: var(--cx-ink-2)`; `max-inline-size: 62ch`; 2-line clamp (`-webkit-line-clamp: 2`) |
| `.kicker` | `font-size: var(--cx-text-xs)`; `font-weight: var(--w-strong)`; `letter-spacing: .08em`; uppercase; `color: var(--cx-accent-text)` |
| `.page-head` | `display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: var(--cx-space-4) var(--cx-space-6); margin-bottom: var(--cx-space-5)`; shrinks to `margin-bottom: var(--cx-space-3)` when a `.page-bar` follows (`:has(+ .page-bar)`) |
| `.page-actions` / `.page-bar__tools` | `display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2)` |
| `.page-bar` | `display: flex; flex-wrap: wrap; align-items: center; gap: var(--cx-space-3) var(--cx-space-6); margin-bottom: var(--cx-space-5)` |
| `.page-bar__status` | `margin-inline-start: auto`; `gap: var(--space-2)`; `font-size: var(--cx-text-xs)`; `color: var(--cx-ink-3)` |
| `.page-stats` | `display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: var(--cx-space-4); margin-bottom: var(--cx-space-5)` |
| `.stat` card (inside `stats`) | unchanged: `--cx-surface` bg, `--cx-line` border, `--cx-radius-object`, padding `.95rem 1.1rem`, `--shadow-1`; label `--cx-text-xs`, value `--cx-text-2xl`, delta `--cx-text-xs` |

At 375 px the head wraps naturally (flex-wrap); the frame stacks
head → bar → stats → body with no horizontal scroll.

## Placement rules

- **`actions`** — primary/refresh buttons and one-shot actions only
  (`RefreshButton`, export/create buttons). Right of the title, never above it.
- **`toolbar`** — filters, search inputs, `Seg` pickers, date pickers that
  scope the page data.
- **`status`** — freshness notes (`AsOf`, `lastAuto`), `role="status"` hints.
  Never above the title.
- **`stats`** — `.grid`-style `.stat` KPI cards only; keep the `.stat` markup
  verbatim, drop the manual grid wrapper.
- Do not hand-roll `.page-actions` wrappers or duplicate `page` in
  `className` — `PageShell` supplies both.

## Spinner and RefreshButton

- **`Spinner`** (`ui/Spinner.tsx`, exported from the ui barrel):
  `Spinner({ label = 'Loading…', className })` renders a `role="status"`
  `.spinner` ring with a `.cx-sr` label. Server-safe — usable from
  `loading.tsx`. Route fallbacks render
  `<div className="page-loading"><Spinner /></div>`; `.page-loading` is a
  centered `min-block-size: 40vh` grid whose reveal is delayed `.15s` (no
  sub-150 ms flash) and whose spin stops under
  `prefers-reduced-motion` / `[data-reduce-motion]`.
- **`RefreshButton`** (`ui/RefreshButton.tsx`): the single refresh/status
  control. Props `{ refresh, onDone, btnClassName? }` where
  `refresh: () => Promise<{ refreshed?, synced_to?, message?, retryInS? }>`
  returns the fetch result and `onDone` runs after a successful refresh.
  It owns the cooldown countdown (`Refresh now` → `Refreshing…` →
  `Refresh again in N s`), the Kuwait-time `synced_to` hint, and the
  `role="status"` message strip inside `.cx-refresh`. Legacy `RefreshNow`
  (cx-queue) and `Hf` (cx-hub) remain as thin delegating wrappers — pass only
  the fetch function; do not re-implement cooldown logic.
- `PageShell`'s own `busy` state still uses `LinesSkeleton`; `Spinner` is for
  route/segment loading, not inline busy.

## Migration recipe (old `aside` → slots)

1. Buttons/primary actions → `actions` (PageShell wraps in `.page-actions`).
2. Filters/`Seg`/search/selects/date pickers → `toolbar`.
3. Freshness/`role="status"`/hint notes → `status`.
4. `.grid.grid-N > .stat` KPI rows → `stats` (drop the grid wrapper).
5. `purpose=` → `sub=`; `kicker` out of `title` markup into the `kicker` prop.
6. Drop manual `.page-actions` divs and bespoke head classes
   (`aging-page-head`, `md-head-actions`, `kicker--block`); keep page marker
   classes (`cxp`, `md-page`, `pw-page`, `dk`) and `id="page-title"`.
7. Keep `busy`/`error`/`onRetry` wiring and conditional rendering verbatim.

## Invariants

- DOM order inside `.page-head` is fixed: kicker → `h1.page-title` →
  `p.page-purpose`, with `.page-actions` at the row end.
- `.page-bar` renders only when `toolbar` or `status` exists; `.page-stats`
  only when `stats` exists.
- All geometry comes from `--cx-*`/`--space-*`/`--text-*` tokens; no literal
  px or hex in frame rules.
- `/ecosystem` (`.eco3`) is exempt — bare chrome outside `.main`.
- Verified by `e2e/page-frame.spec.ts` (cross-page coordinate equality,
  ±2 px at 1024/1440, 375 px stacking) and the nav-splash spec asserting
  `.page-loading .spinner` is the only wait cue.

Source of truth for implementation: `src/features/shared/components/ui/PageShell.tsx`,
`src/app/refresh.css` (frame slots + `.page-loading`),
`src/features/shared/components/ui/{Spinner,RefreshButton}.tsx`.
Spec rationale: `specs/unified-page-format/DECISION.md`.
Related: `docs/UI-SYSTEM.md` (tokens, components, theming).
</content>
</invoke>','file_path':'C:\Users\AHMED\KPIs\CX-Hub\docs\PAGE-FRAME.md