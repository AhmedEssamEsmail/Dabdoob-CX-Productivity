# P2FHUB-04 — /ecosystem floating tags @375
Status: DONE (CSS-only; browser re-audit pending TL/auditor — dev server 307s to auth)
Files: src/app/styles/hub.css (@media max-width:600px block, ~:169-174)
Change: `.eco3-tags { display:none }` at ≤600px replaces the per-tag font-size tweak; group/node floating tags no longer render/overlap `.eco3-head` h1+credit or clip at edges. `.eco3-tag--camel` was already hidden; scene canvas pick (`onSelect`) and `.eco3-dock` controls unchanged; ≥768 untouched.
Checks: `npx tsc --noEmit` -> clean (0 output). eslint n/a (CSS).
Handoff: auditor re-runs Q4 on /ecosystem @375; confirm no tag overlap, dock still usable.
