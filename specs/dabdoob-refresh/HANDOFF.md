# HANDOFF — dabdoob-refresh (2026-11-08)
Resume in new chat: read this + TRACKER.md + PLAN.md.

## State
- Committed+pushed: `f61d75f` (rebrand + redesign + spec artifacts) — Vercel preview READY.
- **UNCOMMITTED since then**: FUX-10..15 (user fix round: dq-* unscope, agents TREND-8W spark, all ux-9..14 LOWs), NAV-01..03 (unified collapsible nav, no _top/BootSplash-on-nav), PX-01..10 (mockup-parity fixes: topbar on all pages, queue Export+head search, status-validation seg+stats, tph tab order, my-day Week+CTA, aging ladder drop, agents date width, overview pulse bars), new e2e/nav-collapse.spec.ts, spec/FIX/*.md + spec/NAV/.
- All gates green after PX round: tsc clean, eslint 0, vitest 1117/1117, e2e 95p/10s/0f.
- Dev server may still be running on :3000 (`npm run dev` in CX-Hub); quick-check script `.devin/work/shoot-overview-check.mjs`.

## Remaining tasks (in order)
1. **Re-gate mockup parity** — rerun the ux-parity check (ux-ui-expert) against `.devin/work/parity-gate/` method; confirm all 10 pages MATCH or only documented divergences remain. Divergences already documented: H7b per-case touches/dur cols (no store), adherence pulse bar (no source → `–`), Week = 2-day API window. "Insight chip" = Next dev-overlay, not app UI.
2. **Commit + push the uncommitted rounds** if user approves (message style: `feat(ui): ...`; include Co-Authored-By Devin trailer). Then poll Vercel deployment (vercel MCP list_deployments → get_deployment; project dabdoob-cx-productivity, team ismails-projects-f1e5c1e6).
3. Optional PR to main when user asks.

## Context for next session
- Mockups = contract: `mockups/pages/*.html`, `mockups/assets/mock.css`.
- Prod (main) loads `globals.css`+`legacy-apps.css` globally; this branch loads per-area `styles/*.css` — `.dq-*` family now unscoped in refresh.css.
- Nav: all groups inline+collapsible (`.nav-group-label` buttons, sessionStorage `cx.nav-groups`), every link client-side `navigate()` — BootSplash only on full document load.
- Topbar: `Topbar.tsx` renders crumbs+bell+appearance+avatar as first child of #main on all shell pages.
