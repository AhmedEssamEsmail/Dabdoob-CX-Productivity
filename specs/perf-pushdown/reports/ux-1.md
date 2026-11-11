# ux report - perf-pushdown - round 1 (FULL)

Verdict: FAIL
Open: 0 B / 0 H / 2 M / 1 L

States checked: loading (dynamic fallback), error (in-page `Ft` + Try again, unchanged), gate (non-TL message, unchanged), keyboard/focus, copy, theme consistency. Mobile/dark/focus-visible: see Not verified.

Scope reviewed (UI files from tl-*.md / PLAN P-18, P-19):
- `src/app/ecosystem/page.tsx`, `src/features/cx-hub/components/ecosystem-dynamic.tsx` (P-18 ssr:false wrapper)
- `src/features/cx-productivity/components/tph-grid-views.tsx`, `tph-grid-page.tsx` (P-19 memo)
- `src/features/cx-quality/components/audit-queue-page.tsx` (P-19 memo)

## P-19 memo/render changes — no findings
Verified render-parity, not just test status:
- `We(d,…)` (tph-grid-shared.ts:108-109) reads exactly `d.off`/`d.channels`/`d.activities` — the narrowed `[missingMap, d.off, d.channels, d.activities]` deps (tph-grid-views.tsx:211) cannot go stale.
- `Va(table, callsKey)` (tph-grid-shared.ts:117) takes `table` only — `Ga`'s `[d]`→`[d.table]` (tph-grid-page.tsx:142) is correct.
- `useQaSort.apply` is `useCallback`-stable by design (qa-shared.tsx:577-592) — `sortedQueue`/`sortedPassed` (audit-queue-page.tsx:~228-230) actually skip re-sorts; request-first ordering and `?? []` guards preserve the original output (`sRows`/`sRequests`/`sToday`/`sPassed` derivations are output-identical incl. the `s`/`l` null paths).
- `EsPaintGrid = memo(PaintGrid)` + memoized `gridStyle` (tph-grid-views.tsx:477,528,618) — no markup/ARIA change; `aria-label` and `columnHeaders` unchanged.

## Findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| ux-1 | MED | `ecosystem-dynamic.tsx:10-14` (`/ecosystem` loading fallback) | `loading` renders a bare `<div className="eco3-page-msg">` inside `AppShell`. `eco3-page-msg` (hub.css:169) is `position:absolute;inset:0`, z-index auto, no background — so the app rail/nav/footer stay visible *and clickable* during the chunk fetch, then `main.eco3-page` (position:fixed; z-index:1, hub.css:160) snaps over the whole viewport. Pre-change SSR emitted that cover plus `<h1>Ecosystem</h1>`, the "Hub home" link and the skip link target from first paint (ecosystem-page.tsx:142-158); the fallback drops all of it, then it pops in — viewport-wide context swap and no heading/landmark while loading. | `loading: () => (<div className="eco3-page"><div className="eco3-page-msg" role="status"><p>Loading the ecosystem</p></div></div>)` — restores the fixed cover (pointer-blocking, matches the page's own overlay); optionally include the `header.eco3-head` h1 for full parity. Use `div`, not `main`, to avoid a second nested `<main>` inside AppShell's `main#main`. | dev |
| ux-2 | MED | `ecosystem-dynamic.tsx:11-12` (same element) | Loading text has no `role="status"`/`aria-live` — with `ssr:false` it is the page's only content for the entire chunk-fetch window, so SR users get no announcement (WCAG 4.1.3). Sibling loaders announce: `role="status" aria-busy` (trackers-page.tsx:429), `role="status"` (hub-shared.tsx:578). The in-page Scene3D fallback had the surrounding chrome/announced errors; at route level nothing does. | Add `role="status"` to the `.eco3-page-msg` wrapper (bundled into ux-1's fix). | dev |
| ux-3 | LOW | `ecosystem-dynamic.tsx:12` | "Loading the ecosystem" lacks trailing `…` (interface copy guideline). Matches the legacy verbatim string already in ecosystem-page.tsx:31,142 — consistent, so logged only. | If ever fixed, change both sites together to keep the two loaders identical. | dev |

## Not verified / assumptions
- Contrast/pixels, 320px reflow, 200% text, focus-visible rendering: judged from code/CSS only (no Playwright run). Fallback is a single centered line; reflow risk nil. Pre-existing CSS quirk: `--eco3-*` tokens are scoped to `.eco3` (hub.css:109-127), so `var(--eco3-ink-2)` inside `.eco3-page-msg` and `var(--eco3-bg)` on `.eco3-page` never resolve — the new fallback inherits `--cx-ink`/`--cx-bg`, which is *identical* to the page's existing fallback rendering; not a regression, hence not a finding.
- `narrow` prop removals (PageShell.tsx, pw.tsx, admin-page.tsx `Pf`, notes-page.tsx:265) are **not** perf-pushdown work — they belong to sibling spec `specs/ux-ui-audit-v3` S01-03 (TRACKER: deliberate; `.page-narrow` CSS kept for StateScreen). No finding here; PM should note the working tree mixes two specs' UI changes.
- No-JS: `ssr:false` means zero page markup without JS (previously the shell/gate text was SSR'd). App is behind auth — JS is required to reach this route — so noted, not a finding.
- `useQaSort`/`apply` stability, memo parity: corroborated by tl-4 (tph-grid-memo 7/7, audit-queue-memo 4/4, vitest 1296-1298 green).
- Stray untracked `src/features/cx-hub/tmp-lint-fixture.tsx` in the component dir — repo hygiene note for dev, not a UI finding.
