# tl-6 — FIX round 3 (user-fix-round.md: UF-1, UF-2, UF-3)

Verdict for review: all 3 findings routed, implemented, gates green.
Preflight: 6 leaves, 6/6 structural PASS + semantic vs LIMITS (1 reword — a
quoted CSS section title "Stragglers" tripped the open-ended heuristic).

## Changed files (DELTA scope for reviewer)

| Leaf | Files | What changed |
|---|---|---|
| FUX-10 (UF-1) | `src/app/refresh.css`, `src/app/styles/queue.css`, `src/app/styles/operations.css` | ~80 `.dq-*` rules + `.trk-table` rules moved VERBATIM to refresh.css as `:root` selectors (deleted from the scoped sheets; combined `.trk-num` rule split, `.input/.cx-input.trk-num` kept scoped) |
| FUX-11 (UF-2) | `src/features/cx-people/lib/scorecard/index.ts`, `scorecard-server.ts`, `tests/golden/scorecard.test.ts` | new pure `scTrend_` (8 equal-width time buckets of per-day `overall` via `scDayRows_`); `getScorecardPage` returns `agents[i].trend` + top-level `prevTeam` (mean `overall` of prior equal-length window via `io.readRange` + `scAggregate_` — 0 new queries); +2 tests |
| FUX-12 (UF-2) | `src/features/cx-people/components/agents-page.tsx` | `Trend · 8w` `.spark` column between Behaviour and KPI score (8 bars, null bucket = gray stub, `role="img"` + aria-label, missing trend = `–`); `.avatar` initials in Agent cell; Behaviour column `.pill` (op-loss bad / N cases warn / no log / clean); Team-KPI `.stat-d` `.delta` chip vs `prevTeam` + `D('vs prior period')`; colSpan 15 |
| FUX-13 (UF-2) | `src/features/cx-people/components/agents-page.tsx` | `Seg` -> `.tabs` 4-tab chrome (Stack ranking / Agent detail / Workbook imports / How scoring works, `role="tab"` + `aria-selected`); workbook tab admin-gated; `ScorecardAdmin` + scoring-explainer `<p>` moved into their panes; My-team-only switch kept; agent scope unchanged |
| FUX-14 (UF-3) | `src/app/refresh.css` | ux-9 `.cpk-input` restyled as the bare input (dead `.cpk-input input` selector deleted, placeholder+focus-visible added); ux-10 `.topbar .crumbs` + `.ag-t` -> `--cx-ink-2`; ux-11 `.rail-search` min-height 36px + nowrap, `.rail-search-label` ellipsis, `.rail-off` icon-only |
| FUX-15 (UF-3) | `src/features/shared/components/shell/AppShell.tsx`, `specs/legacy-parity/data/legacy-i18n-ar.json` | ux-11 label wrapped in `.rail-search-label` span; ux-12 platform-aware kbd (`⌘K` SSR, `Ctrl K` post-mount non-Mac, hydration-safe); ux-14 falling-edge `useEffect` on `paletteOpen` restores focus on ALL close paths (`onClose` simplified); ux-13 4 AR keys added |

## Findings status

- **UF-1 done**: `.dq-*`/`.trk-table` now resolve on every app. TL sweep
  (preflight + worker re-grep): cross-app hits were only `.dq-*` and
  `.trk-table`; `pw-seg`/`oo-alert*`/`cc-*`/`ag-*` already global;
  `md-*` sets are per-app; `md-aside`, `md-table`, `md-mail*` are dead
  classes/ids never styled in prod either — not regressions.
- **UF-2 done**: spark is real data — per-day `overall` from `sc_daily`
  already prefetched by `scIo_` (S04-22's "no series" gap closed without
  new queries/endpoints); band pills/chips/avatar/tabs per mockup 08.
- **UF-3 done**: all six deferred LOWs fixed (ux-9..ux-14).

## Gates (checkpoint-fix3)

- `npx tsc --noEmit` -> clean
- `npx eslint . --quiet` -> 0 errors
- `npx vitest run` -> 1119/1119 pass (+2 `scTrend_` tests)

## Notes / residual

- New agents tab labels are raw strings like the `Seg` options they
  replaced ("Stack ranking" etc.) — same i18n status as before; FUX-13
  recorded them for a future i18n sweep if PM wants full AR coverage.
- Visual reshoot (/overview, /agents, /heatmap light+dark) still requires a
  dev-server pass — PM/UX gate owns that verification.
- No reviewers spawned; no reshards needed; no blocked items.
