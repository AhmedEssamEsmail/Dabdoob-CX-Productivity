# tl-7 — FIX round 4: NAV overhaul (spec/NAV/user-nav-round.md, NAV-1..4)

## Dispatch
| Leaf | Owner | Files | Status |
|---|---|---|---|
| NAV-01 | dev | src/features/shared/components/shell/AppShell.tsx | done — all GROUP_ORDER groups render inline via `navVisible` (pageAllowed, no inApp filter); `.nav-group-label` is now a `<button>` w/ `.nav-chevron`, aria-expanded/controls, `hidden` ul; open-set in `sessionStorage['cx.nav-groups']`; current-route group auto-expands (adjust-during-render); cross-app jump branch, `.nav-ext`, `nav-group--app`, `nav-link--off`, all `target="_top"` removed — brand/cx-note/"Open the Hub" links also client-side via `navigate()`; dead imports (`groupEntryLink`, `GROUP_DEFAULT_PAGE`, `isAdmin`) dropped. ~185 diff lines (budget 180, 1 file). |
| NAV-02 | dev | src/app/refresh.css | done — 7 `:root` rules appended: label button-reset at mockup metrics (.6563rem/650/.07em uppercase), hover/focus-visible, `.nav-chevron` + `[aria-expanded="false"]` rotate(-90deg), `ul[hidden]`, rail-off icon-only (label text hidden, chevron+aria-label keep it operable). `.nav-link`/`--cx-target` untouched (density contract). |
| NAV-03 | test-engineer | e2e/nav-collapse.spec.ts (new) | done — 4 deterministic tests: header toggle, sessionStorage persistence across client nav, SPA no-reload proof (`__navStay` marker + `.boot-splash` hidden + aria-current), mobile `.nav-open`+toggle at 375px. |

## Notes for reviewer (DELTA scope)
- Changed files this round: `src/features/shared/components/shell/AppShell.tsx`, `src/app/refresh.css` (appended nav rules only), `e2e/nav-collapse.spec.ts` (new). Results: `results/NAV-01..03.md`.
- "Not connected" off-state dropped as authorized — `resolveLink` can never return `missing` for registry paths in the unified app (dead branch). `groupEntryAllowed`/`resolveLink`/`groupEntryLink` stay exported in gates.ts per non-goal.
- Item gating = `pageAllowed` exactly as spec'd ("role gating via pageAllowed/visible"); zero-item groups don't render.
- BootSplash untouched (layout.tsx) — removing `_top` makes replay impossible on nav clicks; page skeletons (`.cc-skel*`) are page-owned and unaffected.
- `#nav`, `.nav-link`, `aria-current="page"`, `.nav-ind`, `data-tone`, `data-app`, `NavIcon`, `D()` strings, rail-off + `.nav-open` all preserved.

## Integration gates (checkpoint-fix4)
- `npx tsc --noEmit` — PASS (clean)
- `npx eslint . --quiet` — PASS (0 errors)
- `npx vitest run` — 1119/1119 PASS
- `npm run test:e2e` — 84p/12f/9s; all 12 failures were remote-Supabase login flakes under parallel load (incl. pre-existing my-status/status-validation specs; error snapshots show bounced sessions on /auth/login, no nav in DOM). `npx playwright test --last-failed` retry: **11p/1s/0f — net PASS**. New spec alone: 20/20 across 5 projects, run twice by owner.
- Shots (`node .devin/work/shoot-new.mjs`) and full build: not run — visual reshoot left for UX gate per spec's "reshoot rail in light+dark".

## Blocked / needs user
- (none)
