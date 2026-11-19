# DECISION: unified-page-format

Context: 44 `src/app/**/page.tsx` (no route groups), Next 16.4.6 + React 19, `instant=false`. Heads diverge (bespoke `aging-page-head`, `.cxp`, per-app `.main` padding) and the Dabdoob splash flashes on client nav. Constraints: `--cx-*`/`--space-*` tokens only, no deps, no page-internals redesign.

Options:
 A) Extend `PageShell` into the one slot API + add root `loading.tsx` + one-way splash latch. Pros: fixes root cause, additive/back-compat; Cons: 39-page sweep.
 B) Keep single boundary, only latch the splash CSS. Pros: tiny; Cons: shell still unmounts/remounts on nav (rail flicker, state loss) — treats symptom.
 C) Move a `<Suspense>` inside `AppShell` around `{children}` only. Works, but `loading.tsx` is the idiomatic Next 16 segment boundary and gives per-route control later.

Decision: A — kills both the trigger (boundary topology) and the symptom (latch), matches PLAN's suggested mechanism, zero deps.

## Splash root cause (verified in code)
`BootSplash` is a permanent sibling after `<div id="app">` (`app/layout.tsx:72-75`), never unmounted — hidden ONLY by `#app:not(:empty)+.boot-splash` (`BootSplash.tsx:10`). Everything in `#app` hangs off ONE boundary: `SiteChrome`'s `<Suspense fallback={null}>` (`SiteChrome.tsx:22`) → `SiteChromeBody` (`usePathname`, :29) → `AppShell` (`useSearchParams`, :124) → pages. **No `loading.tsx` exists under `src/app`** (verified: 0 files), so when a navigation suspends — the new page's segment resolving, or a sync commit React can't hold as a transition — the only catcher is this app-wide boundary; it falls back to `null`, shell + content unmount, `#app` becomes `:empty`, splash reappears. Secondary path: `if (!boot) return null` (`AppShell.tsx:379`). Hypothesis CONFIRMED: visibility is a pure function of `#app:empty`, and the topology guarantees it empties.

Fix: (1) new `src/app/loading.tsx` → Next places the boundary between layout and page; page suspensions never reach the shell boundary; shell stays mounted. (2) Latch in `SPLASH_CSS`: add `#app[data-booted]+.boot-splash{display:none}`; `SiteChromeBody` mount effect sets `#app[data-booted]` once → splash can never return even if `#app` empties (covers the `!boot` path too). (3) `Spinner` (ui/): reuse `.spinner`/`@keyframes spin` (`cx-kit.css:231,1544`), add `role="status"` + `.cx-sr`, delayed reveal `animation: .15s ease .15s backwards` (no <150ms flash), `@media (prefers-reduced-motion:reduce)`/`[data-reduce-motion]` → no spin. Cold-load splash stays (pre-JS paint) but is now one-shot.

## Page Frame slot API — extend `ui/PageShell.tsx` (keep `PageHead`/`Head`/`aside`→`actions` aliases)
`title` (h1 `.page-title`) · `kicker?` (`.kicker` above h1) · `sub` (`.page-purpose`, alias `purpose`, line-clamp 2) · `actions` (`.page-actions`, right of title) · `toolbar` (`.page-bar__tools`, bar row left: filters/seg/search) · `status` (`.page-bar__status`, bar row right, `margin-inline-start:auto`) · `stats` (`.page-stats`) · `busy`/`error`/`onRetry`/`id`/`className`/`children` unchanged. `.page-bar`/`.page-stats` render only when their props exist.

Tokens (all existing): inset `.main{padding:var(--main-pad) var(--gutter)}` = `clamp(1.25rem,2.5vw,2rem)` / `clamp(1rem,2.5vw,3rem)` (theme.css:95-96; DELETE `[data-app="people"] .main` override, people.css:264 — it breaks uniformity). h1 `--text-title` clamp(1.5→2.125rem), `--lh-tight`, w700, ls -.02em. sub `--cx-text-md`/`--lh-snug`/`--cx-ink-2`/62ch. head `gap:var(--cx-space-4) var(--cx-space-6)`, `align-items:flex-end`, `mb:var(--cx-space-5)`; `:has(+.page-bar)` → `mb:var(--cx-space-3)`. actions/bar-tools `gap:var(--space-2)`. bar `gap:var(--cx-space-3) var(--cx-space-6)`, `mb:var(--cx-space-5)`; status `--cx-text-xs`/`--cx-ink-3`. stats `repeat(auto-fit,minmax(11rem,1fr))`, `gap:var(--cx-space-4)`, `mb:var(--cx-space-5)`; card `.stat` unchanged (`--cx-surface`/`--cx-line`/`--cx-radius-object`/.95rem 1.1rem/`--shadow-1`; l `--cx-text-xs`, v `--cx-text-2xl`, d `--cx-text-xs`). `.cx-refresh` unchanged (btn `min-inline-size:11rem`).

`RefreshButton` (ui/): `{refresh:()=>Promise<{refreshed?;synced_to?;message?;retryInS?}>, onDone}` — merges identical `RefreshNow` (cx-queue/shared.tsx:365) + `Hf` (hub-shared.tsx:549); callers pass only the fetch fn; legacy names re-export (parity rule).

Risks & mitigations: 39-page pixel sweep → sharded per-app + new `e2e/page-frame.spec.ts` (2px tol @1024/1440, 375 stack); `aside` alias makes partial migration safe. `.aging-page-head`/`ag-actions-full` CSS removed only after last usage migrates (aging, queue, my-day, tph-grid). `loading.tsx` flash on instant nav → 150ms delayed spinner. Debug leaf first: confirm exact suspend trigger; only then split `useSearchParams` boundary further.

Rollback: additive props + CSS; git-revert pages, delete `loading.tsx`, revert latch line.

Impacts on PLAN: keep cold-load splash (decided: one-shot latch, not removal). Flags: `ui tests docs arch perf`; no `db auth deps deploy`. Add risk: `[data-app="people"] .main` padding normalization.

Open questions: none blocking.
