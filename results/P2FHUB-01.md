# P2FHUB-01 — /admin settings @375
Status: DONE (CSS-only; admin-page.tsx untouched — no class hook needed)
Files: src/app/styles/hub.css (+12 lines after .setting-actions ~:206)
Changes: .setting-value clamped (max-block-size:12rem + overflow:auto, flex:1); @media ≤40rem: .kv .kv-row stacks to minmax(0,1fr), .setting-view wraps, .setting-edit grid → minmax(0,1fr) + inputs min-inline-size:0/max-inline-size:100%, .setting-actions wraps. All scoped [data-app="hub"] — shared .kv (tl-tasks) and cx-kit.css untouched.
Checks: npx tsc --noEmit → clean. eslint n/a (no .tsx touched). Dev server up; /admin is auth-gated so browser scrollWidth re-measure deferred to auditor.
Handoff: auditor re-runs Q4 @375 (expect scrollWidth=375, bounded JSON rows) + eyeballs 768-1440.
