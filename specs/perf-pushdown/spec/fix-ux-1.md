# fix-ux-1 — FIX leaves for reports/ux-1.md (round 1, all rows blocking)

## ux1-01: restore covered, announced loading fallback in ecosystem-dynamic
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: ux-1 + ux-2 (MED) + ux-3 (LOW, blocking per PM) — all in the `loading` fallback
Skills: none
Budget: files=3; actions=4; changed_lines=30; minutes=8

### Goal
The `/ecosystem` `ssr:false` loading fallback must cover the viewport (no
clickable rail/nav behind it, no pop-in), be announced to screen readers, and
carry the same loader copy as the in-page loaders — one tiny fix to one
fallback plus the verbatim-copy sync the reviewer required.

### Files
- Edit: `src/features/cx-hub/components/ecosystem-dynamic.tsx` | the `loading:` fallback (lines ~10-14)
- Edit: `src/features/cx-hub/components/ecosystem-page.tsx` | loader copy at :31 and :142 only
- Edit: `tests/perf/ecosystem-dynamic.test.ts` | add fallback-shape assertions to the existing describe

### Context
- `reports/ux-1.md` findings ux-1/ux-2/ux-3 | exact fix dictated there
- `src/app/styles/hub.css:160,169` | `.eco3-page` = fixed inset-0 z-1 cover; `.eco3-page-msg` = absolute centered grid inside it
- `src/features/cx-hub/components/ecosystem-page.tsx:142-158` | page's real markup: `header.eco3-head > h1` + `.eco3-page-msg`

### Contract
Keep `dynamic(..., { ssr:false })` and the `import('./ecosystem-page').then(m => m.EcosystemPage)` shape — tests/perf asserts it.
Use `div.eco3-page`, NOT `main` (AppShell already renders `main#main`; no nested `<main>`).
The three loader strings MUST stay verbatim-identical across both files.
Out of scope: error/gate markup, hub.css, Scene3D fallback markup, any other file.

### Actions
1. In `ecosystem-dynamic.tsx`, change the fallback to
   `<div className="eco3-page"><div className="eco3-page-msg" role="status"><p>Loading the ecosystem…</p></div></div>`
   and add `<header className="eco3-head"><h1>Ecosystem</h1></header>` inside the `.eco3-page` cover (heading/landmark parity with pre-change SSR).
2. In `ecosystem-page.tsx`, change the two `<p>Loading the ecosystem</p>` strings (:31, :142) to `Loading the ecosystem…` so all loaders match verbatim.
3. In `tests/perf/ecosystem-dynamic.test.ts`, add one test asserting the wrapper source contains `eco3-page` cover, `role="status"`, and `Loading the ecosystem…`.
4. Run the targeted checks below; capture output.

### Done when
- Fallback renders a `.eco3-page` fixed cover containing `.eco3-page-msg` with `role="status"` and the `h1` header.
- All three loader strings in both source files read exactly `Loading the ecosystem…`.
- `role="status"` present on the `.eco3-page-msg` element (WCAG 4.1.3).
- Targeted vitest + tsc on touched files pass.

### Verify
- Run: `npx vitest run tests/perf/ecosystem-dynamic.test.ts` -> all pass incl. new case
- Run: `npx eslint src/features/cx-hub/components/ecosystem-dynamic.tsx src/features/cx-hub/components/ecosystem-page.tsx tests/perf/ecosystem-dynamic.test.ts` -> 0 errors

### Handoff
none — last consumer-facing fix for ux-1 round 1.
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.
