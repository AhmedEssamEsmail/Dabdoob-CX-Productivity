# TL report — redesign BUILD (tl-1)

## Shards
All 14 done: S01 theme.css+layout · S02 shot harness (.devin/work, 101-shot rig) · S03 cx-kit.css · S04 ui/ library (19 files) · S05–S10 area styles+codemods (hub, quality, queue, people, ops+desk, productivity) · S11 shell+auth · S12 retire globals/legacy-apps imports + stragglers · S13 shots (101 PNGs) · S14 docs/UI-SYSTEM.md (owner tech-writer n/a → dev per allowed profiles).
Fix: `fix-s13-rowh` — box-sizing:border-box restored on table cells in cx-kit.css (lost when globals.css unimported); rowH 45–50.5px → 36px verified on 15 routes light+dark.

## Changed files (91 + specs/)
`src/app/`: theme.css, cx-kit.css, styles/{hub,quality,queue,people,operations,desk,productivity}.css, layout.tsx, ~40 route pages (css imports).
`src/features/shared/components/ui/` (19 new), `shell/*` (6), `cx-hub|cx-quality|cx-queue|cx-people|cx-operations|cx-desk` components, `docs/UI-SYSTEM.md`. `.devin/work/shots/redesign/` (gitignored). All inside shard Files lists — scope check PASS.

## Gates (project root)
- `npx tsc --noEmit` — PASS (0)
- `npx eslint .` — PASS (0 errors; 370 warnings: pre-existing unused-vars + ~50 mandated `kept raw` waiver directives)
- `npx vitest run` — PASS (46 files / 1140 tests)
- `npx next build` — PASS (154 static pages)
- `npm run test:e2e` — 69 pass / 7 fail / 9 skip. All 7 failures = Supabase login rate-limit timeouts (`e2e login failed … waitForTimeout`), env flake not DOM-contract; S12's auth re-run went 22/22.
- `node .devin/work/shoot-new.mjs` — 101 shots, 0 errors; contract: target/btnMinH/btnBorderW/baseFont/rowH all pass (post-fix).

## Open issues for reviewers
- eco3-tag scene-annotation `<button>` has min-height:0 on ecosystem — flagged, likely exempt-by-design; confirm in UX review.
- 7 pre-existing pageerrors on dev-overlay pages (fcr, kpi-close, escalation-matrix) recorded in shot metadata.
- e2e green board needs a re-run once Supabase rate-limit cools.
- Ignored: no shard requested qa/security/ux owners (correct — PM runs those gates).
