# DQ-4 — shared-helper dq-* → cx-* renames + refresh.css rules
Status: done
Files: overview-page.tsx, quality-analytics-page.tsx, people-holidays-page.tsx, agents-page.tsx, checkins-page.tsx, queue-page.tsx, src/app/refresh.css (7)
Renames: dq-totals*/dq-stats/dq-stat*/dq-agebar/dq-rowhead/dq-sub/dq-groupbreak/dq-statusline/dq-correct → cx-*; comments updated; overview:168 eslint-disable converted to plain kept-raw comment (directive went unused once dq-stat stopped warning).
Checks: `grep -rEno 'dq-(totals|stats|stat|agebar|rowhead|sub|groupbreak|statusline|correct)[\w-]*' src/` → 0 hits; `npx tsc --noEmit` clean; eslint on 6 tsx → 0 errors, no warns on renamed families (remaining warns are dq-editor/days/holform keeps + pre-existing sr-only/cx-sr, out of scope); vitest 5 golden files → 121/121 pass.
Handoff: refresh.css free for DQ-5 (analytics family) → DQ-6 → S12-32.
